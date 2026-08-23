package config

import (
	"fmt"
	"os"
	"strconv"
)

type Config struct {
	AppName    string
	Port       string
	TokenKey   string
	AppKey     string
	DBHost     string
	DBPort     string
	DBDatabase string
	DBUser     string
	DBPassword string

	// ---- RabbitMQ (workers de email/export) --------------------------
	RabbitURL string

	// ---- SMTP (worker-email) -----------------------------------------
	SMTPHost string
	SMTPPort int
	SMTPUser string
	SMTPPass string
	SMTPFrom string

	// FrontendURL is used to build links sent by e-mail (password reset).
	FrontendURL string

	// ---- LiveKit (salas) ----------------------------------------------
	LiveKitAPIKey    string
	LiveKitAPISecret string
	// URL interna (dentro do Docker): usada pelo backend para se comunicar
	// com o servidor LiveKit.
	LiveKitURL string
	// URL pública: retornada para o browser conectar ao LiveKit.
	// Se vazia, usa LiveKitURL (compatível com dev local sem Docker).
	LiveKitPublicURL string

	// ---- Exportação ---------------------------------------------------
	ExportOutputDir string

	// ---- Uploads (fotos de perfil, etc.) -------------------------------
	UploadDir string

	// ---- Verificação de e-mail (tokens auto-validáveis) ----------------
	VerificationSecret string // Chave secreta para gerar tokens HMAC
}

func getEnv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	return fallback
}

func Load() *Config {
	liveKitURL := getEnv("LIVEKIT_URL", "wss://localhost:7880")
	liveKitPublicURL := getEnv("LIVEKIT_PUBLIC_URL", liveKitURL)

	return &Config{
		AppName:    getEnv("APP_NAME", "Resenha"),
		Port:       getEnv("PORT", "8080"),
		TokenKey:   getEnv("TOKEN_KEY", "change-me"),
		AppKey:     getEnv("APP_KEY", "WEBTESTE"),
		DBHost:     getEnv("DB_HOST", "localhost"),
		DBPort:     getEnv("DB_PORT", "3306"),
		DBDatabase: getEnv("DB_DATABASE", "resenha"),
		DBUser:     getEnv("DB_USERNAME", "root"),
		DBPassword: getEnv("DB_PASSWORD", ""),

		FrontendURL: getEnv("FRONTEND_URL", "http://localhost:5173"),

		RabbitURL: getEnv("RABBIT_URL", "amqp://guest:guest@localhost:5672/"),

		SMTPHost: getEnv("MAIL_HOST", ""),
		SMTPPort: getEnvInt("MAIL_PORT", 587),
		SMTPUser: getEnv("MAIL_USERNAME", ""),
		SMTPPass: getEnv("MAIL_PASSWORD", ""),
		SMTPFrom: getEnv("MAIL_FROM_ADDRESS", ""),

		LiveKitAPIKey:    getEnv("LIVEKIT_API_KEY", ""),
		LiveKitAPISecret: getEnv("LIVEKIT_API_SECRET", ""),
		LiveKitURL:       liveKitURL,
		LiveKitPublicURL: liveKitPublicURL,

		ExportOutputDir: getEnv("EXPORT_OUTPUT_DIR", "./storage/exportacoes"),

		UploadDir: getEnv("UPLOAD_DIR", "../uploads"),

		VerificationSecret: getEnv("VERIFICATION_SECRET", "web-leia-verification-secret-change-me"),
	}
}

func (c *Config) DSN() string {
	return fmt.Sprintf(
		"%s:%s@tcp(%s:%s)/%s?parseTime=true&loc=UTC&charset=utf8mb4&multiStatements=true",
		c.DBUser, c.DBPassword, c.DBHost, c.DBPort, c.DBDatabase,
	)
}
