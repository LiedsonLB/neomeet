package repository

import (
	"database/sql"

	"github.com/liedsonlb/resenha-patch/internal/apperr"
	"github.com/liedsonlb/resenha-patch/internal/models"
)

type ComunidadeSomRepository struct {
	db *sql.DB
}

func NewComunidadeSomRepository(db *sql.DB) *ComunidadeSomRepository {
	return &ComunidadeSomRepository{db: db}
}

func (r *ComunidadeSomRepository) ListByComunidade(comunidadeID int64) ([]*models.ComunidadeSom, error) {
	rows, err := r.db.Query(
		`SELECT id, comunidade_id, nome, emoji, arquivo_url, criado_por, created_at
		 FROM comunidade_som WHERE comunidade_id = ? ORDER BY created_at ASC`,
		comunidadeID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*models.ComunidadeSom
	for rows.Next() {
		s := &models.ComunidadeSom{}
		if err := rows.Scan(&s.ID, &s.ComunidadeID, &s.Nome, &s.Emoji, &s.ArquivoURL, &s.CriadoPor, &s.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

func (r *ComunidadeSomRepository) Create(comunidadeID int64, nome string, emoji *string, arquivoURL string, criadoPor int64) (*models.ComunidadeSom, error) {
	if nome == "" {
		return nil, apperr.New("Dê um nome para o som.", 422)
	}
	total, err := r.count(comunidadeID)
	if err != nil {
		return nil, err
	}
	if total >= 24 {
		return nil, apperr.New("Essa comunidade já tem o máximo de 24 sons no soundboard.", 422)
	}
	res, err := r.db.Exec(
		`INSERT INTO comunidade_som (comunidade_id, nome, emoji, arquivo_url, criado_por, created_at) VALUES (?, ?, ?, ?, ?, NOW())`,
		comunidadeID, nome, emoji, arquivoURL, criadoPor,
	)
	if err != nil {
		return nil, err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}
	return r.FindByID(id)
}

func (r *ComunidadeSomRepository) count(comunidadeID int64) (int, error) {
	var total int
	err := r.db.QueryRow(`SELECT COUNT(id) FROM comunidade_som WHERE comunidade_id = ?`, comunidadeID).Scan(&total)
	return total, err
}

func (r *ComunidadeSomRepository) FindByID(id int64) (*models.ComunidadeSom, error) {
	row := r.db.QueryRow(
		`SELECT id, comunidade_id, nome, emoji, arquivo_url, criado_por, created_at FROM comunidade_som WHERE id = ? LIMIT 1`, id,
	)
	s := &models.ComunidadeSom{}
	err := row.Scan(&s.ID, &s.ComunidadeID, &s.Nome, &s.Emoji, &s.ArquivoURL, &s.CriadoPor, &s.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, apperr.New("Som não encontrado!", 404)
	}
	if err != nil {
		return nil, err
	}
	return s, nil
}

func (r *ComunidadeSomRepository) Delete(id int64) error {
	res, err := r.db.Exec(`DELETE FROM comunidade_som WHERE id = ?`, id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return apperr.New("Som não encontrado!", 404)
	}
	return nil
}
