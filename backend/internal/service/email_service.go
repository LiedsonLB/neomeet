package service

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"html/template"
	"mime"
	"net/smtp"
	"os"
	"path/filepath"
	"strings"

	"github.com/liedsonlb/resenha-patch/internal/config"
	"github.com/liedsonlb/resenha-patch/internal/models"
)

type EmailService struct {
	cfg *config.Config
}

func NewEmailService(cfg *config.Config) *EmailService {
	return &EmailService{cfg: cfg}
}

// templatesDir aponta pra pasta de templates HTML dos emails. Cada
// EmailJob.Tipo mapeia para "templates/email/<tipo>.html" — se o arquivo não
// existir, cai para "generico.html".
const templatesDir = "templates/email"

// Enviar renderiza o template correspondente ao Tipo do job (com os dados em
// job.Dados) e envia por SMTP, com anexos opcionais.
func (e *EmailService) Enviar(job models.EmailJob) error {
	tmplPath := filepath.Join(templatesDir, job.Tipo+".html")
	if _, err := os.Stat(tmplPath); err != nil {
		tmplPath = filepath.Join(templatesDir, models.EmailTipoGenerico+".html")
	}

	tmpl, err := template.ParseFiles(tmplPath)
	if err != nil {
		return fmt.Errorf("erro ao carregar template de email (%s): %w", tmplPath, err)
	}

	data := map[string]string{}
	for k, v := range job.Dados {
		data[k] = v
	}
	if _, ok := data["nome_destinatario"]; !ok {
		data["nome_destinatario"] = job.NomeDestino
	}
	data["assunto"] = job.Assunto

	var htmlBody bytes.Buffer
	if err := tmpl.Execute(&htmlBody, data); err != nil {
		return fmt.Errorf("erro ao renderizar template de email: %w", err)
	}

	msg, err := buildMIMEMessage(e.cfg, job.Destinatario, job.Assunto, htmlBody.String(), job.Anexos)
	if err != nil {
		return err
	}

	auth := smtp.PlainAuth("", e.cfg.SMTPUser, e.cfg.SMTPPass, e.cfg.SMTPHost)
	addr := fmt.Sprintf("%s:%d", e.cfg.SMTPHost, e.cfg.SMTPPort)

	return smtp.SendMail(addr, auth, e.cfg.SMTPFrom, []string{job.Destinatario}, msg)
}

// buildMIMEMessage monta um email multipart/mixed simples: corpo HTML +
// anexos em base64. Escrito à mão (sem lib de mail) pra manter o worker sem
// dependências extras — é só texto MIME, não tem mistério.
func buildMIMEMessage(cfg *config.Config, destino, assunto, htmlBody string, anexos []models.EmailAnexo) ([]byte, error) {
	boundary := "webleia-boundary-42"
	var buf bytes.Buffer

	// fmt.Fprintf(&buf, "From: %s <%s>\r\n", cfg.SMTPFromName, cfg.SMTPFrom)
	fmt.Fprintf(&buf, "To: %s\r\n", destino)
	fmt.Fprintf(&buf, "Subject: %s\r\n", mime.QEncoding.Encode("UTF-8", assunto))
	fmt.Fprintf(&buf, "MIME-Version: 1.0\r\n")

	if len(anexos) == 0 {
		fmt.Fprintf(&buf, "Content-Type: text/html; charset=\"UTF-8\"\r\n\r\n")
		buf.WriteString(htmlBody)
		return buf.Bytes(), nil
	}

	fmt.Fprintf(&buf, "Content-Type: multipart/mixed; boundary=%q\r\n\r\n", boundary)

	fmt.Fprintf(&buf, "--%s\r\n", boundary)
	fmt.Fprintf(&buf, "Content-Type: text/html; charset=\"UTF-8\"\r\n\r\n")
	buf.WriteString(htmlBody)
	buf.WriteString("\r\n")

	for _, anexo := range anexos {
		content := anexo.Conteudo
		if len(content) == 0 && anexo.Caminho != "" {
			var err error
			content, err = os.ReadFile(anexo.Caminho)
			if err != nil {
				return nil, fmt.Errorf("erro ao ler anexo %s: %w", anexo.Caminho, err)
			}
		}
		if len(content) == 0 {
			continue
		}
		fmt.Fprintf(&buf, "--%s\r\n", boundary)
		fmt.Fprintf(&buf, "Content-Type: application/octet-stream; name=%q\r\n", anexo.NomeArquivo)
		fmt.Fprintf(&buf, "Content-Transfer-Encoding: base64\r\n")
		fmt.Fprintf(&buf, "Content-Disposition: attachment; filename=%q\r\n\r\n", anexo.NomeArquivo)
		buf.WriteString(chunkedBase64(content))
		buf.WriteString("\r\n")
	}
	fmt.Fprintf(&buf, "--%s--\r\n", boundary)

	return buf.Bytes(), nil
}

// chunkedBase64 codifica em base64 padrão, quebrando em linhas de 76
// caracteres (RFC 2045) como esperado em corpos MIME.
func chunkedBase64(data []byte) string {
	encoded := base64.StdEncoding.EncodeToString(data)
	var out strings.Builder
	for i := 0; i < len(encoded); i += 76 {
		end := i + 76
		if end > len(encoded) {
			end = len(encoded)
		}
		out.WriteString(encoded[i:end])
		out.WriteString("\r\n")
	}
	return out.String()
}
