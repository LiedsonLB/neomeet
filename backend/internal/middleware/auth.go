package middleware

import (
	"context"
	"net/http"
	"strconv"
	"strings"

	"github.com/liedsonlb/resenha-patch/internal/apperr"
	"github.com/liedsonlb/resenha-patch/internal/httpx"
	"github.com/liedsonlb/resenha-patch/internal/models"
	"github.com/liedsonlb/resenha-patch/internal/repository"
)

type ctxKey string

const userCtxKey ctxKey = "usuario_session"

// RequireAuth mirrors ApiController's `$this->middleware('auth')`: it reads
// the `TokenUser` header (format "userId:token:appKey", same as the mobile
// app already sends) and validates it against aplicacao_acesso_token.
func RequireAuth(usuarioRepo *repository.UsuarioRepository, tokenRepo *repository.TokenRepository) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			parts := strings.Split(r.Header.Get("TokenUser"), ":")
			if len(parts) < 3 {
				httpx.Error(w, "Token inválido!", 401)
				return
			}

			userID, err := strconv.ParseInt(parts[0], 10, 64)
			token := parts[1]
			appKey := parts[2]
			if err != nil || userID <= 0 || token == "" || appKey == "" {
				httpx.Error(w, "Token inválido!", 401)
				return
			}

			if _, err := tokenRepo.Check(userID, token, appKey); err != nil {
				if ae, ok := apperr.As(err); ok {
					httpx.Error(w, ae.Message, ae.Status)
				} else {
					httpx.Error(w, "Erro ao validar token.", 500)
				}
				return
			}

			usuario, err := usuarioRepo.FindByID(userID, false)
			if err != nil {
				httpx.Error(w, "Usuário não encontrado(a)!", 404)
				return
			}

			ctx := context.WithValue(r.Context(), userCtxKey, usuario)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequireAdmin mirrors the `if(!$this->userSession->is_admin) throw ...`
// guards sprinkled through the Laravel controllers (GrauInstrucaoController,
// InstituicaoEnsinoController, GeneroTextualController's publish endpoints,
// etc). Must be chained after RequireAuth.
func RequireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		u := UserFromContext(r)
		if u == nil || !u.IsAdmin() {
			httpx.Error(w, "Você não tem permissão para acessar esse recurso.", 403)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// UserFromContext mirrors ApiController::getUserSession()
func UserFromContext(r *http.Request) *models.Usuario {
	u, _ := r.Context().Value(userCtxKey).(*models.Usuario)
	return u
}
