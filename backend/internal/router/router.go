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
	UsuarioRepo                 *repository.UsuarioRepository
	AplicacaoRepo               *repository.AplicacaoRepository
	TokenRepo                   *repository.TokenRepository
	CidadeRepo                  *repository.CidadeRepository
	PasswordResetRepo           *repository.PasswordResetRepository
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
		d.VerificationSecret, // NOVO PARÂMETRO
	)
	mux.HandleFunc("POST /acesso/login", login.Run)
	mux.HandleFunc("POST /acesso/check_token", login.CheckToken)
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

	// ---- salas (LiveKit) -----------------------------------------------
	sala := handlers.NewSalaHandler(d.SalaRepo, d.RealtimeHub, d.LiveKitAPIKey, d.LiveKitAPISecret, d.LiveKitURL)
	mux.Handle("GET /salas", auth(http.HandlerFunc(sala.All)))
	mux.Handle("GET /salas/{id}", auth(http.HandlerFunc(sala.Find)))
	mux.Handle("POST /salas", auth(http.HandlerFunc(sala.Save)))
	mux.Handle("POST /salas/{id}/entrar", auth(http.HandlerFunc(sala.Entrar)))
	mux.Handle("POST /salas/{id}/encerrar", auth(http.HandlerFunc(sala.Encerrar)))
	mux.Handle("POST /salas/{id}/progresso", auth(http.HandlerFunc(sala.Progresso)))
	mux.Handle("POST /salas/{id}/iniciar-producao", auth(http.HandlerFunc(sala.IniciarProducao)))
	mux.Handle("GET /salas/{id}/eventos", auth(http.HandlerFunc(sala.Eventos)))

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
