package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/liedsonlb/resenha-patch/internal/httpx"
	"github.com/liedsonlb/resenha-patch/internal/middleware"
	"github.com/liedsonlb/resenha-patch/internal/models"
	"github.com/liedsonlb/resenha-patch/internal/realtime"
	"github.com/liedsonlb/resenha-patch/internal/repository"
)

type CanalHandler struct {
	repo           *repository.CanalRepository
	comunidadeRepo *repository.ComunidadeRepository
	salaRepo       *repository.SalaRepository
	hub            *realtime.Hub
}

func NewCanalHandler(repo *repository.CanalRepository, comunidadeRepo *repository.ComunidadeRepository, salaRepo *repository.SalaRepository, hub *realtime.Hub) *CanalHandler {
	return &CanalHandler{repo: repo, comunidadeRepo: comunidadeRepo, salaRepo: salaRepo, hub: hub}
}

// requireMembro garante que a sessão atual pertence à comunidade
func (h *CanalHandler) requireMembro(w http.ResponseWriter, r *http.Request, comunidadeID int64) bool {
	session := middleware.UserFromContext(r)
	if session == nil {
		httpx.Error(w, "Não autenticado.", 401)
		return false
	}
	if session.IsAdmin() {
		return true
	}
	papel, err := h.comunidadeRepo.Papel(comunidadeID, session.ID)
	if err != nil {
		httpx.Error(w, "Erro interno.", 500)
		return false
	}
	if papel == "" {
		httpx.Error(w, "Você não faz parte dessa comunidade.", 403)
		return false
	}
	return true
}

func (h *CanalHandler) requireDono(w http.ResponseWriter, r *http.Request, comunidadeID int64) bool {
	session := middleware.UserFromContext(r)
	if session == nil {
		httpx.Error(w, "Não autenticado.", 401)
		return false
	}
	if session.IsAdmin() {
		return true
	}
	papel, err := h.comunidadeRepo.Papel(comunidadeID, session.ID)
	if err != nil {
		httpx.Error(w, "Erro interno.", 500)
		return false
	}
	if papel != models.PapelDono {
		httpx.Error(w, "Só quem criou a comunidade pode gerenciar canais.", 403)
		return false
	}
	return true
}

// All handles GET /comunidades/{id}/canais
// Retorna participantes online para todos os canais de voz
func (h *CanalHandler) All(w http.ResponseWriter, r *http.Request) {
	comunidadeID, err := idFromPath(r)
	if err != nil {
		httpx.Error(w, "Id inválido.", 422)
		return
	}

	// Verifica se o usuário está autenticado
	session := middleware.UserFromContext(r)
	if session == nil {
		httpx.Error(w, "Não autenticado.", 401)
		return
	}

	// Busca os canais da comunidade
	list, err := h.repo.ListByComunidade(comunidadeID)
	if err != nil {
		httpx.Error(w, "Erro interno.", 500)
		return
	}
	if list == nil {
		list = []*models.Canal{}
	}

	// Preenche participantes online para TODOS os canais de voz
	for _, c := range list {
		if c.Tipo == models.CanalTipoVoz && c.SalaID != nil {
			// Pega participantes detalhados do hub
			participantes := h.hub.ParticipantesDetalhados(*c.SalaID)
			c.ParticipantesOnline = len(participantes)
			c.ParticipantesLista = participantes
		}
	}

	httpx.JSON(w, 200, list)
}

type canalPayload struct {
	Nome  string  `json:"nome"`
	Tipo  string  `json:"tipo"`  // "texto" | "voz"
	Icone *string `json:"icone"` // emoji ou ícone do canal
}

// Save handles POST /comunidades/{id}/canais
func (h *CanalHandler) Save(w http.ResponseWriter, r *http.Request) {
	comunidadeID, err := idFromPath(r)
	if err != nil {
		httpx.Error(w, "Id inválido.", 422)
		return
	}
	if !h.requireDono(w, r, comunidadeID) {
		return
	}
	var payload canalPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		httpx.Error(w, "Requisição inválida.", 422)
		return
	}
	if payload.Tipo != models.CanalTipoVoz {
		payload.Tipo = models.CanalTipoTexto
	}

	var salaID *int64
	if payload.Tipo == models.CanalTipoVoz {
		session := middleware.UserFromContext(r)
		comunidade, err := h.comunidadeRepo.FindByID(comunidadeID)
		if err != nil {
			writeAppErr(w, err)
			return
		}
		nomeSala := fmt.Sprintf("%s — %s", comunidade.Nome, payload.Nome)
		sala, err := h.salaRepo.Create(nomeSala, models.SalaTipoReuniao, nil, nil, session.ID)
		if err != nil {
			httpx.Error(w, "Erro ao preparar o canal de voz.", 500)
			return
		}
		salaID = &sala.ID
	}

	created, err := h.repo.Create(comunidadeID, payload.Nome, payload.Tipo, salaID, payload.Icone)
	if err != nil {
		writeAppErr(w, err)
		return
	}
	httpx.JSON(w, 201, created)
}

// Update handles PATCH /canais/{id} — permite ao dono renomear ou trocar o ícone
func (h *CanalHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := idFromPath(r)
	if err != nil {
		httpx.Error(w, "Id inválido.", 422)
		return
	}
	canal, err := h.repo.FindByID(id)
	if err != nil {
		writeAppErr(w, err)
		return
	}
	if !h.requireDono(w, r, canal.ComunidadeID) {
		return
	}
	var payload canalPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		httpx.Error(w, "Requisição inválida.", 422)
		return
	}
	if payload.Nome != "" {
		canal.Nome = payload.Nome
	}
	if payload.Icone != nil {
		canal.Icone = payload.Icone
	}
	updated, err := h.repo.Update(canal.ID, canal.Nome, canal.Icone)
	if err != nil {
		writeAppErr(w, err)
		return
	}
	httpx.JSON(w, 200, updated)
}

// Delete handles DELETE /canais/{id}
func (h *CanalHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := idFromPath(r)
	if err != nil {
		httpx.Error(w, "Id inválido.", 422)
		return
	}
	canal, err := h.repo.FindByID(id)
	if err != nil {
		writeAppErr(w, err)
		return
	}
	if !h.requireDono(w, r, canal.ComunidadeID) {
		return
	}
	if canal.Tipo == models.CanalTipoVoz && canal.SalaID != nil {
		_ = h.salaRepo.Encerrar(*canal.SalaID)
		h.hub.ClearSala(*canal.SalaID)
	}
	if err := h.repo.SoftDelete(id); err != nil {
		writeAppErr(w, err)
		return
	}
	httpx.Success(w, "Canal excluído.", 200)
}