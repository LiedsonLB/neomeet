package repository

import (
	"database/sql"
	"time"

	"github.com/liedsonlb/resenha-patch/internal/apperr"
	"github.com/liedsonlb/resenha-patch/internal/models"
)

type TokenRepository struct {
	db *sql.DB
}

func NewTokenRepository(db *sql.DB) *TokenRepository {
	return &TokenRepository{db: db}
}

// CreateOrReuse mirrors AplicacaoAcessoToken::createDefault: it reuses an
// existing active token for the same usuario+aplicacao+ip if it hasn't
// expired yet, otherwise creates a new one.
func (r *TokenRepository) CreateOrReuse(usuarioID, aplicacaoID int64, ip, token string) (*models.AplicacaoAcessoToken, error) {
	row := r.db.QueryRow(
		`SELECT id, token, ip, status, aplicacao_id, usuario_id, created_at, updated_at
		 FROM aplicacao_acesso_token
		 WHERE usuario_id = ? AND aplicacao_id = ? AND ip = ? AND status = ?
		 ORDER BY updated_at DESC LIMIT 1`,
		usuarioID, aplicacaoID, ip, models.StatusAtivo,
	)

	existing, err := scanToken(row)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}

	if existing != nil {
		limiteMin := models.TempoLimiteAPIMinutes
		if models.IsLongToken(existing.Token) {
			limiteMin = models.TempoLimiteLongoAPIMinutes
		}
		if existing.UpdatedAt != nil && time.Since(*existing.UpdatedAt) < time.Duration(limiteMin)*time.Minute {
			// reuse: just touch updated_at
			_, err := r.db.Exec("UPDATE aplicacao_acesso_token SET updated_at = NOW() WHERE id = ?", existing.ID)
			if err != nil {
				return nil, err
			}
			return r.findByID(existing.ID)
		}
	}

	res, err := r.db.Exec(
		`INSERT INTO aplicacao_acesso_token (token, ip, status, aplicacao_id, usuario_id, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
		token, ip, models.StatusAtivo, aplicacaoID, usuarioID,
	)
	if err != nil {
		return nil, err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}
	return r.findByID(id)
}

func (r *TokenRepository) findByID(id int64) (*models.AplicacaoAcessoToken, error) {
	row := r.db.QueryRow(
		`SELECT id, token, ip, status, aplicacao_id, usuario_id, created_at, updated_at
		 FROM aplicacao_acesso_token WHERE id = ? LIMIT 1`, id,
	)
	return scanToken(row)
}

func scanToken(row *sql.Row) (*models.AplicacaoAcessoToken, error) {
	t := &models.AplicacaoAcessoToken{}
	err := row.Scan(&t.ID, &t.Token, &t.IP, &t.Status, &t.AplicacaoID, &t.UsuarioID, &t.CreatedAt, &t.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, err
	}
	if err != nil {
		return nil, err
	}
	return t, nil
}

// Check mirrors AplicacaoAcessoToken::check($usuario_id, $token, $app_key):
// validates that the token exists, is active, belongs to the given user,
// and that the app_key matches the token's application code.
func (r *TokenRepository) Check(usuarioID int64, token string, appCodigo string) (*models.AplicacaoAcessoToken, error) {
	row := r.db.QueryRow(
		`SELECT id, token, ip, status, aplicacao_id, usuario_id, created_at, updated_at
		 FROM aplicacao_acesso_token
		 WHERE token = ? AND status = ? ORDER BY updated_at DESC LIMIT 1`,
		token, models.StatusAtivo,
	)
	t, err := scanToken(row)
	if err == sql.ErrNoRows {
		return nil, apperr.New("Acesso negado à API!", 403)
	}
	if err != nil {
		return nil, err
	}
	if t.UsuarioID != usuarioID {
		return nil, apperr.New("Acesso negado à API!", 403)
	}

	aplicacaoRepo := NewAplicacaoRepository(r.db)
	app, err := aplicacaoRepo.FindByID(t.AplicacaoID)
	if err != nil {
		return nil, err
	}
	if app == nil {
		return nil, apperr.New("Acesso negado à API!", 403)
	}
	if app.Codigo != appCodigoUpper(appCodigo) {
		return nil, apperr.New("Aplicação não liberada para este token!", 401)
	}

	limiteMin := models.TempoLimiteAPIMinutes
	if models.IsLongToken(token) {
		limiteMin = models.TempoLimiteLongoAPIMinutes
	}
	if t.UpdatedAt != nil && time.Since(*t.UpdatedAt) > time.Duration(limiteMin)*time.Minute {
		return nil, apperr.New("Token expirado, efetue login novamente!", 403)
	}

	return t, nil
}

func appCodigoUpper(s string) string {
	out := make([]rune, 0, len(s))
	for _, r := range s {
		if r >= 'a' && r <= 'z' {
			r = r - 'a' + 'A'
		}
		out = append(out, r)
	}
	return string(out)
}
