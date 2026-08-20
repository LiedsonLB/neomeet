package models

import "time"

// ---------------------------------------------------------------------
// EMAIL
// ---------------------------------------------------------------------

// Tipos de email conhecidos pelo worker-email. Cada tipo mapeia para um
// template em templates/email/<tipo>.html. Novos tipos podem ser adicionados
// livremente — o worker só precisa do arquivo de template correspondente.
const (
	EmailTipoBoasVindas        = "boas_vindas"
	EmailTipoVerificacaoEmail  = "verificacao_email"
	EmailTipoRedefinirSenha    = "redefinir_senha"
	EmailTipoProducaoExportada = "producao_exportada"
	EmailTipoGenerico          = "generico"
)

// EmailJob é o payload publicado na fila `webleia.emails`. `Dados` carrega
// as variáveis usadas pelo template HTML (nome, link, título da produção,
// etc) — fica a critério de quem publica o job preencher o que o template
// daquele Tipo espera.
type EmailJob struct {
	Tipo         string            `json:"tipo"`
	Destinatario string            `json:"destinatario"`
	NomeDestino  string            `json:"nome_destinatario"`
	Assunto      string            `json:"assunto"`
	Dados        map[string]string `json:"dados"`
	Anexos       []EmailAnexo      `json:"anexos,omitempty"`
	CriadoEm     time.Time         `json:"criado_em"`
}

// EmailAnexo é um anexo do e-mail. O conteúdo pode vir de duas formas:
//   - Conteudo: os bytes do arquivo já prontos (preferido — é o que o
//     worker-export usa agora, já que ele gera tudo em memória e nunca
//     escreve nada em disco).
//   - Caminho: caminho local de um arquivo (mantido só por compatibilidade
//     com integrações antigas; o worker-email lê do disco apenas quando
//     Conteudo vier vazio).
type EmailAnexo struct {
	NomeArquivo string `json:"nome_arquivo"`
	Conteudo    []byte `json:"conteudo,omitempty"`
	Caminho     string `json:"caminho,omitempty"`
}

// ---------------------------------------------------------------------
// EXPORTAÇÃO DE PRODUÇÕES TEXTUAIS
// ---------------------------------------------------------------------

// Formatos suportados pelo worker-export.
const (
	ExportFormatoPDF  = "pdf"
	ExportFormatoDOCX = "docx"
	ExportFormatoODT  = "odt"
	ExportFormatoTXT  = "txt"
)

var ExportFormatosValidos = map[string]bool{
	ExportFormatoPDF:  true,
	ExportFormatoDOCX: true,
	ExportFormatoODT:  true,
	ExportFormatoTXT:  true,
}

// ExportJob é o payload publicado na fila `webleia.exportacoes` quando um
// aluno pede o download de uma produção textual em algum formato.
type ExportJob struct {
	JobID             string    `json:"job_id"`
	ProducaoTextualID int64     `json:"producao_textual_id"`
	UsuarioID         int64     `json:"usuario_id"`
	Formato           string    `json:"formato"` // pdf | docx | odt | txt
	EnviarPorEmail    bool      `json:"enviar_por_email"`
	EmailDestino      string    `json:"email_destino,omitempty"`
	CriadoEm          time.Time `json:"criado_em"`
}

// ExportStatus é o status consultável pelo frontend em
// GET /exportar/status?job_id=xxx. Mantido em memória pelo
// worker-export (ver internal/export/status_store.go) — não é persistido em
// banco porque é um dado efêmero (o arquivo final é o que importa).
type ExportStatus struct {
	JobID       string    `json:"job_id"`
	Status      string    `json:"status"` // pendente | processando | concluido | erro
	Formato     string    `json:"formato"`
	ArquivoURL  string    `json:"arquivo_url,omitempty"`
	Erro        string    `json:"erro,omitempty"`
	Mensagem    string    `json:"mensagem,omitempty"`     // <-- ADICIONADO
	CriadoEm    time.Time `json:"criado_em,omitempty"`    // <-- ADICIONADO
	AtualizadoEm time.Time `json:"atualizado_em,omitempty"` // <-- ADICIONADO
}

// Status da exportação
const (
	ExportStatusPendente    = "pendente"
	ExportStatusProcessando = "processando"
	ExportStatusConcluido   = "concluido"
	ExportStatusErro        = "erro"
)