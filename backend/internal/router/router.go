package router

import (
	"net/http"

	"github.com/liedsonlb/resenha-patch/internal/handlers"
	"github.com/liedsonlb/resenha-patch/internal/mailer"
	"github.com/liedsonlb/resenha-patch/internal/middleware"
	"github.com/liedsonlb/resenha-patch/internal/queue"
	"github.com/liedsonlb/resenha-patch/internal/realtime"
	"github.com/liedsonlb/resenha-patch/internal/repository"
)

type Deps struct {
	UsuarioRepo       *repository.UsuarioRepository
	AplicacaoRepo     *repository.AplicacaoRepository
	TokenRepo         *repository.TokenRepository
	CidadeRepo        *repository.CidadeRepository
	PasswordResetRepo *repository.PasswordResetRepository
	// REMOVIDO: EmailVerificationRepo *repository.EmailVerificationRepository
	AppName     string
	TokenKey    string
	AppKey      string
	FrontendURL string
	Mailer      *mailer.Mailer

	UploadDir string

	// ---- salas (LiveKit) + workers (RabbitMQ) --------------------------
	SalaRepo         *repository.SalaRepository
	RealtimeHub      *realtime.Hub
	Rabbit           *queue.RabbitMQ
	LiveKitAPIKey    string
	LiveKitAPISecret string
	LiveKitURL       string
	LiveKitPublicURL string

	// ---- Comunidades (estilo Discord: canais de texto/voz) -------------
	ComunidadeRepo    *repository.ComunidadeRepository
	CanalRepo         *repository.CanalRepository
	MensagemRepo      *repository.MensagemRepository
	ComunidadeSomRepo *repository.ComunidadeSomRepository

	// ---- Verificação de e-mail (tokens auto-validáveis) ----------------
	VerificationSecret string
}

func New(d Deps) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("Api Web Leia (Go)"))
	})

	auth := middleware.RequireAuth(d.UsuarioRepo, d.TokenRepo)

	// ---- acesso / cadastro (public) --------------------------------------
	login := handlers.NewLoginHandler(
		d.UsuarioRepo,
		d.AplicacaoRepo,
		d.TokenRepo,
		d.PasswordResetRepo,
		d.Mailer,
		d.Rabbit,
		d.FrontendURL,
		d.AppName,
		d.TokenKey,
		d.AppKey,
		d.VerificationSecret,
	)
	mux.HandleFunc("POST /acesso/login", login.Run)
	mux.HandleFunc("POST /acesso/check_token", login.CheckToken)
	// Chamado periodicamente (ou ao voltar o foco na aba) pelo frontend
	// para renovar a sessão automaticamente, sem exigir novo login.
	mux.HandleFunc("POST /acesso/refresh-token", login.RefreshToken)
	mux.HandleFunc("POST /acesso/esqueci-senha", login.EsqueciSenha)
	mux.HandleFunc("POST /acesso/redefinir-senha", login.RedefinirSenha)
	mux.HandleFunc("POST /acesso/confirmar-email", login.ConfirmarEmail)
	mux.HandleFunc("POST /acesso/reenviar-confirmacao", login.ReenviarConfirmacao)
	mux.HandleFunc("POST /cadastro", login.CadastroAluno)

	// ---- usuarios --------------------------------------------------------
	usuario := handlers.NewUsuarioHandler(d.UsuarioRepo, d.UploadDir)
	mux.Handle("GET /usuarios", auth(http.HandlerFunc(usuario.All)))
	mux.Handle("GET /usuarios/count", auth(http.HandlerFunc(usuario.Count)))
	mux.Handle("GET /usuarios/{id}", auth(http.HandlerFunc(usuario.Find)))
	mux.Handle("POST /usuarios", auth(http.HandlerFunc(usuario.Save)))
	mux.Handle("PUT /usuarios/{id}", auth(http.HandlerFunc(usuario.Update)))
	mux.Handle("DELETE /usuarios/{id}", auth(http.HandlerFunc(usuario.Delete)))
	mux.Handle("POST /usuarios/restore/{id}", auth(http.HandlerFunc(usuario.Restore)))
	mux.Handle("POST /usuarios/heartbeat", auth(http.HandlerFunc(usuario.Heartbeat)))
	mux.Handle("POST /usuarios/status", auth(http.HandlerFunc(usuario.Status)))

	// ---- uploads (fotos/banners de usuário, ícones/banners de comunidade,
	// sons do soundboard) --------------------------------------------------
	upload := handlers.NewUploadHandler(d.UploadDir)
	mux.Handle("POST /upload/foto", auth(http.HandlerFunc(upload.Foto)))
	mux.Handle("POST /upload/producao-imagem", auth(http.HandlerFunc(upload.ProducaoImagem)))
	mux.Handle("POST /upload/som", auth(http.HandlerFunc(upload.Som)))
	mux.Handle("GET /uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir(d.UploadDir))))

	// ---- salas (LiveKit) -----------------------------------------------
	sala := handlers.NewSalaHandler(d.SalaRepo, d.RealtimeHub, d.LiveKitAPIKey, d.LiveKitAPISecret, d.LiveKitURL, d.LiveKitPublicURL)
	mux.Handle("GET /salas", auth(http.HandlerFunc(sala.All)))
	mux.Handle("GET /salas/{id}", auth(http.HandlerFunc(sala.Find)))
	mux.Handle("POST /salas", auth(http.HandlerFunc(sala.Save)))
	mux.Handle("POST /salas/{id}/entrar", auth(http.HandlerFunc(sala.Entrar)))
	mux.Handle("POST /salas/{id}/encerrar", auth(http.HandlerFunc(sala.Encerrar)))
	mux.Handle("POST /salas/{id}/progresso", auth(http.HandlerFunc(sala.Progresso)))
	mux.Handle("POST /salas/{id}/iniciar-producao", auth(http.HandlerFunc(sala.IniciarProducao)))
	mux.Handle("GET /salas/{id}/eventos", auth(http.HandlerFunc(sala.Eventos)))

	// ---- comunidades (servidores estilo Discord) ------------------------
	comunidade := handlers.NewComunidadeHandler(d.ComunidadeRepo)
	mux.Handle("GET /comunidades", auth(http.HandlerFunc(comunidade.All)))
	mux.Handle("GET /comunidades/explorar", auth(http.HandlerFunc(comunidade.Explorar)))
	mux.Handle("GET /comunidades/{id}", auth(http.HandlerFunc(comunidade.Find)))
	mux.Handle("POST /comunidades", auth(http.HandlerFunc(comunidade.Save)))
	mux.Handle("PUT /comunidades/{id}", auth(http.HandlerFunc(comunidade.Update)))
	mux.Handle("DELETE /comunidades/{id}", auth(http.HandlerFunc(comunidade.Delete)))
	mux.Handle("POST /comunidades/{id}/entrar", auth(http.HandlerFunc(comunidade.Entrar)))
	mux.Handle("GET /comunidades/{id}/pendentes", auth(http.HandlerFunc(comunidade.Pendentes)))
	mux.Handle("GET /comunidades/{id}/membros", auth(http.HandlerFunc(comunidade.Membros)))
	mux.Handle("POST /comunidades/{id}/membros/{usuarioId}/aprovar", auth(http.HandlerFunc(comunidade.Aprovar)))
	mux.Handle("DELETE /comunidades/{id}/membros/{usuarioId}", auth(http.HandlerFunc(comunidade.Rejeitar)))

	// ---- canais (texto/voz) dentro de uma comunidade --------------------
	canal := handlers.NewCanalHandler(d.CanalRepo, d.ComunidadeRepo, d.SalaRepo, d.RealtimeHub, d.LiveKitAPIKey, d.LiveKitAPISecret, d.LiveKitURL)
	mux.Handle("GET /comunidades/{id}/canais", auth(http.HandlerFunc(canal.All)))
	mux.Handle("POST /comunidades/{id}/canais", auth(http.HandlerFunc(canal.Save)))
	mux.Handle("PATCH /canais/{id}", auth(http.HandlerFunc(canal.Update)))
	mux.Handle("DELETE /canais/{id}", auth(http.HandlerFunc(canal.Delete)))

	// ---- mensagens de um canal de texto ----------------------------------
	mensagem := handlers.NewMensagemHandler(d.MensagemRepo, d.CanalRepo, d.ComunidadeRepo)
	mux.Handle("GET /canais/{id}/mensagens", auth(http.HandlerFunc(mensagem.All)))
	mux.Handle("POST /canais/{id}/mensagens", auth(http.HandlerFunc(mensagem.Save)))
	mux.Handle("PUT /mensagens/{id}", auth(http.HandlerFunc(mensagem.Update)))
	mux.Handle("DELETE /mensagens/{id}", auth(http.HandlerFunc(mensagem.Delete)))

	// ---- soundboard de uma comunidade -------------------------------------
	som := handlers.NewComunidadeSomHandler(d.ComunidadeSomRepo, d.ComunidadeRepo)
	mux.Handle("GET /comunidades/{id}/sons", auth(http.HandlerFunc(som.All)))
	mux.Handle("POST /comunidades/{id}/sons", auth(http.HandlerFunc(som.Save)))
	mux.Handle("DELETE /sons/{id}", auth(http.HandlerFunc(som.Delete)))

	// ---- painel (home): "o que está rolando agora" -----------------------
	painel := handlers.NewPainelHandler(d.ComunidadeRepo, d.CanalRepo, d.SalaRepo, d.LiveKitURL, d.LiveKitAPIKey, d.LiveKitAPISecret)
	mux.Handle("GET /painel/atividades", auth(http.HandlerFunc(painel.Atividades)))

	return withCORS(mux)
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, AppKey, TokenUser")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
