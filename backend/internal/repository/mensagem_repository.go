package repository

import (
	"database/sql"

	"github.com/liedsonlb/resenha-patch/internal/apperr"
	"github.com/liedsonlb/resenha-patch/internal/models"
)

type MensagemRepository struct {
	db *sql.DB
}

func NewMensagemRepository(db *sql.DB) *MensagemRepository {
	return &MensagemRepository{db: db}
}

const mensagemSelect = `SELECT cm.id, cm.canal_id, cm.usuario_id, cm.conteudo, cm.editado_em, cm.created_at, cm.updated_at, u.nome, u.foto
	FROM canal_mensagem cm INNER JOIN usuario u ON u.id = cm.usuario_id`

func scanMensagem(row interface{ Scan(...any) error }) (*models.CanalMensagem, error) {
	m := &models.CanalMensagem{}
	err := row.Scan(&m.ID, &m.CanalID, &m.UsuarioID, &m.Conteudo, &m.EditadoEm, &m.CreatedAt, &m.UpdatedAt, &m.UsuarioNome, &m.UsuarioFoto)
	if err != nil {
		return nil, err
	}
	return m, nil
}

func validarConteudo(conteudo string) error {
	if conteudo == "" {
		return apperr.New("A mensagem não pode ser vazia.", 422)
	}
	if len(conteudo) > 4000 {
		return apperr.New("Mensagem muito longa (máximo 4000 caracteres).", 422)
	}
	return nil
}

// Create insere uma mensagem de texto num canal.
func (r *MensagemRepository) Create(canalID, usuarioID int64, conteudo string) (*models.CanalMensagem, error) {
	if err := validarConteudo(conteudo); err != nil {
		return nil, err
	}
	res, err := r.db.Exec(
		`INSERT INTO canal_mensagem (canal_id, usuario_id, conteudo, created_at, updated_at)
		 VALUES (?, ?, ?, NOW(), NOW())`,
		canalID, usuarioID, conteudo,
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

func (r *MensagemRepository) FindByID(id int64) (*models.CanalMensagem, error) {
	row := r.db.QueryRow(mensagemSelect+" WHERE cm.id = ? AND cm.deleted_at IS NULL LIMIT 1", id)
	m, err := scanMensagem(row)
	if err == sql.ErrNoRows {
		return nil, apperr.New("Mensagem não encontrada!", 404)
	}
	if err != nil {
		return nil, err
	}
	return m, nil
}

// Update edita o conteúdo de uma mensagem (marcando `editado_em`) — só o
// autor pode editar, checado no handler antes de chamar isso.
func (r *MensagemRepository) Update(id int64, conteudo string) (*models.CanalMensagem, error) {
	if err := validarConteudo(conteudo); err != nil {
		return nil, err
	}
	res, err := r.db.Exec(
		`UPDATE canal_mensagem SET conteudo = ?, editado_em = NOW(), updated_at = NOW() WHERE id = ? AND deleted_at IS NULL`,
		conteudo, id,
	)
	if err != nil {
		return nil, err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return nil, apperr.New("Mensagem não encontrada!", 404)
	}
	return r.FindByID(id)
}

func (r *MensagemRepository) SoftDelete(id int64) error {
	res, err := r.db.Exec("UPDATE canal_mensagem SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL", id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return apperr.New("Mensagem não encontrada!", 404)
	}
	return nil
}

// ListByCanal busca as últimas `limit` mensagens de um canal (mais antigas
// primeiro, prontas pra render), opcionalmente só as com id > afterID —
// usado pelo polling do frontend (a cada poucos segundos) pra buscar só o
// que é novo.
func (r *MensagemRepository) ListByCanal(canalID int64, limit int, afterID int64) ([]*models.CanalMensagem, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}

	var rows *sql.Rows
	var err error
	if afterID > 0 {
		rows, err = r.db.Query(
			mensagemSelect+` WHERE cm.canal_id = ? AND cm.deleted_at IS NULL AND cm.id > ?
			 ORDER BY cm.id ASC LIMIT ?`,
			canalID, afterID, limit,
		)
	} else {
		// Sem afterID: busca as últimas `limit` (mais recentes) e devolve
		// em ordem cronológica (mais antiga primeiro) pra já renderizar
		// certo na primeira carga da tela.
		rows, err = r.db.Query(
			`SELECT * FROM (`+mensagemSelect+` WHERE cm.canal_id = ? AND cm.deleted_at IS NULL
			   ORDER BY cm.id DESC LIMIT ?
			 ) ultimas ORDER BY id ASC`,
			canalID, limit,
		)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*models.CanalMensagem
	for rows.Next() {
		m, err := scanMensagem(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}
