package repository

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"

	"github.com/liedsonlb/resenha-patch/internal/apperr"
	"github.com/liedsonlb/resenha-patch/internal/models"
)

// ListParams mirrors the query-string contract of BaseListRepository::all
// (order, sort, limit, onlyTrashed) plus UsuarioRepository::where's own
// filters (nome, email, perfil, aluno_id), so the existing frontend/app
// clients keep working unmodified.
type ListParams struct {
	Order       string
	Sort        string
	Limit       int
	Page        int
	OnlyTrashed bool

	Nome    string
	Email   string
	Perfil  int
	AlunoID int64

	// SessionAlunoID: when the logged-in user is a student (perfil=aluno),
	// results are always scoped to their own aluno_id (see
	// UsuarioRepository::where's `$this->userSession->is_aluno` branch).
	SessionAlunoID int64
	ScopeToSession bool
}

var allowedOrderColumns = map[string]bool{
	"id": true, "nome": true, "email": true, "perfil": true,
	"created_at": true, "updated_at": true, "aluno_id": true,
}

type UsuarioRepository struct {
	db *sql.DB
}

func NewUsuarioRepository(db *sql.DB) *UsuarioRepository {
	return &UsuarioRepository{db: db}
}

func (r *UsuarioRepository) buildWhere(p ListParams) (string, []any) {
	clauses := []string{}
	args := []any{}

	if p.OnlyTrashed {
		clauses = append(clauses, "deleted_at IS NOT NULL")
	} else {
		clauses = append(clauses, "deleted_at IS NULL")
	}

	if p.Nome != "" {
		clauses = append(clauses, "nome LIKE ?")
		args = append(args, "%"+p.Nome+"%")
	}
	if p.Email != "" {
		clauses = append(clauses, "email = ?")
		args = append(args, p.Email)
	}
	if p.Perfil > 0 {
		clauses = append(clauses, "perfil = ?")
		args = append(args, p.Perfil)
	}
	if p.AlunoID > 0 {
		clauses = append(clauses, "aluno_id = ?")
		args = append(args, p.AlunoID)
	}
	if p.ScopeToSession && p.SessionAlunoID > 0 {
		clauses = append(clauses, "aluno_id = ?")
		args = append(args, p.SessionAlunoID)
	}

	return strings.Join(clauses, " AND "), args
}

const usuarioColumns = "id, nome, email, senha, foto, banner, moldura, descricao, links, jogos, status_customizado, atividade, atividade_tipo, perfil, email_verified_at, created_at, updated_at, deleted_at, aluno_id"

func scanUsuario(row interface{ Scan(...any) error }) (*models.Usuario, error) {
	u := &models.Usuario{}
	err := row.Scan(&u.ID, &u.Nome, &u.Email, &u.Senha, &u.Foto, &u.Banner, &u.Moldura, &u.Descricao,
		&u.Links, &u.Jogos, &u.StatusCustomizado, &u.Atividade, &u.AtividadeTipo, &u.Perfil,
		&u.EmailVerifiedAt, &u.CreatedAt, &u.UpdatedAt, &u.DeletedAt, &u.AlunoID)
	if err != nil {
		return nil, err
	}
	return u, nil
}

// All mirrors BaseListRepository::all
func (r *UsuarioRepository) All(p ListParams) ([]*models.Usuario, int64, error) {
	order := p.Order
	if order == "" || !allowedOrderColumns[order] {
		order = "id"
	}
	sort := "asc"
	if strings.EqualFold(p.Sort, "desc") {
		sort = "desc"
	}

	where, args := r.buildWhere(p)

	total, err := r.countWithWhere(where, args)
	if err != nil {
		return nil, 0, err
	}

	limit := p.Limit
	if limit <= 0 {
		limit = 20 // Constantes::LIMIT_DEFAULT equivalent
	}
	page := p.Page
	if page <= 0 {
		page = 1
	}
	offset := (page - 1) * limit

	query := fmt.Sprintf(
		"SELECT %s FROM usuario WHERE %s ORDER BY %s %s LIMIT ? OFFSET ?",
		usuarioColumns, where, order, sort,
	)
	args = append(args, limit, offset)

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var list []*models.Usuario
	for rows.Next() {
		u, err := scanUsuario(rows)
		if err != nil {
			return nil, 0, err
		}
		list = append(list, u)
	}
	return list, total, rows.Err()
}

func (r *UsuarioRepository) countWithWhere(where string, args []any) (int64, error) {
	var total int64
	query := "SELECT COUNT(id) FROM usuario WHERE " + where
	err := r.db.QueryRow(query, args...).Scan(&total)
	return total, err
}

// Count mirrors BaseListRepository::count
func (r *UsuarioRepository) Count(p ListParams) (int64, error) {
	where, args := r.buildWhere(p)
	return r.countWithWhere(where, args)
}

// PerfilCount is the response shape for GroupByPerfil.
type PerfilCount struct {
	Perfil int   `json:"perfil" db:"perfil"`
	Total  int64 `json:"total" db:"total"`
}

// GroupByPerfil mirrors UsuarioRepository::groupByPerfil, used by
// DashController to build the admin/aluno counters by profile
// (quantos admins, quantos alunos com login).
func (r *UsuarioRepository) GroupByPerfil(p ListParams) ([]PerfilCount, error) {
	where, args := r.buildWhere(p)
	rows, err := r.db.Query("SELECT perfil, COUNT(id) AS total FROM usuario WHERE "+where+" GROUP BY perfil", args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []PerfilCount
	for rows.Next() {
		var pc PerfilCount
		if err := rows.Scan(&pc.Perfil, &pc.Total); err != nil {
			return nil, err
		}
		out = append(out, pc)
	}
	return out, rows.Err()
}

// FindByID mirrors BaseListRepository::find
func (r *UsuarioRepository) FindByID(id int64, trashed bool) (*models.Usuario, error) {
	where := "id = ? AND deleted_at IS NULL"
	if trashed {
		where = "id = ?"
	}
	query := fmt.Sprintf("SELECT %s FROM usuario WHERE %s LIMIT 1", usuarioColumns, where)
	row := r.db.QueryRow(query, id)
	u, err := scanUsuario(row)
	if err == sql.ErrNoRows {
		return nil, apperr.New("Usuário não encontrado(a)!", 404)
	}
	if err != nil {
		return nil, err
	}
	return u, nil
}

// FindByEmail is used by the login flow.
func (r *UsuarioRepository) FindByEmail(email string, perfil int) (*models.Usuario, error) {
	query := "SELECT " + usuarioColumns + " FROM usuario WHERE email = ? AND deleted_at IS NULL"
	args := []any{email}
	if perfil > 0 {
		query += " AND perfil = ?"
		args = append(args, perfil)
	}
	query += " LIMIT 1"
	row := r.db.QueryRow(query, args...)
	u, err := scanUsuario(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return u, nil
}

// SetSenhaByEmail overwrites the password for the account matching email,
// used by the "esqueci minha senha" reset flow (called only after the
// reset token has been verified). Also mirrors a fresh e-mail confirmation,
// mostly relevant for accounts predating auto-verification.
func (r *UsuarioRepository) SetSenhaByEmail(email, plainSenha string) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(plainSenha), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	_, err = r.db.Exec(
		"UPDATE usuario SET senha = ?, email_verified_at = COALESCE(email_verified_at, NOW()), updated_at = NOW() WHERE email = ? AND deleted_at IS NULL",
		string(hash), email,
	)
	return err
}

// EmailExists mirrors the `email` unique validation rule.
// SetEmailVerifiedByEmail marks the account as active once the person
// confirms the token sent to their e-mail (see handlers.ConfirmarEmail).
func (r *UsuarioRepository) SetEmailVerifiedByEmail(email string) error {
	_, err := r.db.Exec(
		"UPDATE usuario SET email_verified_at = NOW(), updated_at = NOW() WHERE email = ?",
		email,
	)
	return err
}

// FindByAlunoIDs busca usuários pelos IDs dos alunos
// internal/repository/usuario_repository.go

// FindByAlunoIDs busca usuários pelos IDs dos alunos
// internal/repository/usuario_repository.go

// FindByAlunoIDs busca usuários pelos IDs dos alunos
func (r *UsuarioRepository) FindByAlunoIDs(alunoIDs []int64) ([]models.Usuario, error) {
	if len(alunoIDs) == 0 {
		return []models.Usuario{}, nil
	}

	// Constrói a query com placeholders para cada ID
	placeholders := make([]string, len(alunoIDs))
	args := make([]any, len(alunoIDs))
	for i, id := range alunoIDs {
		placeholders[i] = "?"
		args[i] = id
	}

	query := `SELECT id, nome, email, senha, foto, perfil, email_verified_at, remember_token, created_at, updated_at, deleted_at, aluno_id 
	          FROM usuario WHERE aluno_id IN (` + strings.Join(placeholders, ", ") + `) AND deleted_at IS NULL`

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var usuarios []models.Usuario
	for rows.Next() {
		var u models.Usuario
		var senha string
		var foto *string
		var emailVerifiedAt, createdAt, updatedAt, deletedAt *time.Time
		var rememberToken *string
		var alunoID *int64

		err := rows.Scan(
			&u.ID,
			&u.Nome,
			&u.Email,
			&senha,
			&foto,
			&u.Perfil,
			&emailVerifiedAt,
			&rememberToken,
			&createdAt,
			&updatedAt,
			&deletedAt,
			&alunoID,
		)
		if err != nil {
			return nil, err
		}

		// Atribui os campos
		u.Foto = foto
		u.AlunoID = alunoID
		u.EmailVerifiedAt = emailVerifiedAt
		u.CreatedAt = createdAt
		u.UpdatedAt = updatedAt

		usuarios = append(usuarios, u)
	}

	if err = rows.Err(); err != nil {
		return nil, err
	}

	return usuarios, nil
}

func (r *UsuarioRepository) EmailExists(email string, excludeID int64) (bool, error) {
	var count int
	err := r.db.QueryRow(
		"SELECT COUNT(id) FROM usuario WHERE email = ? AND id != ?",
		email, excludeID,
	).Scan(&count)
	return count > 0, err
}

// Create mirrors UsuarioRepository::save for a new record (isNew branch).
func (r *UsuarioRepository) Create(u *models.Usuario, plainSenha string) (*models.Usuario, error) {
	if u.Nome == "" {
		return nil, apperr.New("O campo nome é obrigatório.", 422)
	}
	if u.Email == "" {
		return nil, apperr.New("O campo email é obrigatório.", 422)
	}
	if u.Perfil <= 0 {
		return nil, apperr.New("Perfil incorreto!", 422)
	}
	if len(plainSenha) < 6 {
		return nil, apperr.New("A senha deve ter no mínimo 6 caracteres.", 422)
	}
	exists, err := r.EmailExists(u.Email, 0)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, apperr.New("O campo email já está sendo utilizado.", 422)
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(plainSenha), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	res, err := r.db.Exec(
		`INSERT INTO usuario (nome, email, senha, foto, perfil, aluno_id, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
		u.Nome, u.Email, string(hash), u.Foto, u.Perfil, u.AlunoID,
	)
	if err != nil {
		return nil, err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}
	return r.FindByID(id, false)
}

// FindByIDs busca vários usuários de uma vez (ex.: para juntar nome/foto em
// listas de mensagens de canal), preservando a ordem recebida.
func (r *UsuarioRepository) FindByIDs(ids []int64) (map[int64]*models.Usuario, error) {
	out := map[int64]*models.Usuario{}
	if len(ids) == 0 {
		return out, nil
	}
	placeholders := make([]string, len(ids))
	args := make([]any, len(ids))
	for i, id := range ids {
		placeholders[i] = "?"
		args[i] = id
	}
	query := fmt.Sprintf("SELECT %s FROM usuario WHERE id IN (%s)", usuarioColumns, strings.Join(placeholders, ", "))
	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		u, err := scanUsuario(rows)
		if err != nil {
			return nil, err
		}
		out[u.ID] = u
	}
	return out, rows.Err()
}

// CreateInTx mirrors Create but runs inside an existing transaction, so it
// can be composed with other writes (e.g. AlunoRepository::createAlunoAndUser).
func (r *UsuarioRepository) CreateInTx(tx *sql.Tx, u *models.Usuario, plainSenha string) (*models.Usuario, error) {
	if u.Nome == "" {
		return nil, apperr.New("O campo nome é obrigatório.", 422)
	}
	if u.Email == "" {
		return nil, apperr.New("O campo email é obrigatório.", 422)
	}
	if u.Perfil <= 0 {
		return nil, apperr.New("Perfil incorreto!", 422)
	}
	if len(plainSenha) < 6 {
		return nil, apperr.New("A senha deve ter no mínimo 6 caracteres.", 422)
	}
	var count int
	if err := tx.QueryRow("SELECT COUNT(id) FROM usuario WHERE email = ?", u.Email).Scan(&count); err != nil {
		return nil, err
	}
	if count > 0 {
		return nil, apperr.New("O campo email já está sendo utilizado.", 422)
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(plainSenha), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	// email_verified_at is intentionally left NULL here: the account only
	// becomes active once the person clicks the confirmation link e-mailed
	// to them (see handlers.sendVerificationEmail, called right after this
	// by both the self-service cadastro and the admin "cadastrar aluno"
	// screen). LoginHandler.Run already refuses login while this is NULL.
	res, err := tx.Exec(
		`INSERT INTO usuario (nome, email, senha, foto, perfil, aluno_id, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
		u.Nome, u.Email, string(hash), u.Foto, u.Perfil, u.AlunoID,
	)
	if err != nil {
		return nil, err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}
	u.ID = id
	return u, nil
}

// Update mirrors UsuarioRepository::save for the existing-record branch.
func (r *UsuarioRepository) Update(id int64, u *models.Usuario, plainSenha string) (*models.Usuario, error) {
	existing, err := r.FindByID(id, false)
	if err != nil {
		return nil, err
	}

	if u.Email != "" && u.Email != existing.Email {
		exists, err := r.EmailExists(u.Email, id)
		if err != nil {
			return nil, err
		}
		if exists {
			return nil, apperr.New("O campo email já está sendo utilizado.", 422)
		}
		existing.Email = u.Email
	}
	if u.Nome != "" {
		existing.Nome = u.Nome
	}
	if u.Foto != nil {
		existing.Foto = u.Foto
	}
	if u.Banner != nil {
		existing.Banner = u.Banner
	}
	if u.Moldura != nil {
		existing.Moldura = u.Moldura
	}
	if u.Descricao != nil {
		existing.Descricao = u.Descricao
	}
	if u.Links != nil {
		existing.Links = u.Links
	}
	if u.Jogos != nil {
		existing.Jogos = u.Jogos
	}
	if u.StatusCustomizado != nil {
		existing.StatusCustomizado = u.StatusCustomizado
	}
	if u.Perfil > 0 {
		existing.Perfil = u.Perfil
	}
	if u.AlunoID != nil {
		existing.AlunoID = u.AlunoID
	}

	senha := existing.Senha
	if plainSenha != "" {
		if len(plainSenha) < 6 {
			return nil, apperr.New("A senha deve ter no mínimo 6 caracteres.", 422)
		}
		hash, err := bcrypt.GenerateFromPassword([]byte(plainSenha), bcrypt.DefaultCost)
		if err != nil {
			return nil, err
		}
		senha = string(hash)
	}

	_, err = r.db.Exec(
		`UPDATE usuario SET nome = ?, email = ?, senha = ?, foto = ?, banner = ?, moldura = ?, descricao = ?,
		 links = ?, jogos = ?, status_customizado = ?, perfil = ?, aluno_id = ?, updated_at = NOW()
		 WHERE id = ?`,
		existing.Nome, existing.Email, senha, existing.Foto, existing.Banner, existing.Moldura, existing.Descricao,
		existing.Links, existing.Jogos, existing.StatusCustomizado, existing.Perfil, existing.AlunoID, id,
	)
	if err != nil {
		return nil, err
	}
	return r.FindByID(id, false)
}

// SoftDelete mirrors BaseCrudRepository::delete (sets deleted_at).
func (r *UsuarioRepository) SoftDelete(id int64) error {
	res, err := r.db.Exec("UPDATE usuario SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL", id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return apperr.New("Usuário não encontrado(a)!", 404)
	}
	return nil
}

// Restore mirrors BaseCrudRepository::restore (clears deleted_at).
func (r *UsuarioRepository) Restore(id int64) error {
	res, err := r.db.Exec("UPDATE usuario SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL", id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return apperr.New("Usuário não encontrado(a)!", 404)
	}
	return nil
}

// CheckPassword compares a plaintext password against the stored bcrypt
// hash. Laravel/PHP produces `$2y$` hashes; Go's bcrypt package treats
// `$2y$` the same as `$2a$`/`$2b$`, so no conversion is needed.
func CheckPassword(hash, plain string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(plain)) == nil
}

// TouchAcesso registra "visto por último agora" pro usuário — chamado
// periodicamente pelo frontend (heartbeat, ver PresenceHeartbeat.tsx)
// enquanto o app está aberto numa aba. Alimenta só o indicador de presença
// (bolinha online/offline) na aba "Membros" de uma comunidade — ver
// ComunidadeRepository.ListMembros. Consultado por query direta (não passa
// por scanUsuario/usuarioColumns) pra não precisar tocar em nenhum outro
// lugar que já lista usuários.
func (r *UsuarioRepository) TouchAcesso(usuarioID int64) error {
	_, err := r.db.Exec(`UPDATE usuario SET ultimo_acesso = NOW() WHERE id = ?`, usuarioID)
	return err
}

// SetAtividade atualiza a "presença rica" do usuário (ver
// PresencaBadge.tsx): atividade é um texto livre curto ("Jogando
// Minecraft", "Ouvindo música"), atividadeTipo é "jogo" | "voz" | "" (vazio
// limpa a atividade, deixando só "disponível"). Também toca ultimo_acesso,
// já que só faz sentido setar isso com o app aberto.
func (r *UsuarioRepository) SetAtividade(usuarioID int64, atividade, atividadeTipo *string) error {
	_, err := r.db.Exec(
		`UPDATE usuario SET atividade = ?, atividade_tipo = ?, ultimo_acesso = NOW() WHERE id = ?`,
		atividade, atividadeTipo, usuarioID,
	)
	return err
}
