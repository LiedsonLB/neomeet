// Package realtime implementa um hub de pub/sub em memória, usado para dar
// ao professor um dashboard ao vivo de cada participante de uma "sala de
// produção": presença (quem está conectado agora), progresso de escrita, e
// o comando de "iniciar produção" disparado no meio da videochamada. Cada
// sala tem seu próprio broadcast channel; assinantes (o dashboard do
// professor e o painel de escrita do aluno) recebem os eventos via
// Server-Sent Events (SSE) — não precisa de WebSocket nem de infra extra.
//
// É deliberadamente em memória (não Redis/Kafka): o WebLEIA roda como um
// único processo de API, e o dado é efêmero (só importa enquanto a sala
// está aberta).
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
}

// Hub mantém, por sala: a lista de assinantes SSE, o último evento de
// progresso conhecido de cada usuário (para quem entra "no meio" já ver o
// estado atual de todo mundo) e quem está atualmente conectado (presença).
type Hub struct {
	mu            sync.RWMutex
	subscribers   map[int64]map[subscriber]struct{}          // salaID -> assinantes
	lastState     map[int64]map[int64]models.ProgressoEvento // salaID -> usuarioID -> último progresso
	participantes map[int64]map[int64]Participante           // salaID -> usuarioID -> presença
}

func NewHub() *Hub {
	return &Hub{
		subscribers:   make(map[int64]map[subscriber]struct{}),
		lastState:     make(map[int64]map[int64]models.ProgressoEvento),
		participantes: make(map[int64]map[int64]Participante),
	}
}

// Subscribe registra um novo assinante para a sala, marca o usuário como
// presente (publicando um evento "entrou" para os demais assinantes) e
// devolve o channel de leitura + uma função de cleanup a ser chamada com
// `defer` quando a conexão HTTP fechar (ela remove a presença e publica
// "saiu").
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

// Participantes devolve quem está com o canal SSE da sala aberto agora —
// usado pelo endpoint de "iniciar produção" pra saber para quem criar uma
// produção textual.
func (h *Hub) Participantes(salaID int64) []Participante {
	h.mu.RLock()
	defer h.mu.RUnlock()
	out := make([]Participante, 0, len(h.participantes[salaID]))
	for _, p := range h.participantes[salaID] {
		out = append(out, p)
	}
	return out
}

// Snapshot devolve o último evento de progresso conhecido de cada
// participante da sala — usado para "preencher" o estado assim que alguém
// abre o dashboard, sem precisar esperar o próximo evento de cada aluno.
func (h *Hub) Snapshot(salaID int64) []models.ProgressoEvento {
	h.mu.RLock()
	defer h.mu.RUnlock()

	out := make([]models.ProgressoEvento, 0, len(h.lastState[salaID]))
	for _, ev := range h.lastState[salaID] {
		out = append(out, ev)
	}
	return out
}

// Publish envia o evento a todos os assinantes atuais da sala (non-blocking:
// se algum assinante estiver com o buffer cheio, o evento é descartado só
// para ele — não trava quem está publicando). Eventos de progresso (tipo
// vazio) também atualizam o snapshot; eventos de presença/comando não.
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

// ClearSala remove o estado em memória de uma sala (chamado ao encerrar a
// sala de produção).
func (h *Hub) ClearSala(salaID int64) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.subscribers, salaID)
	delete(h.lastState, salaID)
	delete(h.participantes, salaID)
}
