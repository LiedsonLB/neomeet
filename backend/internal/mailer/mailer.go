// Package mailer sends transactional e-mails (account activation, password
// reset). If SMTP_HOST is not configured, Send falls back to logging the
// message to stdout so the flow keeps working end-to-end in dev/without
// mail infra — swap in real SMTP credentials (SMTP_HOST/PORT/USER/PASS/FROM
// env vars) to actually deliver e-mails in production.
package mailer

import (
	"bytes"
	"fmt"
	"html/template"
	"log"
	"net/smtp"
	"time"
)

type Config struct {
	Host string
	Port string
	User string
	Pass string
	From string
}

type Mailer struct {
	cfg Config
}

func New(cfg Config) *Mailer {
	return &Mailer{cfg: cfg}
}

func (m *Mailer) configured() bool {
	return m.cfg.Host != "" && m.cfg.Port != "" && m.cfg.From != ""
}

// EmailData é a estrutura base para templates de email
type EmailData struct {
	AppName     string
	FrontendURL string
	UserName    string
	Email       string
	Token       string
	Link        string
	Year        int
	IP          string
	Now         string
}

// SendPasswordReset envia email de recuperação de senha
func (m *Mailer) SendPasswordReset(to, name, token, frontendURL, appName string) error {
	link := fmt.Sprintf("%s/recuperar-senha?token=%s", frontendURL, token)
	
	data := EmailData{
		AppName:     appName,
		FrontendURL: frontendURL,
		UserName:    name,
		Email:       to,
		Token:       token,
		Link:        link,
		Year:        time.Now().Year(),
	}

	subject := "Recuperação de senha - " + appName
	body, err := m.renderTemplate(passwordResetTemplate, data)
	if err != nil {
		return err
	}

	return m.Send(to, subject, body)
}

// SendWelcome envia email de boas-vindas
func (m *Mailer) SendWelcome(to, name, frontendURL, appName string) error {
	data := EmailData{
		AppName:     appName,
		FrontendURL: frontendURL,
		UserName:    name,
		Email:       to,
		Year:        time.Now().Year(),
	}

	subject := "Bem-vindo ao " + appName
	body, err := m.renderTemplate(welcomeTemplate, data)
	if err != nil {
		return err
	}

	return m.Send(to, subject, body)
}

// SendNewLogin envia notificação de novo login
func (m *Mailer) SendNewLogin(to, name, ip, frontendURL, appName string) error {
	data := EmailData{
		AppName:     appName,
		FrontendURL: frontendURL,
		UserName:    name,
		Email:       to,
		IP:          ip,
		Now:         time.Now().Format("02/01/2006 15:04:05"),
		Year:        time.Now().Year(),
	}

	subject := "Novo acesso detectado - " + appName
	body, err := m.renderTemplate(newLoginTemplate, data)
	if err != nil {
		return err
	}

	return m.Send(to, subject, body)
}

// renderTemplate renderiza um template HTML
func (m *Mailer) renderTemplate(templateStr string, data EmailData) (string, error) {
	t, err := template.New("email").Parse(templateStr)
	if err != nil {
		return "", err
	}

	var buf bytes.Buffer
	err = t.Execute(&buf, data)
	if err != nil {
		return "", err
	}

	return buf.String(), nil
}

// Send delivers an e-mail, or logs it to stdout when SMTP isn't configured
func (m *Mailer) Send(to, subject, body string) error {
	if !m.configured() {
		log.Printf("[mailer] SMTP não configurado — e-mail não enviado de verdade.\nPara: %s\nAssunto: %s\n%s\n", to, subject, body)
		return nil
	}

	addr := fmt.Sprintf("%s:%s", m.cfg.Host, m.cfg.Port)
	msg := []byte("From: " + m.cfg.From + "\r\n" +
		"To: " + to + "\r\n" +
		"Subject: " + subject + "\r\n" +
		"MIME-Version: 1.0\r\n" +
		"Content-Type: text/html; charset=UTF-8\r\n" +
		"\r\n" +
		body + "\r\n")

	var auth smtp.Auth
	if m.cfg.User != "" {
		auth = smtp.PlainAuth("", m.cfg.User, m.cfg.Pass, m.cfg.Host)
	}
	
	if err := smtp.SendMail(addr, auth, m.cfg.From, []string{to}, msg); err != nil {
		log.Printf("[mailer] falha ao enviar e-mail para %s: %v", to, err)
		return err
	}
	
	log.Printf("[mailer] ✅ Email enviado para %s", to)
	return nil
}

// Templates HTML
const passwordResetTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Recuperação de Senha</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f6f9f7; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); overflow: hidden; }
        .header { background: #2f3e4f; padding: 30px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-family: 'Georgia', serif; font-weight: 500; font-size: 28px; }
        .content { padding: 40px 35px; }
        .content h2 { color: #2f3e4f; margin-top: 0; font-size: 22px; font-weight: 500; }
        .content p { color: #4a5a6b; line-height: 1.6; margin: 16px 0; }
        .button-container { text-align: center; margin: 30px 0; }
        .button { display: inline-block; background: #2f3e4f; color: #ffffff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; }
        .button:hover { background: #1d2a38; }
        .footer { padding: 20px 35px; text-align: center; border-top: 1px solid #e8ecea; color: #8a9aa8; font-size: 13px; }
        .footer p { margin: 4px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{{.AppName}}</h1>
        </div>
        <div class="content">
            <h2>Recuperação de senha</h2>
            <p>Olá <strong>{{.UserName}}</strong>,</p>
            <p>Recebemos uma solicitação para redefinir a senha da sua conta no {{.AppName}}.</p>
            <p>Clique no botão abaixo para criar uma nova senha:</p>
            <div class="button-container">
                <a href="{{.Link}}" class="button">Redefinir senha</a>
            </div>
            <p>Se você não solicitou esta redefinição, ignore este email. O link expira em 24 horas.</p>
            <p style="color: #8a9aa8; font-size: 14px;">Ou copie o link abaixo:</p>
            <p style="background: #f6f9f7; padding: 12px; border-radius: 6px; word-break: break-all; font-size: 13px; color: #4a5a6b;">{{.Link}}</p>
        </div>
        <div class="footer">
            <p>© {{.Year}} {{.AppName}}. Todos os direitos reservados.</p>
            <p>Este é um email automático, por favor não responda.</p>
        </div>
    </div>
</body>
</html>
`

const welcomeTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bem-vindo!</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f6f9f7; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); overflow: hidden; }
        .header { background: #2f3e4f; padding: 30px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-family: 'Georgia', serif; font-weight: 500; font-size: 28px; }
        .content { padding: 40px 35px; }
        .content h2 { color: #2f3e4f; margin-top: 0; font-size: 22px; font-weight: 500; }
        .content p { color: #4a5a6b; line-height: 1.6; margin: 16px 0; }
        .button-container { text-align: center; margin: 30px 0; }
        .button { display: inline-block; background: #2f3e4f; color: #ffffff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; }
        .button:hover { background: #1d2a38; }
        .footer { padding: 20px 35px; text-align: center; border-top: 1px solid #e8ecea; color: #8a9aa8; font-size: 13px; }
        .footer p { margin: 4px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{{.AppName}}</h1>
        </div>
        <div class="content">
            <h2>Bem-vindo ao {{.AppName}}! 🎉</h2>
            <p>Olá <strong>{{.UserName}}</strong>,</p>
            <p>Estamos muito felizes em ter você conosco!</p>
            <p>O {{.AppName}} é uma plataforma de produção textual guiada que vai te ajudar a desenvolver suas habilidades de escrita acadêmica.</p>
            <p>Para começar, acesse o link abaixo:</p>
            <div class="button-container">
                <a href="{{.FrontendURL}}" class="button">Acessar plataforma</a>
            </div>
            <p>Se tiver dúvidas, estamos aqui para ajudar!</p>
        </div>
        <div class="footer">
            <p>© {{.Year}} {{.AppName}}. Todos os direitos reservados.</p>
            <p>Este é um email automático, por favor não responda.</p>
        </div>
    </div>
</body>
</html>
`

const newLoginTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Novo acesso detectado</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f6f9f7; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); overflow: hidden; }
        .header { background: #2f3e4f; padding: 30px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-family: 'Georgia', serif; font-weight: 500; font-size: 28px; }
        .content { padding: 40px 35px; }
        .content h2 { color: #2f3e4f; margin-top: 0; font-size: 22px; font-weight: 500; }
        .content p { color: #4a5a6b; line-height: 1.6; margin: 16px 0; }
        .info-box { background: #f6f9f7; padding: 16px; border-radius: 8px; margin: 20px 0; }
        .info-box p { margin: 6px 0; }
        .footer { padding: 20px 35px; text-align: center; border-top: 1px solid #e8ecea; color: #8a9aa8; font-size: 13px; }
        .footer p { margin: 4px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{{.AppName}}</h1>
        </div>
        <div class="content">
            <h2>Novo acesso detectado 🔐</h2>
            <p>Olá <strong>{{.UserName}}</strong>,</p>
            <p>Detectamos um novo acesso à sua conta do {{.AppName}}.</p>
            <div class="info-box">
                <p><strong>📍 IP:</strong> {{.IP}}</p>
                <p><strong>🕐 Data/Hora:</strong> {{.Now}}</p>
            </div>
            <p>Se foi você, ignore este email.</p>
            <p><strong>Se não foi você</strong>, acesse sua conta e redefina sua senha imediatamente.</p>
            <div style="text-align: center; margin: 20px 0;">
                <a href="{{.FrontendURL}}" style="display: inline-block; background: #2f3e4f; color: #ffffff; padding: 10px 24px; border-radius: 8px; text-decoration: none;">Acessar conta</a>
            </div>
        </div>
        <div class="footer">
            <p>© {{.Year}} {{.AppName}}. Todos os direitos reservados.</p>
            <p>Este é um email automático, por favor não responda.</p>
        </div>
    </div>
</body>
</html>
`