package main

import (
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/joho/godotenv"

	"github.com/liedsonlb/resenha-patch/internal/config"
	"github.com/liedsonlb/resenha-patch/internal/database"
	"github.com/liedsonlb/resenha-patch/internal/mailer"
	"github.com/liedsonlb/resenha-patch/internal/queue"
	"github.com/liedsonlb/resenha-patch/internal/realtime"
	"github.com/liedsonlb/resenha-patch/internal/repository"
	"github.com/liedsonlb/resenha-patch/internal/router"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("Erro ao carregar .env:", err)
	}

	cfg := config.Load()

	db, err := database.Connect(cfg)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer db.Close()
	log.Printf("connected to database %s@%s:%s/%s", cfg.DBUser, cfg.DBHost, cfg.DBPort, cfg.DBDatabase)

	// Aplica automaticamente as migrations pendentes (schema + seeds de
	// demonstração) no boot da API — assim `docker compose up` já deixa o
	// banco pronto, sem precisar rodar o binário `migration` à parte.
	if err := database.NewMigrationManager(db).Up(); err != nil {
		log.Fatalf("failed to run migrations: %v", err)
	}

	// ---- INICIALIZAR SERVIÇOS PARA SALAS E EXPORTAÇÃO ----

	// 2. Conectar ao RabbitMQ (best-effort — a API funciona sem fila,
	// o mailer cai para envio direto/log quando ela não está disponível).
	var rabbitMQ *queue.RabbitMQ
	if cfg.RabbitURL != "" {
		if conn, err := connectRabbitWithRetry(cfg.RabbitURL, 5); err != nil {
			log.Printf("⚠️  RabbitMQ indisponível, seguindo sem fila: %v", err)
		} else {
			rabbitMQ = conn
		}
	} else {
		log.Println("⚠️ RabbitMQ não configurado (RABBIT_URL vazio)")
	}
	
	// 3. Criar RealtimeHub para salas - usando NewHub() que já inicia
	hub := realtime.NewHub() // <-- NewHub já inicia o hub, não precisa de Run()
	log.Println("✅ RealtimeHub iniciado")
	
	// 4. Criar repositório de salas
	salaRepo := repository.NewSalaRepository(db)
	log.Println("✅ SalaRepository inicializado")

	// 5. Criar mailer - convertendo SMTPPort para string
	mail := mailer.New(mailer.Config{
		Host: cfg.SMTPHost,
		Port: strconv.Itoa(cfg.SMTPPort), // <-- CONVERTER int PARA string
		User: cfg.SMTPUser,
		Pass: cfg.SMTPPass,
		From: cfg.SMTPFrom,
	})

	deps := router.Deps{
		// Repositórios existentes
		UsuarioRepo:                 repository.NewUsuarioRepository(db),
		AplicacaoRepo:               repository.NewAplicacaoRepository(db),
		TokenRepo:                   repository.NewTokenRepository(db),
		CidadeRepo:                  repository.NewCidadeRepository(db),
		PasswordResetRepo:           repository.NewPasswordResetRepository(db),
		VerificationSecret: cfg.VerificationSecret,
		
		// ---- SALAS (LiveKit) --------------------------------------------
		SalaRepo:         salaRepo,
		RealtimeHub:      hub,
		LiveKitAPIKey:    cfg.LiveKitAPIKey,
		LiveKitAPISecret: cfg.LiveKitAPISecret,
		LiveKitURL:       cfg.LiveKitURL,
		
		// ---- EXPORTAÇÃO (RabbitMQ) ---------------------------------------
		Rabbit:       rabbitMQ,

		// ---- UPLOADS (fotos de perfil) ------------------------------------
		UploadDir: cfg.UploadDir,
		
		// ---- OUTROS -----------------------------------------------------
		Mailer:      mail,
		FrontendURL: cfg.FrontendURL,
		AppName:     cfg.AppName,
		TokenKey:    cfg.TokenKey,
		AppKey:      cfg.AppKey,
	}

	handler := router.New(deps)

	log.Printf("%s API (Go) listening on :%s", cfg.AppName, cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, handler); err != nil {
		log.Fatal(err)
	}
}

// connectRabbitWithRetry tenta conectar algumas vezes com backoff fixo —
// em docker-compose o container do RabbitMQ pode ainda estar de boot
// quando a API sobe.
func connectRabbitWithRetry(url string, attempts int) (*queue.RabbitMQ, error) {
	var lastErr error
	for i := 1; i <= attempts; i++ {
		conn, err := queue.NewRabbitMQ(url)
		if err == nil {
			return conn, nil
		}
		lastErr = err
		if i < attempts {
			time.Sleep(2 * time.Second)
		}
	}
	return nil, lastErr
}
