package models

import "time"

// Tipos de sala suportados. `reuniao` é uma sala LiveKit livre (estilo
// NeoMeet), `producao` é uma sala onde todos os participantes escrevem sua
// produção textual ao mesmo tempo e o admin acompanha o progresso de cada um
// em tempo real (indicador por passo/pergunta).
const (
	SalaTipoReuniao  = "reuniao"
	SalaTipoProducao = "producao"
)

// Sala maps 1:1 to the new `sala` table (see migrations/0001_sala.sql).
// É uma tabela nova — não altera nenhuma tabela já existente do schema do
// WebLEIA.
//
//	CREATE TABLE `sala` (
//	  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
//	  `nome` varchar(255) NOT NULL,
//	  `codigo` varchar(40) NOT NULL,
//	  `tipo` varchar(20) NOT NULL DEFAULT 'reuniao',
//	  `genero_textual_id` bigint unsigned DEFAULT NULL,
//	  `criado_por` bigint unsigned NOT NULL,
//	  `ativa` tinyint unsigned NOT NULL DEFAULT '1',
//	  `created_at` timestamp NULL DEFAULT NULL,
//	  `updated_at` timestamp NULL DEFAULT NULL,
//	  `deleted_at` timestamp NULL DEFAULT NULL,
//	  PRIMARY KEY (`id`),
//	  UNIQUE KEY `sala_codigo_unique` (`codigo`),
//	  FOREIGN KEY (`criado_por`) REFERENCES `usuario` (`id`),
//	  FOREIGN KEY (`genero_textual_id`) REFERENCES `genero_textual` (`id`)
//	)
type Sala struct {
	ID     int64  `json:"id" db:"id"`
	Nome   string `json:"nome" db:"nome"`
	Codigo string `json:"codigo" db:"codigo"` // nome da room no LiveKit
	Tipo   string `json:"tipo" db:"tipo"`

	// Descricao/Categoria alimentam os cards de "comunidade" do painel
	// (Home) — ex.: "Discussões sobre front-end..." / "Jogos", "Tech".
	Descricao *string `json:"descricao" db:"descricao"`
	Categoria *string `json:"categoria" db:"categoria"`

	// Mantido apenas por compatibilidade com o fluxo antigo de "sala de
	// produção" do WebLEIA; o Resenha não usa mais gênero textual.
	GeneroTextualID *int64     `json:"genero_textual_id,omitempty" db:"genero_textual_id"`
	CriadoPor       int64      `json:"criado_por" db:"criado_por"`
	Ativa           bool       `json:"ativa" db:"ativa"`
	CreatedAt       *time.Time `json:"created_at" db:"created_at"`
	UpdatedAt       *time.Time `json:"updated_at" db:"updated_at"`
	DeletedAt       *time.Time `json:"-" db:"deleted_at"`

	// Preenchido em memória pelo handler (não é coluna) — quantidade de
	// participantes atualmente conectados, conforme o hub de tempo real.
	ParticipantesOnline int `json:"participantes_online,omitempty" db:"-"`
}

func (Sala) TableName() string { return "sala" }

// ---------------------------------------------------------------------
// PROGRESSO EM TEMPO REAL (sala do tipo "producao")
// ---------------------------------------------------------------------

// Tipos de evento publicados no canal SSE de uma sala. "progresso" (default,
// omitido no JSON por retrocompatibilidade com SalaMonitor/EscritaGuiada) é
// o avanço normal de passo; os demais alimentam o dashboard ao vivo do
// professor.
const (
	EventoProgresso       = "progresso"
	EventoEntrou          = "entrou"
	EventoSaiu            = "saiu"
	EventoIniciarProducao = "iniciar_producao"
)

// ProgressoEvento é publicado pelo hub (internal/realtime) via SSE sempre
// que um participante avança de passo dentro da sua produção textual, entra/
// sai da sala, ou quando o professor dispara "iniciar produção". É um dado
// inteiramente em memória (não persistido) — existe só enquanto a sala está
// aberta.
type ProgressoEvento struct {
	Tipo        string  `json:"tipo,omitempty"` // "" == "progresso" (compat)
	SalaID      int64   `json:"sala_id"`
	UsuarioID   int64   `json:"usuario_id"`
	NomeUsuario string  `json:"nome_usuario"`
	Foto        *string `json:"foto,omitempty"`
	IsAdmin     bool    `json:"is_admin,omitempty"`

	// Detalhe do passo atual, para o card do professor mostrar
	// "Movimento X · Pergunta Y" sem precisar buscar em outro endpoint.
	MovimentoNome  string `json:"movimento_nome,omitempty"`
	PerguntaTitulo string `json:"pergunta_titulo,omitempty"`

	// Sinal de "está digitando agora" + um trecho (throttled no frontend)
	// do texto sendo escrito — usado no modo de inspeção somente-leitura
	// do professor.
	Digitando   bool   `json:"digitando,omitempty"`
	TrechoAtual string `json:"trecho_atual,omitempty"`

	// Preenchidos só no evento "iniciar_producao": qual produção (recém-
	// criada) e gênero pertencem a este aluno, para o front abrir o painel
	// de escrita automaticamente.
	ProducaoID      int64  `json:"producao_id,omitempty"`
	GeneroTextualID int64  `json:"genero_textual_id,omitempty"`
	GeneroNome      string `json:"genero_nome,omitempty"`

	PassoAtual   int       `json:"passo_atual"` // ordem da pergunta/movimento atual
	TotalPassos  int       `json:"total_passos"`
	PerguntaID   int64     `json:"pergunta_id,omitempty"`
	Concluido    bool      `json:"concluido"`
	AtualizadoEm time.Time `json:"atualizado_em"`
}
