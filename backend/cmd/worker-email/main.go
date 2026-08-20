// cmd/worker-email/main.go — processo separado que só consome a fila de
// emails. Sobe independente da API (`go run ./cmd/worker-email`), do mesmo
// jeito que os workers do projeto Mensageria.
package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/joho/godotenv"

	"github.com/liedsonlb/resenha-patch/internal/config"
	"github.com/liedsonlb/resenha-patch/internal/queue"
	"github.com/liedsonlb/resenha-patch/internal/service"
	"github.com/liedsonlb/resenha-patch/internal/worker"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("⚠️ .env não encontrado (usando variáveis do sistema)")
	}

	cfg := config.Load()

	var rabbit *queue.RabbitMQ
	for {
		conn, err := queue.NewRabbitMQ(cfg.RabbitURL)
		if err == nil {
			rabbit = conn
			break
		}
		log.Printf("⚠️  RabbitMQ indisponível (%v); tentando novamente em 3s...", err)
		time.Sleep(3 * time.Second)
	}
	defer rabbit.Close()

	emailService := service.NewEmailService(cfg)

	go worker.StartEmailWorker(rabbit, emailService)

	log.Println("🚀 Worker EMAIL do WebLEIA iniciado")
	log.Println("📌 Pressione CTRL+C para derrubar este worker")

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan

	log.Println("📴 Worker EMAIL desligado")
}
