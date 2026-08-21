package repository

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/liedsonlb/resenha-patch/internal/apperr"
	"github.com/liedsonlb/resenha-patch/internal/models"
)

type ComunidadeRepository struct {
	db *sql.DB
}

func NewComunidadeRepository(db *sql.DB) *ComunidadeRepository {
	return &ComunidadeRepository{db: db}
}

const comunidadeColumns = "id, nome, descricao, icone_url, banner_url, criado_por, created_at, updated_at, deleted_at"

func scanComunidade(row interface{ Scan(...any) error }) (*models.Comunidade, error) {
	c := &models.Comunidade{}
	err := row.Scan(&c.ID, &c.Nome, &c.Descricao, &c.IconeURL, &c.BannerURL, &c.CriadoPor,
		&c.CreatedAt, &c.UpdatedAt, &c.DeletedAt)
	if err != nil {
		return nil, err
	}
	return c, nil
}

// Create cria a comunidade e já registra quem criou como "dono" em
// comunidade_membro, numa única transação.
func (r *ComunidadeRepository) Create(nome string, descricao, iconeURL, bannerURL *string, criadoPor int64) (*models.Comunidade, error) {
	if nome == "" {
		return nil, apperr.New("O nome da comunidade é obrigatório.", 422)
	}
	tx, err := r.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	res, err := tx.Exec(
		`INSERT INTO comunidade (nome, descricao, icone_url, banner_url, criado_por, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
		nome, descricao, iconeURL, bannerURL, criadoPor,
	)
	if err != nil {
		return nil, err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}
	if _, err := tx.Exec(
		`INSERT INTO comunidade_membro (comunidade_id, usuario_id, papel, created_at) VALUES (?, ?, ?, NOW())`,
		id, criadoPor, models.PapelDono,
	); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return r.FindByID(id)
}

func (r *ComunidadeRepository) FindByID(id int64) (*models.Comunidade, error) {
	row := r.db.QueryRow(fmt.Sprintf("SELECT %s FROM comunidade WHERE id = ? AND deleted_at IS NULL LIMIT 1", comunidadeColumns), id)
	c, err := scanComunidade(row)
	if err == sql.ErrNoRows {
		return nil, apperr.New("Comunidade não encontrada!", 404)
	}
	if err != nil {
		return nil, err
	}
	return c, nil
}

// ListByUsuario lista as comunidades das quais o usuário é membro (dono ou
// convidado), ordenadas pela mais recente — usadas na rail de servidores.
func (r *ComunidadeRepository) ListByUsuario(usuarioID int64) ([]*models.Comunidade, error) {
	query := fmt.Sprintf(`
		SELECT %s FROM comunidade c
		INNER JOIN comunidade_membro m ON m.comunidade_id = c.id
		WHERE m.usuario_id = ? AND c.deleted_at IS NULL
		ORDER BY c.created_at DESC`,
		prefixColumns("c", comunidadeColumns))
	rows, err := r.db.Query(query, usuarioID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*models.Comunidade
	for rows.Next() {
		c, err := scanComunidade(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// FindAll retorna TODAS as comunidades (públicas) - usado para o dashboard
func (r *ComunidadeRepository) FindAll(ctx context.Context) ([]*models.Comunidade, error) {
	query := fmt.Sprintf(`
		SELECT %s FROM comunidade
		WHERE deleted_at IS NULL
		ORDER BY created_at DESC`, comunidadeColumns)
	
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*models.Comunidade
	for rows.Next() {
		c, err := scanComunidade(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// FindMembro verifica se o usuário é membro da comunidade
func (r *ComunidadeRepository) FindMembro(ctx context.Context, comunidadeID, usuarioID int64) (*models.ComunidadeMembro, error) {
	var membro models.ComunidadeMembro
	query := `SELECT id, comunidade_id, usuario_id, papel, created_at 
	          FROM comunidade_membro 
	          WHERE comunidade_id = ? AND usuario_id = ?`
	err := r.db.QueryRowContext(ctx, query, comunidadeID, usuarioID).Scan(
		&membro.ID, &membro.ComunidadeID, &membro.UsuarioID, &membro.Papel, &membro.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &membro, nil
}

// CountMembros conta o total de membros de uma comunidade
func (r *ComunidadeRepository) CountMembros(ctx context.Context, comunidadeID int64) (int, error) {
	var count int
	err := r.db.QueryRowContext(ctx, 
		`SELECT COUNT(*) FROM comunidade_membro WHERE comunidade_id = ?`, 
		comunidadeID,
	).Scan(&count)
	return count, err
}

// Papel devolve o papel do usuário na comunidade ("dono"/"membro") ou "" se
// ele não for membro.
func (r *ComunidadeRepository) Papel(comunidadeID, usuarioID int64) (string, error) {
	var papel string
	err := r.db.QueryRow(
		`SELECT papel FROM comunidade_membro WHERE comunidade_id = ? AND usuario_id = ? LIMIT 1`,
		comunidadeID, usuarioID,
	).Scan(&papel)
	if err == sql.ErrNoRows {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return papel, nil
}

// AddMembro adiciona (ou reafirma) um usuário como membro comum da
// comunidade — usado por Entrar(). Não sobrescreve o papel de "dono".
func (r *ComunidadeRepository) AddMembro(comunidadeID, usuarioID int64) error {
	_, err := r.db.Exec(
		`INSERT INTO comunidade_membro (comunidade_id, usuario_id, papel, created_at)
		 VALUES (?, ?, ?, NOW())
		 ON DUPLICATE KEY UPDATE usuario_id = usuario_id`,
		comunidadeID, usuarioID, models.PapelMembro,
	)
	return err
}

func (r *ComunidadeRepository) TotalMembros(comunidadeID int64) (int, error) {
	var total int
	err := r.db.QueryRow(`SELECT COUNT(id) FROM comunidade_membro WHERE comunidade_id = ?`, comunidadeID).Scan(&total)
	return total, err
}

type ComunidadeUpdate struct {
	Nome      *string
	Descricao *string
	IconeURL  *string
	BannerURL *string
}

func (r *ComunidadeRepository) Update(id int64, u ComunidadeUpdate) (*models.Comunidade, error) {
	existing, err := r.FindByID(id)
	if err != nil {
		return nil, err
	}
	if u.Nome != nil && *u.Nome != "" {
		existing.Nome = *u.Nome
	}
	if u.Descricao != nil {
		existing.Descricao = u.Descricao
	}
	if u.IconeURL != nil {
		existing.IconeURL = u.IconeURL
	}
	if u.BannerURL != nil {
		existing.BannerURL = u.BannerURL
	}
	_, err = r.db.Exec(
		`UPDATE comunidade SET nome = ?, descricao = ?, icone_url = ?, banner_url = ?, updated_at = NOW() WHERE id = ?`,
		existing.Nome, existing.Descricao, existing.IconeURL, existing.BannerURL, id,
	)
	if err != nil {
		return nil, err
	}
	return r.FindByID(id)
}

func (r *ComunidadeRepository) SoftDelete(id int64) error {
	res, err := r.db.Exec("UPDATE comunidade SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL", id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return apperr.New("Comunidade não encontrada!", 404)
	}
	return nil
}

// prefixColumns prefixa cada coluna de uma lista "a, b, c" com um alias de
// tabela, virando "t.a, t.b, t.c" — só pra reaproveitar comunidadeColumns
// nos JOINs sem duplicar a lista de campos.
func prefixColumns(alias, columns string) string {
	parts := strings.Split(columns, ",")
	for i, p := range parts {
		parts[i] = alias + "." + strings.TrimSpace(p)
	}
	return strings.Join(parts, ", ")
}