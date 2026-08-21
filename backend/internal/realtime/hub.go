// Package realtime implementa um hub de pub/sub em memória
package realtime

import (
	"sync"

	"github.com/liedsonlb/resenha-patch/internal/models"
)

type subscriber chan models.ProgressoEvento

// Participante é o registro de presença de quem está com o canal SSE da
// sala aberto agora (professor no dashboard, ou aluno na videochamada).
type Participante struct {
	UsuarioID   int64   `json:"usuario_id"`
	NomeUsuario string  `json:"nome_usuario"`
	Foto        *string `json:"foto,omitempty"`
	IsAdmin     bool    `json:"is_admin,omitempty"`
	Identity    string  `json:"identity"`
	MicEnabled  bool    `json:"mic_enabled"`
}

// Hub mantém, por sala: a lista de assinantes SSE, o último evento de
// progresso conhecido de cada usuário e quem está atualmente conectado.
type Hub struct {
	mu            sync.RWMutex
	subscribers   map[int64]map[subscriber]struct{}
	lastState     map[int64]map[int64]models.ProgressoEvento
	participantes map[int64]map[int64]Participante
}

func NewHub() *Hub {
	return &Hub{
		subscribers:   make(map[int64]map[subscriber]struct{}),
		lastState:     make(map[int64]map[int64]models.ProgressoEvento),
		participantes: make(map[int64]map[int64]Participante),
	}
}

// Subscribe registra um novo assinante para a sala
func (h *Hub) Subscribe(salaID int64, p Participante) (<-chan models.ProgressoEvento, func()) {
	ch := make(subscriber, 32)

	h.mu.Lock()
	if h.subscribers[salaID] == nil {
		h.subscribers[salaID] = make(map[subscriber]struct{})
	}
	h.subscribers[salaID][ch] = struct{}{}
	if h.participantes[salaID] == nil {
		h.participantes[salaID] = make(map[int64]Participante)
	}
	h.participantes[salaID][p.UsuarioID] = p
	h.mu.Unlock()

	h.publishPresenca(salaID, p, models.EventoEntrou)

	unsubscribe := func() {
		h.mu.Lock()
		delete(h.subscribers[salaID], ch)
		delete(h.participantes[salaID], p.UsuarioID)
		h.mu.Unlock()
		close(ch)
		h.publishPresenca(salaID, p, models.EventoSaiu)
	}

	return ch, unsubscribe
}

func (h *Hub) publishPresenca(salaID int64, p Participante, tipo string) {
	h.Publish(models.ProgressoEvento{
		Tipo:        tipo,
		SalaID:      salaID,
		UsuarioID:   p.UsuarioID,
		NomeUsuario: p.NomeUsuario,
		Foto:        p.Foto,
		IsAdmin:     p.IsAdmin,
	})
}

// Participantes devolve quem está com o canal SSE da sala aberto agora
func (h *Hub) Participantes(salaID int64) []Participante {
	h.mu.RLock()
	defer h.mu.RUnlock()
	out := make([]Participante, 0, len(h.participantes[salaID]))
	for _, p := range h.participantes[salaID] {
		out = append(out, p)
	}
	return out
}

// ParticipantesDetalhados retorna a lista de participantes com mais detalhes
// para ser usada na API de canais de voz - retorna []models.ParticipanteInfo
func (h *Hub) ParticipantesDetalhados(salaID int64) []models.ParticipanteInfo {
	h.mu.RLock()
	defer h.mu.RUnlock()
	
	sala, ok := h.participantes[salaID]
	if !ok {
		return []models.ParticipanteInfo{}
	}
	
	result := make([]models.ParticipanteInfo, 0, len(sala))
	for _, p := range sala {
		foto := ""
		if p.Foto != nil {
			foto = *p.Foto
		}
		result = append(result, models.ParticipanteInfo{
			Identity:   p.Identity,
			Nome:       p.NomeUsuario,
			Foto:       foto,
			MicEnabled: p.MicEnabled,
		})
	}
	return result
}

// Snapshot devolve o último evento de progresso conhecido de cada participante
func (h *Hub) Snapshot(salaID int64) []models.ProgressoEvento {
	h.mu.RLock()
	defer h.mu.RUnlock()

	out := make([]models.ProgressoEvento, 0, len(h.lastState[salaID]))
	for _, ev := range h.lastState[salaID] {
		out = append(out, ev)
	}
	return out
}

// Publish envia o evento a todos os assinantes atuais da sala
func (h *Hub) Publish(ev models.ProgressoEvento) {
	h.mu.Lock()
	if ev.Tipo == "" || ev.Tipo == models.EventoProgresso {
		if h.lastState[ev.SalaID] == nil {
			h.lastState[ev.SalaID] = make(map[int64]models.ProgressoEvento)
		}
		h.lastState[ev.SalaID][ev.UsuarioID] = ev
	}
	subs := h.subscribers[ev.SalaID]
	h.mu.Unlock()

	for ch := range subs {
		select {
		case ch <- ev:
		default:
			// assinante lento — não bloqueia o publisher.
		}
	}
}

// ClearSala remove o estado em memória de uma sala
func (h *Hub) ClearSala(salaID int64) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.subscribers, salaID)
	delete(h.lastState, salaID)
	delete(h.participantes, salaID)
}