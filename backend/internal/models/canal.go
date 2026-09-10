package models

import "time"

const (
	CanalTipoTexto = "texto"
	CanalTipoVoz   = "voz"
)

// Canal mapeia `canal`. Canais de voz têm SalaID preenchido — apontando
// para uma linha em `sala` criada automaticamente junto com o canal, só
// para reaproveitar o fluxo de LiveKit que a Sala já resolve (token,
// presença). Canais de texto nunca têm SalaID.
// internal/models/canal.go
type Canal struct {
	ID           int64      `json:"id" db:"id"`
	ComunidadeID int64      `json:"comunidade_id" db:"comunidade_id"`
	Nome         string     `json:"nome" db:"nome"`
	Icone        *string    `json:"icone,omitempty" db:"icone"`
	Tipo         string     `json:"tipo" db:"tipo"`
	Posicao      int        `json:"posicao" db:"posicao"`
	SalaID       *int64     `json:"sala_id,omitempty" db:"sala_id"`
	CreatedAt    *time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    *time.Time `json:"updated_at" db:"updated_at"`
	DeletedAt    *time.Time `json:"-" db:"deleted_at"`

	// Campos calculados (não persistidos)
	ParticipantesOnline int                `json:"participantes_online,omitempty" db:"-"`
	ParticipantesLista  []ParticipanteInfo `json:"participantes_lista,omitempty" db:"-"`
}

// ParticipanteInfo para retornar na API
type ParticipanteInfo struct {
	Identity    string `json:"identity"`
	Nome        string `json:"nome"`
	Foto        string `json:"foto,omitempty"`
	Moldura     string `json:"moldura,omitempty"`
	MicEnabled  bool   `json:"micEnabled"`
	Deafened    bool   `json:"deafened,omitempty"`
	CameraOn    bool   `json:"cameraOn,omitempty"`
	ScreenShare bool   `json:"screenShare,omitempty"`
}

func (Canal) TableName() string { return "canal" }

// CanalMensagem mapeia `canal_mensagem` (chat de um canal de texto).
type CanalMensagem struct {
	ID        int64      `json:"id" db:"id"`
	CanalID   int64      `json:"canal_id" db:"canal_id"`
	UsuarioID int64      `json:"usuario_id" db:"usuario_id"`
	Conteudo  string     `json:"conteudo" db:"conteudo"`
	EditadoEm *time.Time `json:"editado_em" db:"editado_em"`
	CreatedAt *time.Time `json:"created_at" db:"created_at"`
	UpdatedAt *time.Time `json:"updated_at" db:"updated_at"`
	DeletedAt *time.Time `json:"-" db:"deleted_at"`

	// Preenchidos via JOIN com `usuario` (não são colunas de canal_mensagem).
	UsuarioNome string  `json:"usuario_nome" db:"-"`
	UsuarioFoto *string `json:"usuario_foto" db:"-"`
}

func (CanalMensagem) TableName() string { return "canal_mensagem" }