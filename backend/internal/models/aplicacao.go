package models

import "time"

// Aplicacao maps to the `aplicacao` table. Only the fields needed for the
// auth flow (validating the AppKey header and 2FA requirement) are modeled
// here; the full CRUD for this entity will be added in a later phase.
type Aplicacao struct {
	ID            int64  `json:"id" db:"id"`
	Nome          string `json:"nome" db:"nome"`
	Codigo        string `json:"codigo" db:"codigo"` // the "AppKey" header value
	Tipo          int    `json:"tipo" db:"tipo"`
	Versao        int    `json:"versao" db:"versao"`
	// SegurancaTipo int    `json:"seguranca_tipo" db:"seguranca_tipo"`
}

// SegurancaNormal mirrors Aplicacao::segurancaNormal() -- apps requiring
// 2-step verification cannot use the plain email/password login endpoint.
// func (a *Aplicacao) SegurancaNormal() bool { return a.SegurancaTipo == 0 }

// AplicacaoAcessoToken maps to `aplicacao_acesso_token`.
type AplicacaoAcessoToken struct {
	ID          int64      `json:"id" db:"id"`
	Token       string     `json:"token" db:"token"`
	IP          string     `json:"ip" db:"ip"`
	Status      int        `json:"status" db:"status"`
	AplicacaoID int64      `json:"aplicacao_id" db:"aplicacao_id"`
	UsuarioID   int64      `json:"usuario_id" db:"usuario_id"`
	CreatedAt   *time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   *time.Time `json:"updated_at" db:"updated_at"`
}

const (
	StatusAtivo   = 1
	StatusInativo = 0

	// TempoLimiteAPIMinutes / TempoLimiteLongoAPIMinutes mirror
	// Constantes::TEMPO_LIMITE_API / TEMPO_LIMITE_LONGO_API (in minutes).
	TempoLimiteAPIMinutes      = 120
	TempoLimiteLongoAPIMinutes = 60 * 24 * 30
)

// IsLongToken mirrors AplicacaoAcessoToken::isLongToken -- long-lived
// tokens are 64 chars, regular ones 32 (md5 length).
func IsLongToken(token string) bool { return len(token) == 64 }
