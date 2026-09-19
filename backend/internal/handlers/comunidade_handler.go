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

// int64PathParam lê um segmento nomeado da rota (ex.: "usuarioId" em
// /comunidades/{id}/membros/{usuarioId}/aprovar) como int64 — idFromPath
// (em usuario_handler.go) só cobre o segmento fixo "id".
func int64PathParam(r *http.Request, name string) (int64, error) {
	return strconv.ParseInt(r.PathValue(name), 10, 64)
}

type ComunidadeHandler struct {
	repo *repository.ComunidadeRepository
}

func NewComunidadeHandler(repo *repository.ComunidadeRepository) *ComunidadeHandler {
	return &ComunidadeHandler{repo: repo}
}

// enrich preenche Papel e TotalMembros (campos calculados, não persistidos)
// relativos à sessão atual antes de devolver a comunidade pro frontend.
func (h *ComunidadeHandler) enrich(c *models.Comunidade, sessionID int64) {
	papel, _ := h.repo.Papel(c.ID, sessionID)
	c.Papel = papel
	total, _ := h.repo.TotalMembros(c.ID)
	c.TotalMembros = total
}

// All handles GET /comunidades — "Minhas comunidades": onde o usuário é
// dono, membro ou tem solicitação pendente.
func (h *ComunidadeHandler) All(w http.ResponseWriter, r *http.Request) {
	session := middleware.UserFromContext(r)
	if session == nil {
		httpx.Error(w, "Não autenticado.", 401)
		return
	}
	list, err := h.repo.ListByUsuario(session.ID)
	if err != nil {
		httpx.Error(w, "Erro interno.", 500)
		return
	}
	if list == nil {
		list = []*models.Comunidade{}
	}
	for _, c := range list {
		h.enrich(c, session.ID)
	}
	httpx.JSON(w, 200, list)
}

// Explorar handles GET /comunidades/explorar — comunidades públicas das
// quais o usuário ainda não faz parte ("Explorar comunidades").
func (h *ComunidadeHandler) Explorar(w http.ResponseWriter, r *http.Request) {
	session := middleware.UserFromContext(r)
	if session == nil {
		httpx.Error(w, "Não autenticado.", 401)
		return
	}
	list, err := h.repo.ListExplorar(session.ID, r.URL.Query().Get("categoria"))
	if err != nil {
		httpx.Error(w, "Erro interno.", 500)
		return
	}
	if list == nil {
		list = []*models.Comunidade{}
	}
	for _, c := range list {
		c.Papel = ""
		total, _ := h.repo.TotalMembros(c.ID)
		c.TotalMembros = total
	}
	httpx.JSON(w, 200, list)
}

func (h *ComunidadeHandler) Find(w http.ResponseWriter, r *http.Request) {
	id, err := idFromPath(r)
	if err != nil {
		httpx.Error(w, "Id inválido.", 422)
		return
	}
	c, err := h.repo.FindByID(id)
	if err != nil {
		writeAppErr(w, err)
		return
	}
	session := middleware.UserFromContext(r)
	if session != nil {
		h.enrich(c, session.ID)
	}
	httpx.JSON(w, 200, c)
}

type comunidadePayload struct {
	Nome         string  `json:"nome"`
	Descricao    *string `json:"descricao"`
	// Categoria é livre, mas o frontend sugere as de models.CategoriasComunidade.
	Categoria    *string `json:"categoria"`
	Visibilidade *string `json:"visibilidade"` // "publica" | "privada"
	IconeURL     *string `json:"icone_url"`
	BannerURL    *string `json:"banner_url"`
}

// Save handles POST /comunidades — qualquer usuário autenticado pode criar
// a sua própria comunidade (vira "dono" automaticamente), escolhendo se
// ela nasce pública ou privada.
func (h *ComunidadeHandler) Save(w http.ResponseWriter, r *http.Request) {
	var payload comunidadePayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		httpx.Error(w, "Requisição inválida.", 422)
		return
	}
	session := middleware.UserFromContext(r)
	if session == nil {
		httpx.Error(w, "Não autenticado.", 401)
		return
	}
	visibilidade := models.VisibilidadePublica
	if payload.Visibilidade != nil && *payload.Visibilidade == models.VisibilidadePrivada {
		visibilidade = models.VisibilidadePrivada
	}
	created, err := h.repo.Create(payload.Nome, payload.Descricao, payload.IconeURL, payload.BannerURL, payload.Categoria, visibilidade, session.ID)
	if err != nil {
		writeAppErr(w, err)
		return
	}
	h.enrich(created, session.ID)
	httpx.JSON(w, 201, created)
}

// requireDono garante que a sessão atual é o dono da comunidade — usado
// por Update/Delete/criação e remoção de canal/aprovação de pendentes.
func (h *ComunidadeHandler) requireDono(w http.ResponseWriter, r *http.Request, comunidadeID int64) bool {
	session := middleware.UserFromContext(r)
	if session == nil {
		httpx.Error(w, "Não autenticado.", 401)
		return false
	}
	if session.IsAdmin() {
		return true
	}
	papel, err := h.repo.Papel(comunidadeID, session.ID)
	if err != nil {
		httpx.Error(w, "Erro interno.", 500)
		return false
	}
	if papel != models.PapelDono {
		httpx.Error(w, "Só quem criou a comunidade pode fazer isso.", 403)
		return false
	}
	return true
}

// Update handles PUT /comunidades/{id} — editar nome/descrição/
// visibilidade/ícone/banner.
func (h *ComunidadeHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := idFromPath(r)
	if err != nil {
		httpx.Error(w, "Id inválido.", 422)
		return
	}
	if !h.requireDono(w, r, id) {
		return
	}
	var payload comunidadePayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		httpx.Error(w, "Requisição inválida.", 422)
		return
	}
	var nome *string
	if payload.Nome != "" {
		nome = &payload.Nome
	}
	updated, err := h.repo.Update(id, repository.ComunidadeUpdate{
		Nome: nome, Descricao: payload.Descricao, Categoria: payload.Categoria, Visibilidade: payload.Visibilidade,
		IconeURL: payload.IconeURL, BannerURL: payload.BannerURL,
	})
	if err != nil {
		writeAppErr(w, err)
		return
	}
	session := middleware.UserFromContext(r)
	h.enrich(updated, session.ID)
	httpx.JSON(w, 200, updated)
}

// Delete handles DELETE /comunidades/{id} — só o dono (ou um admin) pode
// apagar.
func (h *ComunidadeHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := idFromPath(r)
	if err != nil {
		httpx.Error(w, "Id inválido.", 422)
		return
	}
	if !h.requireDono(w, r, id) {
		return
	}
	if err := h.repo.SoftDelete(id); err != nil {
		writeAppErr(w, err)
		return
	}
	httpx.Success(w, "Comunidade excluída.", 200)
}

// Entrar handles POST /comunidades/{id}/entrar — se a comunidade for
// pública, entra na hora; se for privada, cria uma solicitação pendente
// que o dono precisa aprovar (ver Pendentes/Aprovar/Rejeitar abaixo).
func (h *ComunidadeHandler) Entrar(w http.ResponseWriter, r *http.Request) {
	id, err := idFromPath(r)
	if err != nil {
		httpx.Error(w, "Id inválido.", 422)
		return
	}
	session := middleware.UserFromContext(r)
	if session == nil {
		httpx.Error(w, "Não autenticado.", 401)
		return
	}
	papel, err := h.repo.SolicitarEntrada(id, session.ID)
	if err != nil {
		writeAppErr(w, err)
		return
	}
	msg := "Você entrou na comunidade."
	if papel == models.PapelPendente {
		msg = "Solicitação enviada! Assim que o dono aprovar, você terá acesso."
	}
	httpx.JSON(w, 200, map[string]any{"message": msg, "papel": papel})
}

// Membros handles GET /comunidades/{id}/membros — lista todo mundo que já
// faz parte da comunidade (dono + membros, nunca pendentes) com indicador
// de presença online/offline. Qualquer membro (não só o dono) pode ver
// essa lista — é a aba "Membros" da comunidade.
func (h *ComunidadeHandler) Membros(w http.ResponseWriter, r *http.Request) {
	id, err := idFromPath(r)
	if err != nil {
		httpx.Error(w, "Id inválido.", 422)
		return
	}
	session := middleware.UserFromContext(r)
	if session == nil {
		httpx.Error(w, "Não autenticado.", 401)
		return
	}
	if !session.IsAdmin() {
		papel, err := h.repo.Papel(id, session.ID)
		if err != nil {
			httpx.Error(w, "Erro interno.", 500)
			return
		}
		if papel != models.PapelDono && papel != models.PapelMembro {
			httpx.Error(w, "Você precisa ser membro para ver os membros.", 403)
			return
		}
	}
	list, err := h.repo.ListMembros(id)
	if err != nil {
		httpx.Error(w, "Erro interno.", 500)
		return
	}
	if list == nil {
		list = []*models.MembroComPresenca{}
	}
	httpx.JSON(w, 200, list)
}

// Pendentes handles GET /comunidades/{id}/pendentes — só o dono vê quem
// está esperando aprovação pra entrar numa comunidade privada.
func (h *ComunidadeHandler) Pendentes(w http.ResponseWriter, r *http.Request) {
	id, err := idFromPath(r)
	if err != nil {
		httpx.Error(w, "Id inválido.", 422)
		return
	}
	if !h.requireDono(w, r, id) {
		return
	}
	list, err := h.repo.ListPendentes(id)
	if err != nil {
		httpx.Error(w, "Erro interno.", 500)
		return
	}
	if list == nil {
		list = []*models.ComunidadeMembro{}
	}
	httpx.JSON(w, 200, list)
}

// Aprovar handles POST /comunidades/{id}/membros/{usuarioId}/aprovar
func (h *ComunidadeHandler) Aprovar(w http.ResponseWriter, r *http.Request) {
	id, err := idFromPath(r)
	if err != nil {
		httpx.Error(w, "Id inválido.", 422)
		return
	}
	if !h.requireDono(w, r, id) {
		return
	}
	usuarioID, err := int64PathParam(r, "usuarioId")
	if err != nil {
		httpx.Error(w, "Id de usuário inválido.", 422)
		return
	}
	if err := h.repo.AddMembro(id, usuarioID); err != nil {
		httpx.Error(w, "Erro interno.", 500)
		return
	}
	httpx.Success(w, "Solicitação aprovada.", 200)
}

// Rejeitar handles DELETE /comunidades/{id}/membros/{usuarioId} — recusa
// uma solicitação pendente OU remove um membro já aceito (dono decide).
func (h *ComunidadeHandler) Rejeitar(w http.ResponseWriter, r *http.Request) {
	id, err := idFromPath(r)
	if err != nil {
		httpx.Error(w, "Id inválido.", 422)
		return
	}
	if !h.requireDono(w, r, id) {
		return
	}
	usuarioID, err := int64PathParam(r, "usuarioId")
	if err != nil {
		httpx.Error(w, "Id de usuário inválido.", 422)
		return
	}
	if err := h.repo.RemoverMembro(id, usuarioID); err != nil {
		httpx.Error(w, "Erro interno.", 500)
		return
	}
	httpx.Success(w, "Removido.", 200)
}
