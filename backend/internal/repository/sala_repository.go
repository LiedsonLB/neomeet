package repository

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"fmt"

	"github.com/liedsonlb/resenha-patch/internal/apperr"
	"github.com/liedsonlb/resenha-patch/internal/models"
)

type SalaRepository struct {
	db *sql.DB
}

func NewSalaRepository(db *sql.DB) *SalaRepository {
	return &SalaRepository{db: db}
}

const salaColumns = "id, nome, codigo, tipo, descricao, categoria, genero_textual_id, criado_por, ativa, created_at, updated_at, deleted_at"

func scanSala(row interface{ Scan(...any) error }) (*models.Sala, error) {
	s := &models.Sala{}
	err := row.Scan(&s.ID, &s.Nome, &s.Codigo, &s.Tipo, &s.Descricao, &s.Categoria, &s.GeneroTextualID, &s.CriadoPor, &s.Ativa,
		&s.CreatedAt, &s.UpdatedAt, &s.DeletedAt)
	if err != nil {
		return nil, err
	}
	return s, nil
}

func randomCodigo() (string, error) {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// All lista as salas ativas (não deletadas).
func (r *SalaRepository) All(tipo string, onlyAtivas bool) ([]*models.Sala, error) {
	where := "deleted_at IS NULL"
	args := []any{}
	if tipo != "" {
		where += " AND tipo = ?"
		args = append(args, tipo)
	}
	if onlyAtivas {
		where += " AND ativa = 1"
	}
	rows, err := r.db.Query(fmt.Sprintf("SELECT %s FROM sala WHERE %s ORDER BY created_at DESC", salaColumns, where), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*models.Sala
	for rows.Next() {
		s, err := scanSala(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

func (r *SalaRepository) FindByID(id int64) (*models.Sala, error) {
	row := r.db.QueryRow(fmt.Sprintf("SELECT %s FROM sala WHERE id = ? AND deleted_at IS NULL LIMIT 1", salaColumns), id)
	s, err := scanSala(row)
	if err == sql.ErrNoRows {
		return nil, apperr.New("Sala não encontrada!", 404)
	}
	if err != nil {
		return nil, err
	}
	return s, nil
}

func (r *SalaRepository) FindByCodigo(codigo string) (*models.Sala, error) {
	row := r.db.QueryRow(fmt.Sprintf("SELECT %s FROM sala WHERE codigo = ? AND deleted_at IS NULL LIMIT 1", salaColumns), codigo)
	s, err := scanSala(row)
	if err == sql.ErrNoRows {
		return nil, apperr.New("Sala não encontrada!", 404)
	}
	if err != nil {
		return nil, err
	}
	return s, nil
}

// Create cria uma sala/comunidade. generoTextualID é mantido apenas por
// compatibilidade com o schema antigo e não é mais usado pelo Resenha
// (sempre nil aqui).
func (r *SalaRepository) Create(nome, tipo string, descricao, categoria *string, criadoPor int64) (*models.Sala, error) {
	if nome == "" {
		return nil, apperr.New("Nome da sala é obrigatório.", 422)
	}
	if tipo != models.SalaTipoReuniao && tipo != models.SalaTipoProducao {
		tipo = models.SalaTipoReuniao
	}
	codigo, err := randomCodigo()
	if err != nil {
		return nil, err
	}

	res, err := r.db.Exec(
		`INSERT INTO sala (nome, codigo, tipo, descricao, categoria, criado_por, ativa, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
		nome, codigo, tipo, descricao, categoria, criadoPor,
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

// Encerrar marca a sala como inativa.
func (r *SalaRepository) Encerrar(id int64) error {
	_, err := r.db.Exec("UPDATE sala SET ativa = 0, updated_at = NOW() WHERE id = ?", id)
	return err
}

func (r *SalaRepository) SoftDelete(id int64) error {
	_, err := r.db.Exec("UPDATE sala SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL", id)
	return err
}
