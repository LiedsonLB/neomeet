package repository

import (
	"database/sql"
	"fmt"

	"github.com/liedsonlb/resenha-patch/internal/apperr"
	"github.com/liedsonlb/resenha-patch/internal/models"
)

type CanalRepository struct {
	db *sql.DB
}

func NewCanalRepository(db *sql.DB) *CanalRepository {
	return &CanalRepository{db: db}
}

const canalColumns = "id, comunidade_id, nome, icone, tipo, posicao, sala_id, created_at, updated_at, deleted_at"

func scanCanal(row interface{ Scan(...any) error }) (*models.Canal, error) {
	c := &models.Canal{}
	err := row.Scan(&c.ID, &c.ComunidadeID, &c.Nome, &c.Icone, &c.Tipo, &c.Posicao, &c.SalaID,
		&c.CreatedAt, &c.UpdatedAt, &c.DeletedAt)
	if err != nil {
		return nil, err
	}
	return c, nil
}

// Create insere um canal. salaID vem preenchido pelo handler quando
// tipo=="voz" (depois de criar a Sala/LiveKit correspondente).
func (r *CanalRepository) Create(comunidadeID int64, nome, tipo string, salaID *int64, icone *string) (*models.Canal, error) {
	if nome == "" {
		return nil, apperr.New("O nome do canal é obrigatório.", 422)
	}
	if tipo != models.CanalTipoTexto && tipo != models.CanalTipoVoz {
		tipo = models.CanalTipoTexto
	}
	var posicao int
	_ = r.db.QueryRow(`SELECT COALESCE(MAX(posicao), -1) + 1 FROM canal WHERE comunidade_id = ? AND tipo = ?`, comunidadeID, tipo).Scan(&posicao)

	res, err := r.db.Exec(
		`INSERT INTO canal (comunidade_id, nome, icone, tipo, posicao, sala_id, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
		comunidadeID, nome, icone, tipo, posicao, salaID,
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

func (r *CanalRepository) FindByID(id int64) (*models.Canal, error) {
	row := r.db.QueryRow(fmt.Sprintf("SELECT %s FROM canal WHERE id = ? AND deleted_at IS NULL LIMIT 1", canalColumns), id)
	c, err := scanCanal(row)
	if err == sql.ErrNoRows {
		return nil, apperr.New("Canal não encontrado!", 404)
	}
	if err != nil {
		return nil, err
	}
	return c, nil
}

func (r *CanalRepository) ListByComunidade(comunidadeID int64) ([]*models.Canal, error) {
	query := fmt.Sprintf(
		"SELECT %s FROM canal WHERE comunidade_id = ? AND deleted_at IS NULL ORDER BY tipo, posicao, id",
		canalColumns,
	)
	rows, err := r.db.Query(query, comunidadeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*models.Canal
	for rows.Next() {
		c, err := scanCanal(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (r *CanalRepository) Update(id int64, nome string, icone *string) (*models.Canal, error) {
	_, err := r.db.Exec(
		`UPDATE canal SET nome = ?, icone = ?, updated_at = NOW() WHERE id = ? AND deleted_at IS NULL`,
		nome, icone, id,
	)
	if err != nil {
		return nil, err
	}
	return r.FindByID(id)
}

func (r *CanalRepository) SoftDelete(id int64) error {
	res, err := r.db.Exec("UPDATE canal SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL", id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return apperr.New("Canal não encontrado!", 404)
	}
	return nil
}
