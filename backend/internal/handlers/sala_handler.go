package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/liedsonlb/resenha-patch/internal/httpx"
	"github.com/liedsonlb/resenha-patch/internal/livekit"
	"github.com/liedsonlb/resenha-patch/internal/middleware"
	"github.com/liedsonlb/resenha-patch/internal/models"
	"github.com/liedsonlb/resenha-patch/internal/realtime"
	"github.com/liedsonlb/resenha-patch/internal/repository"
)

type SalaHandler struct {
	repo             *repository.SalaRepository
	hub              *realtime.Hub
	liveKitAPIKey    string
	liveKitAPISecret string
	liveKitURL       string
	liveKitPublicURL string
}

func NewSalaHandler(
	repo *repository.SalaRepository,
	hub *realtime.Hub,
	apiKey, apiSecret, url, publicURL string,
) *SalaHandler {
	if publicURL == "" {
		publicURL = url
	}
	return &SalaHandler{
		repo: repo, hub: hub,
		liveKitAPIKey: apiKey, liveKitAPISecret: apiSecret,
		liveKitURL: url, liveKitPublicURL: publicURL,
	}
}

// All handles GET /salas — lista as salas ativas. Assim como no NeoMeet,
// qualquer usuário autenticado vê todas as salas abertas (não só as suas).
func (h *SalaHandler) All(w http.ResponseWriter, r *http.Request) {
	tipo := r.URL.Query().Get("tipo")
	list, err := h.repo.All(tipo, true)
	if err != nil {
		httpx.Error(w, "Erro interno.", 500)
		return
	}
	if list == nil {
		list = []*models.Sala{}
	}
	for _, s := range list {
		s.ParticipantesOnline = len(h.hub.Snapshot(s.ID))
	}
	httpx.JSON(w, 200, list)
}

func (h *SalaHandler) Find(w http.ResponseWriter, r *http.Request) {
	id, err := idFromPath(r)
	if err != nil {
		httpx.Error(w, "Id inválido.", 422)
		return
	}
	s, err := h.repo.FindByID(id)
	if err != nil {
		writeAppErr(w, err)
		return
	}
	s.ParticipantesOnline = len(h.hub.Snapshot(s.ID))
	httpx.JSON(w, 200, s)
}

type salaPayload struct {
	Nome      string  `json:"nome"`
	Tipo      string  `json:"tipo"` // reuniao | producao (producao mantido por compat, não usado no Resenha)
	Descricao *string `json:"descricao"`
	Categoria *string `json:"categoria"`
}

// Save handles POST /salas — qualquer usuário autenticado pode criar uma
// sala/comunidade (reunião em vídeo via LiveKit).
func (h *SalaHandler) Save(w http.ResponseWriter, r *http.Request) {
	var payload salaPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		httpx.Error(w, "Requisição inválida.", 422)
		return
	}
	session := middleware.UserFromContext(r)
	if session == nil {
		httpx.Error(w, "Não autenticado.", 401)
		return
	}
	if payload.Nome == "" {
		payload.Nome = fmt.Sprintf("Sala de %s - %s", session.Nome, time.Now().Format("02/01 15:04"))
	}
	if payload.Tipo == "" {
		payload.Tipo = "reuniao"
	}
	created, err := h.repo.Create(payload.Nome, payload.Tipo, payload.Descricao, payload.Categoria, session.ID)
	if err != nil {
		writeAppErr(w, err)
		return
	}
	httpx.JSON(w, 201, created)
}

// Encerrar handles POST /salas/{id}/encerrar — apenas quem criou a sala ou
// um admin pode encerrá-la.
func (h *SalaHandler) Encerrar(w http.ResponseWriter, r *http.Request) {
	id, err := idFromPath(r)
	if err != nil {
		httpx.Error(w, "Id inválido.", 422)
		return
	}
	sala, err := h.repo.FindByID(id)
	if err != nil {
		writeAppErr(w, err)
		return
	}
	session := middleware.UserFromContext(r)
	if session == nil || (!session.IsAdmin() && session.ID != sala.CriadoPor) {
		httpx.Error(w, "Você não tem permissão para encerrar essa sala.", 403)
		return
	}
	if err := h.repo.Encerrar(id); err != nil {
		httpx.Error(w, "Erro interno.", 500)
		return
	}
	h.hub.ClearSala(id)
	httpx.Success(w, "Sala encerrada.", 200)
}

// Entrar handles POST /salas/{id}/entrar — gera o token de acesso LiveKit
// (JWT) para o usuário autenticado entrar na room correspondente. Mesma
// ideia do token.controller.js do NeoMeet (AccessToken + addGrant), só que
// em Go e sem depender do SDK oficial (ver internal/livekit/token.go).
func (h *SalaHandler) Entrar(w http.ResponseWriter, r *http.Request) {
	id, err := idFromPath(r)
	if err != nil {
		httpx.Error(w, "Id inválido.", 422)
		return
	}
	sala, err := h.repo.FindByID(id)
	if err != nil {
		writeAppErr(w, err)
		return
	}
	if !sala.Ativa {
		httpx.Error(w, "Essa sala já foi encerrada.", 410)
		return
	}
	session := middleware.UserFromContext(r)
	if session == nil {
		httpx.Error(w, "Não autenticado.", 401)
		return
	}

	identity := fmt.Sprintf("%d", session.ID)
	// Dentro de Entrar(), antes de .Sign():
	metadataJSON := ""
	meta := map[string]string{"nome": session.Nome}
	if session.Foto != nil && *session.Foto != "" {
		meta["foto"] = *session.Foto
	}
	if session.Moldura != nil && *session.Moldura != "" {
		meta["moldura"] = *session.Moldura
	}
	if b, err := json.Marshal(meta); err == nil {
		metadataJSON = string(b)
	}

	token, err := livekit.NewTokenBuilder(h.liveKitAPIKey, h.liveKitAPISecret).
		Identity(identity).
		Name(session.Nome).
		Metadata(metadataJSON). // ← ADICIONAR ESTA LINHA
		TTL(4 * time.Hour).
		Grant(livekit.VideoGrant{
			RoomJoin:       true,
			Room:           sala.Codigo,
			CanPublish:     true,
			CanSubscribe:   true,
			CanPublishData: true,
		}).
		Sign()
	if err != nil {
		httpx.Error(w, err.Error(), 500)
		return
	}

	httpx.JSON(w, 200, map[string]any{
		"token": token,
		"url":   h.liveKitPublicURL,
		"room":  sala.Codigo,
		"sala":  sala,
	})
}

// ---------------------------------------------------------------------
// PROGRESSO EM TEMPO REAL (salas do tipo "producao")
// ---------------------------------------------------------------------

type progressoPayload struct {
	PassoAtual  int   `json:"passo_atual"`
	TotalPassos int   `json:"total_passos"`
	PerguntaID  int64 `json:"pergunta_id"`
	Concluido   bool  `json:"concluido"`

	// Campos extras usados pelo dashboard ao vivo do professor.
	MovimentoNome  string `json:"movimento_nome"`
	PerguntaTitulo string `json:"pergunta_titulo"`
	Digitando      bool   `json:"digitando"`
	TrechoAtual    string `json:"trecho_atual"`
}

// Progresso handles POST /salas/{id}/progresso — chamado pelo frontend do
// aluno a cada passo/pergunta respondida dentro de uma sala de produção.
// Publica o evento no hub, que repassa via SSE para quem estiver assistindo
// (o admin, em /salas/{id}/eventos).
func (h *SalaHandler) Progresso(w http.ResponseWriter, r *http.Request) {
	id, err := idFromPath(r)
	if err != nil {
		httpx.Error(w, "Id inválido.", 422)
		return
	}
	var payload progressoPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		httpx.Error(w, "Requisição inválida.", 422)
		return
	}
	session := middleware.UserFromContext(r)
	if session == nil {
		httpx.Error(w, "Não autenticado.", 401)
		return
	}

	h.hub.Publish(models.ProgressoEvento{
		Tipo:           models.EventoProgresso,
		SalaID:         id,
		UsuarioID:      session.ID,
		NomeUsuario:    session.Nome,
		Foto:           session.Foto,
		IsAdmin:        session.IsAdmin(),
		MovimentoNome:  payload.MovimentoNome,
		PerguntaTitulo: payload.PerguntaTitulo,
		Digitando:      payload.Digitando,
		TrechoAtual:    payload.TrechoAtual,
		PassoAtual:     payload.PassoAtual,
		TotalPassos:    payload.TotalPassos,
		PerguntaID:     payload.PerguntaID,
		Concluido:      payload.Concluido,
		AtualizadoEm:   time.Now(),
	})

	httpx.Success(w, "Progresso registrado.", 200)
}

// Eventos handles GET /salas/{id}/eventos — stream SSE com o progresso de
// todos os participantes da sala. Pensado para a tela de monitoramento do
// admin ("ver todo mundo produzindo em tempo real").
func (h *SalaHandler) Eventos(w http.ResponseWriter, r *http.Request) {
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

	flusher, ok := w.(http.Flusher)
	if !ok {
		httpx.Error(w, "Streaming não suportado.", 500)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.WriteHeader(http.StatusOK)

	writeEvent := func(ev models.ProgressoEvento) {
		body, _ := json.Marshal(ev)
		fmt.Fprintf(w, "data: %s\n\n", body)
		flusher.Flush()
	}

	// Estado atual primeiro, para quem abre a tela "no meio" da sala: quem
	// já está conectado (presença) e o último progresso conhecido de cada
	// um.
	for _, p := range h.hub.Participantes(id) {
		writeEvent(models.ProgressoEvento{
			Tipo: models.EventoEntrou, SalaID: id,
			UsuarioID: p.UsuarioID, NomeUsuario: p.NomeUsuario, Foto: p.Foto, IsAdmin: p.IsAdmin,
		})
	}
	for _, ev := range h.hub.Snapshot(id) {
		writeEvent(ev)
	}

	ch, unsubscribe := h.hub.Subscribe(id, realtime.Participante{
		UsuarioID: session.ID, NomeUsuario: session.Nome, Foto: session.Foto, IsAdmin: session.IsAdmin(),
	})
	defer unsubscribe()

	ctx := r.Context()
	keepAlive := time.NewTicker(20 * time.Second)
	defer keepAlive.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case ev, open := <-ch:
			if !open {
				return
			}
			writeEvent(ev)
		case <-keepAlive.C:
			fmt.Fprint(w, ": ping\n\n")
			flusher.Flush()
		}
	}
}

type iniciarProducaoPayload struct {
	GeneroTextualID int64  `json:"genero_textual_id"`
	TituloPrefixo   string `json:"titulo_prefixo"`
}

// IniciarProducao handles POST /salas/{id}/iniciar-producao — só o
// professor (admin) que criou a sala (ou outro admin) pode disparar. Cria
// uma producao_textual individual para cada aluno atualmente conectado ao
// canal SSE da sala (internal/realtime.Hub.Participantes — ou seja, quem
// está mesmo na videochamada agora, não "todo aluno cadastrado") e publica
// um evento "iniciar_producao" endereçado a cada um, para o front abrir
// automaticamente o painel de escrita dentro da sala.
func (h *SalaHandler) IniciarProducao(w http.ResponseWriter, r *http.Request) {
	id, err := idFromPath(r)
	if err != nil {
		httpx.Error(w, "Id inválido.", 422)
		return
	}
	sala, err := h.repo.FindByID(id)
	if err != nil {
		writeAppErr(w, err)
		return
	}
	session := middleware.UserFromContext(r)
	if session == nil || (!session.IsAdmin() && session.ID != sala.CriadoPor) {
		httpx.Error(w, "Você não tem permissão para iniciar a produção nessa sala.", 403)
		return
	}
	if sala.Tipo != models.SalaTipoProducao {
		httpx.Error(w, "Essa sala não é do tipo produção.", 422)
		return
	}

	var payload iniciarProducaoPayload
	_ = json.NewDecoder(r.Body).Decode(&payload)
	generoID := payload.GeneroTextualID
	if generoID == 0 && sala.GeneroTextualID != nil {
		generoID = *sala.GeneroTextualID
	}

	criadas := 0
	for _, p := range h.hub.Participantes(id) {
		if p.IsAdmin {
			continue // o professor não recebe produção
		}
		criadas++
		h.hub.Publish(models.ProgressoEvento{
			Tipo: models.EventoIniciarProducao, SalaID: id,
			UsuarioID: p.UsuarioID, NomeUsuario: p.NomeUsuario, Foto: p.Foto,
			TotalPassos: 0, AtualizadoEm: time.Now(),
		})
	}

	httpx.JSON(w, 200, map[string]any{"message": "Produção iniciada.", "alunos_notificados": criadas})
}
