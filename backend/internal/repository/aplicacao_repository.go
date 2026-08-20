package repository

import (
	"database/sql"
	"strings"

	"github.com/liedsonlb/resenha-patch/internal/models"
)

type AplicacaoRepository struct {
	db *sql.DB
}

func NewAplicacaoRepository(db *sql.DB) *AplicacaoRepository {
	return &AplicacaoRepository{db: db}
}

// FindByCodigo mirrors AplicacaoRepository::check($app_key) -- looks up the
// `aplicacao` row by its `codigo` column (the AppKey header value),
// case-insensitively, matching the original comparison
// `strtoupper($app_key) != $ob->aplicacao->codigo`.
func (r *AplicacaoRepository) FindByCodigo(codigo string) (*models.Aplicacao, error) {
	codigo = strings.ToUpper(strings.TrimSpace(codigo))
	if codigo == "" {
		return nil, nil
	}
	row := r.db.QueryRow(
		"SELECT id, nome, codigo, tipo, versao FROM aplicacao WHERE UPPER(codigo) = ? AND deleted_at IS NULL LIMIT 1",
		codigo,
	)
	a := &models.Aplicacao{}
	err := row.Scan(&a.ID, &a.Nome, &a.Codigo, &a.Tipo, &a.Versao)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return a, nil
}

func (r *AplicacaoRepository) FindByID(id int64) (*models.Aplicacao, error) {
	row := r.db.QueryRow(
		"SELECT id, nome, codigo, tipo, versao FROM aplicacao WHERE id = ? AND deleted_at IS NULL LIMIT 1",
		id,
	)
	a := &models.Aplicacao{}
	err := row.Scan(&a.ID, &a.Nome, &a.Codigo, &a.Tipo, &a.Versao)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return a, nil
}
