package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/liedsonlb/resenha-patch/internal/httpx"
	"github.com/liedsonlb/resenha-patch/internal/middleware"
	"github.com/liedsonlb/resenha-patch/internal/models"
	"github.com/liedsonlb/resenha-patch/internal/repository"
)

type MensagemHandler struct {
	repo           *repository.MensagemRepository
	canalRepo      *repository.CanalRepository
	comunidadeRepo *repository.ComunidadeRepository
}

func NewMensagemHandler(repo *repository.MensagemRepository, canalRepo *repository.CanalRepository, comunidadeRepo *repository.ComunidadeRepository) *MensagemHandler {
	return &MensagemHandler{repo: repo, canalRepo: canalRepo, comunidadeRepo: comunidadeRepo}
}

// canalDoMembro busca o canal do path e garante que a sessão atual é
// membro da comunidade dona dele (dono ou membro comum).
func (h *MensagemHandler) canalDoMembro(w http.ResponseWriter, r *http.Request) (*models.Canal, bool) {
	canalID, err := idFromPath(r)
	if err != nil {
		httpx.Error(w, "Id inválido.", 422)
		return nil, false
	}
	canal, err := h.canalRepo.FindByID(canalID)
	if err != nil {
		writeAppErr(w, err)
		return nil, false
	}
	if canal.Tipo != models.CanalTipoTexto {
		httpx.Error(w, "Esse canal não é de texto.", 422)
		return nil, false
	}
	session := middleware.UserFromContext(r)
	if session == nil {
		httpx.Error(w, "Não autenticado.", 401)
		return nil, false
	}
	if !session.IsAdmin() {
		papel, err := h.comunidadeRepo.Papel(canal.ComunidadeID, session.ID)
		if err != nil {
			httpx.Error(w, "Erro interno.", 500)
			return nil, false
		}
		if papel == "" {
			httpx.Error(w, "Você não faz parte dessa comunidade.", 403)
			return nil, false
		}
	}
	return canal, true
}

// All handles GET /canais/{id}/mensagens?after=<id>&limit=<n>
//
// Sem "after": devolve as últimas `limit` mensagens (ordem cronológica).
// Com "after": devolve só as mensagens novas (id > after) — é o que o
// frontend usa no polling a cada poucos segundos pra simular chat em tempo
// real sem precisar de WebSocket.
func (h *MensagemHandler) All(w http.ResponseWriter, r *http.Request) {
	canal, ok := h.canalDoMembro(w, r)
	if !ok {
		return
	}
	afterID, _ := strconv.ParseInt(r.URL.Query().Get("after"), 10, 64)
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))

	list, err := h.repo.ListByCanal(canal.ID, limit, afterID)
	if err != nil {
		httpx.Error(w, "Erro interno.", 500)
		return
	}
	if list == nil {
		list = []*models.CanalMensagem{}
	}
	httpx.JSON(w, 200, list)
}

type mensagemPayload struct {
	Conteudo string `json:"conteudo"`
}

// Save handles POST /canais/{id}/mensagens
func (h *MensagemHandler) Save(w http.ResponseWriter, r *http.Request) {
	canal, ok := h.canalDoMembro(w, r)
	if !ok {
		return
	}
	var payload mensagemPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		httpx.Error(w, "Requisição inválida.", 422)
		return
	}
	session := middleware.UserFromContext(r)
	created, err := h.repo.Create(canal.ID, session.ID, payload.Conteudo)
	if err != nil {
		writeAppErr(w, err)
		return
	}
	httpx.JSON(w, 201, created)
}
