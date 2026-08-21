package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/liedsonlb/resenha-patch/internal/httpx"
	"github.com/liedsonlb/resenha-patch/internal/middleware"
	"github.com/liedsonlb/resenha-patch/internal/models"
	"github.com/liedsonlb/resenha-patch/internal/repository"
)

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

// All handles GET /comunidades — lista TODAS as comunidades (públicas)
// para o dashboard, incluindo as que o usuário não é membro.
func (h *ComunidadeHandler) All(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	
	// Pega o usuário da sessão
	session := middleware.UserFromContext(r)
	if session == nil {
		httpx.Error(w, "Não autenticado.", 401)
		return
	}
	
	// Busca TODAS as comunidades (públicas)
	comunidades, err := h.repo.FindAll(ctx)
	if err != nil {
		httpx.Error(w, "Erro ao carregar comunidades: "+err.Error(), 500)
		return
	}
	
	// Para cada comunidade, verifica se o usuário é membro e qual o papel
	for _, comunidade := range comunidades {
		// Verifica se o usuário é membro
		membro, err := h.repo.FindMembro(ctx, comunidade.ID, session.ID)
		if err == nil && membro != nil {
			comunidade.Papel = membro.Papel
		} else {
			// Se não for membro, define como vazio (acesso público)
			comunidade.Papel = ""
		}
		
		// Conta membros
		total, _ := h.repo.CountMembros(ctx, comunidade.ID)
		comunidade.TotalMembros = total
	}
	
	httpx.JSON(w, 200, comunidades)
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
	Nome      string  `json:"nome"`
	Descricao *string `json:"descricao"`
	IconeURL  *string `json:"icone_url"`
	BannerURL *string `json:"banner_url"`
}

// Save handles POST /comunidades — qualquer usuário autenticado pode criar
// a sua própria comunidade (vira "dono" automaticamente).
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
	created, err := h.repo.Create(payload.Nome, payload.Descricao, payload.IconeURL, payload.BannerURL, session.ID)
	if err != nil {
		writeAppErr(w, err)
		return
	}
	h.enrich(created, session.ID)
	httpx.JSON(w, 201, created)
}

// requireDono garante que a sessão atual é o dono da comunidade — usado
// por Update/Delete/criação e remoção de canal.
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

// Update handles PUT /comunidades/{id} — editar nome/descrição/ícone/banner.
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
		Nome: nome, Descricao: payload.Descricao, IconeURL: payload.IconeURL, BannerURL: payload.BannerURL,
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
// apagar. Os canais e vínculos de membro somem em cascata (FK ON DELETE
// CASCADE); as `sala` ligadas aos canais de voz continuam existindo, só
// perdem o vínculo (ON DELETE SET NULL), sem quebrar nada.
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

// Entrar handles POST /comunidades/{id}/entrar — qualquer usuário
// autenticado pode entrar numa comunidade existente (link direto/convite).
func (h *ComunidadeHandler) Entrar(w http.ResponseWriter, r *http.Request) {
	id, err := idFromPath(r)
	if err != nil {
		httpx.Error(w, "Id inválido.", 422)
		return
	}
	if _, err := h.repo.FindByID(id); err != nil {
		writeAppErr(w, err)
		return
	}
	session := middleware.UserFromContext(r)
	if session == nil {
		httpx.Error(w, "Não autenticado.", 401)
		return
	}
	if err := h.repo.AddMembro(id, session.ID); err != nil {
		httpx.Error(w, "Erro interno.", 500)
		return
	}
	httpx.Success(w, "Você entrou na comunidade.", 200)
}