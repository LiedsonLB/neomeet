package repository

import (
	"database/sql"
	"fmt"
	"strings"

	"github.com/liedsonlb/resenha-patch/internal/apperr"
	"github.com/liedsonlb/resenha-patch/internal/models"
)

// CidadeListParams mirrors CidadeRepository::where (nome, uf filters) plus
// the common list params (order/sort/limit/page).
type CidadeListParams struct {
	Order string
	Sort  string
	Limit int
	Page  int

	Nome string
	UF   string
}

type CidadeRepository struct {
	db *sql.DB
}

func NewCidadeRepository(db *sql.DB) *CidadeRepository {
	return &CidadeRepository{db: db}
}

const cidadeColumns = "id, nome, uf"

func scanCidade(row interface{ Scan(...any) error }) (*models.Cidade, error) {
	c := &models.Cidade{}
	err := row.Scan(&c.ID, &c.Nome, &c.UF)
	if err != nil {
		return nil, err
	}
	return c, nil
}

func (r *CidadeRepository) buildWhere(p CidadeListParams) (string, []any) {
	clauses := []string{"1=1"}
	args := []any{}
	if p.Nome != "" {
		clauses = append(clauses, "nome LIKE ?")
		args = append(args, "%"+p.Nome+"%")
	}
	if p.UF != "" {
		clauses = append(clauses, "uf = ?")
		args = append(args, p.UF)
	}
	return strings.Join(clauses, " AND "), args
}

// All mirrors CidadeController::all (BaseListController::all)
func (r *CidadeRepository) All(p CidadeListParams) ([]*models.Cidade, int64, error) {
	order := "nome"
	if p.Order != "" {
		order = p.Order
	}
	sort := "asc"
	if strings.EqualFold(p.Sort, "desc") {
		sort = "desc"
	}

	where, args := r.buildWhere(p)

	var total int64
	if err := r.db.QueryRow("SELECT COUNT(id) FROM cidade WHERE "+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	limit := p.Limit
	if limit <= 0 {
		limit = 20
	}
	page := p.Page
	if page <= 0 {
		page = 1
	}
	offset := (page - 1) * limit

	query := fmt.Sprintf("SELECT %s FROM cidade WHERE %s ORDER BY %s %s LIMIT ? OFFSET ?", cidadeColumns, where, order, sort)
	args = append(args, limit, offset)

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var list []*models.Cidade
	for rows.Next() {
		c, err := scanCidade(rows)
		if err != nil {
			return nil, 0, err
		}
		list = append(list, c)
	}
	return list, total, rows.Err()
}

func (r *CidadeRepository) FindByID(id int64) (*models.Cidade, error) {
	row := r.db.QueryRow("SELECT "+cidadeColumns+" FROM cidade WHERE id = ? LIMIT 1", id)
	c, err := scanCidade(row)
	if err == sql.ErrNoRows {
		return nil, apperr.New("Cidade não encontrado(a)!", 404)
	}
	if err != nil {
		return nil, err
	}
	return c, nil
}
