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
// membro de fato da comunidade dona dele (dono ou membro comum — uma
// solicitação "pendente" ainda NÃO dá acesso às mensagens de comunidades
// privadas, só depois que o dono aprova).
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
		if papel == "" || papel == models.PapelPendente {
			httpx.Error(w, "Você precisa ser membro para ver as mensagens.", 403)
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

// requireAutorOuDono garante que a sessão atual escreveu a mensagem, ou é
// o dono da comunidade (moderação) / admin da plataforma.
func (h *MensagemHandler) requireAutorOuDono(w http.ResponseWriter, r *http.Request, msg *models.CanalMensagem) bool {
	session := middleware.UserFromContext(r)
	if session == nil {
		httpx.Error(w, "Não autenticado.", 401)
		return false
	}
	if session.IsAdmin() || session.ID == msg.UsuarioID {
		return true
	}
	canal, err := h.canalRepo.FindByID(msg.CanalID)
	if err == nil {
		papel, _ := h.comunidadeRepo.Papel(canal.ComunidadeID, session.ID)
		if papel == models.PapelDono {
			return true
		}
	}
	httpx.Error(w, "Você só pode gerenciar suas próprias mensagens.", 403)
	return false
}

// Update handles PUT /mensagens/{id} — só o autor pode editar (o dono da
// comunidade pode apagar, mas não editar o texto de outra pessoa).
func (h *MensagemHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := idFromPath(r)
	if err != nil {
		httpx.Error(w, "Id inválido.", 422)
		return
	}
	existing, err := h.repo.FindByID(id)
	if err != nil {
		writeAppErr(w, err)
		return
	}
	session := middleware.UserFromContext(r)
	if session == nil {
		httpx.Error(w, "Não autenticado.", 401)
		return
	}
	if !session.IsAdmin() && session.ID != existing.UsuarioID {
		httpx.Error(w, "Você só pode editar suas próprias mensagens.", 403)
		return
	}
	var payload mensagemPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		httpx.Error(w, "Requisição inválida.", 422)
		return
	}
	updated, err := h.repo.Update(id, payload.Conteudo)
	if err != nil {
		writeAppErr(w, err)
		return
	}
	httpx.JSON(w, 200, updated)
}

// Delete handles DELETE /mensagens/{id} — autor, dono da comunidade ou
// admin da plataforma.
func (h *MensagemHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := idFromPath(r)
	if err != nil {
		httpx.Error(w, "Id inválido.", 422)
		return
	}
	existing, err := h.repo.FindByID(id)
	if err != nil {
		writeAppErr(w, err)
		return
	}
	if !h.requireAutorOuDono(w, r, existing) {
		return
	}
	if err := h.repo.SoftDelete(id); err != nil {
		writeAppErr(w, err)
		return
	}
	httpx.Success(w, "Mensagem excluída.", 200)
}
