package models

import "time"

// Papéis dentro de uma comunidade. Por enquanto só existem esses dois —
// dono (quem criou, único que pode editar/excluir a comunidade e
// criar/apagar canais) e membro comum.
const (
	PapelDono   = "dono"
	PapelMembro = "membro"
)

// Comunidade é o equivalente a um "servidor" do Discord: um espaço com
// vários canais (texto e voz) dentro. Ver migrations/0003_comunidades.up.sql.
type Comunidade struct {
	ID        int64      `json:"id" db:"id"`
	Nome      string     `json:"nome" db:"nome"`
	Descricao *string    `json:"descricao" db:"descricao"`
	IconeURL  *string    `json:"icone_url" db:"icone_url"`
	BannerURL *string    `json:"banner_url" db:"banner_url"`
	CriadoPor int64      `json:"criado_por" db:"criado_por"`
	CreatedAt *time.Time `json:"created_at" db:"created_at"`
	UpdatedAt *time.Time `json:"updated_at" db:"updated_at"`
	DeletedAt *time.Time `json:"-" db:"deleted_at"`

	// Preenchidos em memória pelo handler (não são colunas).
	Papel        string `json:"papel,omitempty" db:"-"` // "dono" | "membro", relativo à sessão atual
	TotalMembros int    `json:"total_membros,omitempty" db:"-"`
}

func (Comunidade) TableName() string { return "comunidade" }

// ComunidadeMembro mapeia `comunidade_membro`.
type ComunidadeMembro struct {
	ID           int64      `json:"id" db:"id"`
	ComunidadeID int64      `json:"comunidade_id" db:"comunidade_id"`
	UsuarioID    int64      `json:"usuario_id" db:"usuario_id"`
	Papel        string     `json:"papel" db:"papel"`
	CreatedAt    *time.Time `json:"created_at" db:"created_at"`
}

func (ComunidadeMembro) TableName() string { return "comunidade_membro" }
