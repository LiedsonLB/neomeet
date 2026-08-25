package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/liedsonlb/resenha-patch/internal/httpx"
	"github.com/liedsonlb/resenha-patch/internal/middleware"
	"github.com/liedsonlb/resenha-patch/internal/models"
	"github.com/liedsonlb/resenha-patch/internal/repository"
)

// ComunidadeSomHandler gerencia o soundboard de uma comunidade — os
// clipes curtos que qualquer membro pode tocar durante uma chamada de voz
// (estilo Discord). O disparo em si (tocar o som pra todo mundo ouvir) NÃO
// passa pelo backend — o frontend manda os bytes/URL via LiveKit data
// channel direto pros outros participantes da sala (ver
// ComunidadeRoom.tsx). Este handler só gerencia a biblioteca de sons
// (adicionar/listar/remover).
type ComunidadeSomHandler struct {
	repo           *repository.ComunidadeSomRepository
	comunidadeRepo *repository.ComunidadeRepository
}

func NewComunidadeSomHandler(repo *repository.ComunidadeSomRepository, comunidadeRepo *repository.ComunidadeRepository) *ComunidadeSomHandler {
	return &ComunidadeSomHandler{repo: repo, comunidadeRepo: comunidadeRepo}
}

func (h *ComunidadeSomHandler) requireMembro(w http.ResponseWriter, r *http.Request, comunidadeID int64) bool {
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
	if papel == "" || papel == models.PapelPendente {
		httpx.Error(w, "Você não faz parte dessa comunidade.", 403)
		return false
	}
	return true
}

// All handles GET /comunidades/{id}/sons
func (h *ComunidadeSomHandler) All(w http.ResponseWriter, r *http.Request) {
	comunidadeID, err := idFromPath(r)
	if err != nil {
		httpx.Error(w, "Id inválido.", 422)
		return
	}
	if !h.requireMembro(w, r, comunidadeID) {
		return
	}
	list, err := h.repo.ListByComunidade(comunidadeID)
	if err != nil {
		httpx.Error(w, "Erro interno.", 500)
		return
	}
	if list == nil {
		list = []*models.ComunidadeSom{}
	}
	httpx.JSON(w, 200, list)
}

type comunidadeSomPayload struct {
	Nome       string  `json:"nome"`
	Emoji      *string `json:"emoji"`
	ArquivoURL string  `json:"arquivo_url"`
}

// Save handles POST /comunidades/{id}/sons — qualquer membro pode
// adicionar um som ao soundboard (como no Discord).
func (h *ComunidadeSomHandler) Save(w http.ResponseWriter, r *http.Request) {
	comunidadeID, err := idFromPath(r)
	if err != nil {
		httpx.Error(w, "Id inválido.", 422)
		return
	}
	if !h.requireMembro(w, r, comunidadeID) {
		return
	}
	var payload comunidadeSomPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		httpx.Error(w, "Requisição inválida.", 422)
		return
	}
	session := middleware.UserFromContext(r)
	created, err := h.repo.Create(comunidadeID, payload.Nome, payload.Emoji, payload.ArquivoURL, session.ID)
	if err != nil {
		writeAppErr(w, err)
		return
	}
	httpx.JSON(w, 201, created)
}

// Delete handles DELETE /sons/{id} — quem adicionou o som ou o dono da
// comunidade pode remover.
func (h *ComunidadeSomHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := idFromPath(r)
	if err != nil {
		httpx.Error(w, "Id inválido.", 422)
		return
	}
	som, err := h.repo.FindByID(id)
	if err != nil {
		writeAppErr(w, err)
		return
	}
	session := middleware.UserFromContext(r)
	if session == nil {
		httpx.Error(w, "Não autenticado.", 401)
		return
	}
	if !session.IsAdmin() && session.ID != som.CriadoPor {
		papel, _ := h.comunidadeRepo.Papel(som.ComunidadeID, session.ID)
		if papel != models.PapelDono {
			httpx.Error(w, "Você não pode remover esse som.", 403)
			return
		}
	}
	if err := h.repo.Delete(id); err != nil {
		writeAppErr(w, err)
		return
	}
	httpx.Success(w, "Som removido.", 200)
}
