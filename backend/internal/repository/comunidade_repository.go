package repository

import (
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

const comunidadeColumns = "id, nome, descricao, visibilidade, icone_url, banner_url, criado_por, created_at, updated_at, deleted_at"

func scanComunidade(row interface{ Scan(...any) error }) (*models.Comunidade, error) {
	c := &models.Comunidade{}
	err := row.Scan(&c.ID, &c.Nome, &c.Descricao, &c.Visibilidade, &c.IconeURL, &c.BannerURL, &c.CriadoPor,
		&c.CreatedAt, &c.UpdatedAt, &c.DeletedAt)
	if err != nil {
		return nil, err
	}
	return c, nil
}

// Create cria a comunidade e já registra quem criou como "dono" em
// comunidade_membro, numa única transação.
func (r *ComunidadeRepository) Create(nome string, descricao, iconeURL, bannerURL *string, visibilidade string, criadoPor int64) (*models.Comunidade, error) {
	if nome == "" {
		return nil, apperr.New("O nome da comunidade é obrigatório.", 422)
	}
	if visibilidade != models.VisibilidadePrivada {
		visibilidade = models.VisibilidadePublica
	}
	tx, err := r.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	res, err := tx.Exec(
		`INSERT INTO comunidade (nome, descricao, visibilidade, icone_url, banner_url, criado_por, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
		nome, descricao, visibilidade, iconeURL, bannerURL, criadoPor,
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

// ListByUsuario lista as comunidades das quais o usuário é membro OU tem
// solicitação pendente (dono, membro ou pendente) — "Minhas comunidades".
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

// ListExplorar lista comunidades PÚBLICAS das quais o usuário ainda NÃO faz
// parte (nem como membro, nem como pendente) — usada na aba "Explorar
// comunidades" e na seção "Descobrir" do Dashboard.
func (r *ComunidadeRepository) ListExplorar(usuarioID int64) ([]*models.Comunidade, error) {
	query := fmt.Sprintf(`
		SELECT %s FROM comunidade c
		WHERE c.deleted_at IS NULL
		  AND c.visibilidade = '%s'
		  AND NOT EXISTS (
		    SELECT 1 FROM comunidade_membro m WHERE m.comunidade_id = c.id AND m.usuario_id = ?
		  )
		ORDER BY c.created_at DESC`,
		comunidadeColumns, models.VisibilidadePublica)
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

// Papel devolve o papel do usuário na comunidade ("dono"/"membro"/"pendente")
// ou "" se ele não tem nenhum vínculo.
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

// SolicitarEntrada é chamado quando alguém clica pra entrar numa
// comunidade: se ela for pública, vira membro na hora; se for privada,
// cria uma solicitação "pendente" que o dono precisa aprovar. Devolve o
// papel resultante ("membro" ou "pendente").
func (r *ComunidadeRepository) SolicitarEntrada(comunidadeID, usuarioID int64) (string, error) {
	comunidade, err := r.FindByID(comunidadeID)
	if err != nil {
		return "", err
	}
	papelAtual, err := r.Papel(comunidadeID, usuarioID)
	if err != nil {
		return "", err
	}
	if papelAtual == models.PapelDono || papelAtual == models.PapelMembro {
		return papelAtual, nil
	}

	papel := models.PapelMembro
	if comunidade.Visibilidade == models.VisibilidadePrivada {
		papel = models.PapelPendente
	}
	_, err = r.db.Exec(
		`INSERT INTO comunidade_membro (comunidade_id, usuario_id, papel, created_at)
		 VALUES (?, ?, ?, NOW())
		 ON DUPLICATE KEY UPDATE papel = VALUES(papel)`,
		comunidadeID, usuarioID, papel,
	)
	if err != nil {
		return "", err
	}
	return papel, nil
}

// AddMembro adiciona (ou reafirma) um usuário como membro comum direto —
// usado ao aprovar uma solicitação pendente.
func (r *ComunidadeRepository) AddMembro(comunidadeID, usuarioID int64) error {
	_, err := r.db.Exec(
		`INSERT INTO comunidade_membro (comunidade_id, usuario_id, papel, created_at)
		 VALUES (?, ?, ?, NOW())
		 ON DUPLICATE KEY UPDATE papel = VALUES(papel)`,
		comunidadeID, usuarioID, models.PapelMembro,
	)
	return err
}

// RemoverMembro tira o vínculo (usado tanto pra recusar uma solicitação
// pendente quanto pra remover/banir um membro).
func (r *ComunidadeRepository) RemoverMembro(comunidadeID, usuarioID int64) error {
	_, err := r.db.Exec(`DELETE FROM comunidade_membro WHERE comunidade_id = ? AND usuario_id = ?`, comunidadeID, usuarioID)
	return err
}

// ListPendentes lista quem está esperando aprovação pra entrar numa
// comunidade privada — só o dono vê essa lista.
func (r *ComunidadeRepository) ListPendentes(comunidadeID int64) ([]*models.ComunidadeMembro, error) {
	rows, err := r.db.Query(
		`SELECT m.id, m.comunidade_id, m.usuario_id, m.papel, m.created_at, u.nome, u.foto
		 FROM comunidade_membro m INNER JOIN usuario u ON u.id = m.usuario_id
		 WHERE m.comunidade_id = ? AND m.papel = ?
		 ORDER BY m.created_at ASC`,
		comunidadeID, models.PapelPendente,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*models.ComunidadeMembro
	for rows.Next() {
		m := &models.ComunidadeMembro{}
		if err := rows.Scan(&m.ID, &m.ComunidadeID, &m.UsuarioID, &m.Papel, &m.CreatedAt, &m.UsuarioNome, &m.UsuarioFoto); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (r *ComunidadeRepository) TotalMembros(comunidadeID int64) (int, error) {
	var total int
	err := r.db.QueryRow(`SELECT COUNT(id) FROM comunidade_membro WHERE comunidade_id = ? AND papel != ?`, comunidadeID, models.PapelPendente).Scan(&total)
	return total, err
}

type ComunidadeUpdate struct {
	Nome         *string
	Descricao    *string
	Visibilidade *string
	IconeURL     *string
	BannerURL    *string
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
	if u.Visibilidade != nil && (*u.Visibilidade == models.VisibilidadePublica || *u.Visibilidade == models.VisibilidadePrivada) {
		existing.Visibilidade = *u.Visibilidade
	}
	if u.IconeURL != nil {
		existing.IconeURL = u.IconeURL
	}
	if u.BannerURL != nil {
		existing.BannerURL = u.BannerURL
	}
	_, err = r.db.Exec(
		`UPDATE comunidade SET nome = ?, descricao = ?, visibilidade = ?, icone_url = ?, banner_url = ?, updated_at = NOW() WHERE id = ?`,
		existing.Nome, existing.Descricao, existing.Visibilidade, existing.IconeURL, existing.BannerURL, id,
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
