package models

import "time"

// Papéis dentro de uma comunidade. "pendente" é uma solicitação de entrada
// numa comunidade privada, esperando o dono aprovar ou recusar — enquanto
// pendente, a pessoa NÃO é considerada membro (não vê canais).
const (
	PapelDono     = "dono"
	PapelMembro   = "membro"
	PapelPendente = "pendente"
)

const (
	VisibilidadePublica = "publica"
	VisibilidadePrivada = "privada"
)

// Comunidade é o equivalente a um "servidor" do Discord: um espaço com
// vários canais (texto e voz) dentro. Ver migrations/0003_comunidades.up.sql
// e 0005_visibilidade_som.up.sql (campo Visibilidade).
type Comunidade struct {
	ID           int64      `json:"id" db:"id"`
	Nome         string     `json:"nome" db:"nome"`
	Descricao    *string    `json:"descricao" db:"descricao"`
	Visibilidade string     `json:"visibilidade" db:"visibilidade"`
	IconeURL     *string    `json:"icone_url" db:"icone_url"`
	BannerURL    *string    `json:"banner_url" db:"banner_url"`
	CriadoPor    int64      `json:"criado_por" db:"criado_por"`
	CreatedAt    *time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    *time.Time `json:"updated_at" db:"updated_at"`
	DeletedAt    *time.Time `json:"-" db:"deleted_at"`

	// Preenchidos em memória pelo handler (não são colunas).
	Papel        string `json:"papel,omitempty" db:"-"` // "dono" | "membro" | "pendente" | ""
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

	// Preenchidos via JOIN com `usuario`, só usados na tela de aprovar
	// solicitações pendentes do dono.
	UsuarioNome string  `json:"usuario_nome,omitempty" db:"-"`
	UsuarioFoto *string `json:"usuario_foto,omitempty" db:"-"`
}

func (ComunidadeMembro) TableName() string { return "comunidade_membro" }

// MembroComPresenca é um membro efetivo (dono ou membro — nunca pendente)
// de uma comunidade, já com indicador de presença (ver
// UsuarioRepository.TouchAcesso / ComunidadeRepository.ListMembros).
// Usado só pela aba "Membros" (MembrosModal.tsx no frontend), não tem
// tabela própria.
type MembroComPresenca struct {
	UsuarioID int64   `json:"usuario_id" db:"-"`
	Nome      string  `json:"nome" db:"-"`
	Foto      *string `json:"foto" db:"-"`
	Moldura   *string `json:"moldura" db:"-"`
	Papel     string  `json:"papel" db:"-"`
	Online    bool    `json:"online" db:"-"`
}

// ComunidadeSom mapeia `comunidade_som` — um clipe do soundboard de uma
// comunidade (estilo Discord: sons curtos que qualquer membro pode tocar
// durante uma chamada de voz, ouvido por todo mundo na sala).
type ComunidadeSom struct {
	ID           int64      `json:"id" db:"id"`
	ComunidadeID int64      `json:"comunidade_id" db:"comunidade_id"`
	Nome         string     `json:"nome" db:"nome"`
	Emoji        *string    `json:"emoji" db:"emoji"`
	ArquivoURL   string     `json:"arquivo_url" db:"arquivo_url"`
	CriadoPor    int64      `json:"criado_por" db:"criado_por"`
	CreatedAt    *time.Time `json:"created_at" db:"created_at"`
}

func (ComunidadeSom) TableName() string { return "comunidade_som" }
