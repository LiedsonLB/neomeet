package handlers

import (
	"net/http"

	"github.com/liedsonlb/resenha-patch/internal/httpx"
	"github.com/liedsonlb/resenha-patch/internal/livekit"
	"github.com/liedsonlb/resenha-patch/internal/middleware"
	"github.com/liedsonlb/resenha-patch/internal/models"
	"github.com/liedsonlb/resenha-patch/internal/repository"
)

// PainelHandler agrega dados "ao vivo" pra tela inicial (Dashboard.tsx) —
// hoje só a seção "O que está rolando agora?", que mostra os canais de voz
// com gente dentro, nas comunidades de que o usuário logado faz parte, pra
// ele entrar direto em vez de navegar comunidade por comunidade.
type PainelHandler struct {
	comunidadeRepo   *repository.ComunidadeRepository
	canalRepo        *repository.CanalRepository
	salaRepo         *repository.SalaRepository
	liveKitURL       string
	liveKitAPIKey    string
	liveKitAPISecret string
}

func NewPainelHandler(comunidadeRepo *repository.ComunidadeRepository, canalRepo *repository.CanalRepository, salaRepo *repository.SalaRepository, liveKitURL, apiKey, apiSecret string) *PainelHandler {
	return &PainelHandler{
		comunidadeRepo: comunidadeRepo, canalRepo: canalRepo, salaRepo: salaRepo,
		liveKitURL: liveKitURL, liveKitAPIKey: apiKey, liveKitAPISecret: apiSecret,
	}
}

// AtividadeAgora é um canal de voz atualmente com gente dentro, já com o
// nome da comunidade pra montar o card "🎮 Minecraft — Liedson + 4 amigos".
type AtividadeAgora struct {
	ComunidadeID     int64                     `json:"comunidade_id"`
	ComunidadeNome   string                    `json:"comunidade_nome"`
	ComunidadeIcone  *string                   `json:"comunidade_icone"`
	CanalID          int64                     `json:"canal_id"`
	CanalNome        string                    `json:"canal_nome"`
	CanalIcone       *string                   `json:"canal_icone"`
	TotalParticipantes int                     `json:"total_participantes"`
	Participantes    []models.ParticipanteInfo `json:"participantes"`
}

// Atividades handles GET /painel/atividades
func (h *PainelHandler) Atividades(w http.ResponseWriter, r *http.Request) {
	session := middleware.UserFromContext(r)
	if session == nil {
		httpx.Error(w, "Não autenticado.", 401)
		return
	}

	comunidades, err := h.comunidadeRepo.ListByUsuario(session.ID)
	if err != nil {
		httpx.Error(w, "Erro interno.", 500)
		return
	}

	out := []AtividadeAgora{}
	for _, com := range comunidades {
		// ListByUsuario não vem com o papel preenchido — só interessa
		// comunidade da qual a pessoa é de fato membro (dono ou membro);
		// "pendente" ainda não vê o que rola lá dentro.
		papel, err := h.comunidadeRepo.Papel(com.ID, session.ID)
		if err != nil || papel == models.PapelPendente || papel == "" {
			continue
		}
		canais, err := h.canalRepo.ListByComunidade(com.ID)
		if err != nil {
			continue
		}
		for _, canal := range canais {
			if canal.Tipo != models.CanalTipoVoz || canal.SalaID == nil {
				continue
			}
			sala, err := h.salaRepo.FindByID(*canal.SalaID)
			if err != nil {
				continue
			}
			participantes, err := livekit.ListParticipants(h.liveKitURL, h.liveKitAPIKey, h.liveKitAPISecret, sala.Codigo)
			if err != nil || len(participantes) == 0 {
				continue
			}
			out = append(out, AtividadeAgora{
				ComunidadeID:       com.ID,
				ComunidadeNome:     com.Nome,
				ComunidadeIcone:    com.IconeURL,
				CanalID:            canal.ID,
				CanalNome:          canal.Nome,
				CanalIcone:         canal.Icone,
				TotalParticipantes: len(participantes),
				Participantes:      participantes,
			})
		}
	}

	httpx.JSON(w, 200, out)
}
