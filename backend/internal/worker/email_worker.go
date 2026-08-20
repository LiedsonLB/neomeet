package worker

import (
	"encoding/json"
	"log"

	"github.com/liedsonlb/resenha-patch/internal/models"
	"github.com/liedsonlb/resenha-patch/internal/queue"
	"github.com/liedsonlb/resenha-patch/internal/service"
)

// StartEmailWorker consome a fila webleia.emails e envia cada EmailJob por
// SMTP (com o template HTML correspondente a job.Tipo). Mesma estrutura de
// consumo usada no worker-email do projeto Mensageria, adaptada para
// mensagens genéricas em vez de só "danfe pronta".
func StartEmailWorker(rabbit *queue.RabbitMQ, emailService *service.EmailService) {
	log.Println("📧 Worker de Email: conectando à fila", queue.QueueEmail)

	msgs, err := rabbit.Consume(queue.QueueEmail)
	if err != nil {
		log.Fatalf("❌ Erro ao consumir fila %s: %v", queue.QueueEmail, err)
	}

	log.Println("✅ Worker de Email aguardando mensagens...")

	for msg := range msgs {
		var job models.EmailJob
		if err := json.Unmarshal(msg.Body, &job); err != nil {
			log.Printf("❌ Erro ao parsear EmailJob: %v", err)
			msg.Nack(false, false) // descarta mensagem malformada (não requeue)
			continue
		}

		log.Printf("📨 Processando email tipo=%s destinatario=%s", job.Tipo, job.Destinatario)

		if err := emailService.Enviar(job); err != nil {
			log.Printf("❌ Erro ao enviar email para %s: %v", job.Destinatario, err)
			// requeue para tentar de novo (ex: falha temporária de SMTP)
			msg.Nack(false, true)
			continue
		}

		log.Printf("✅ Email enviado para %s (tipo=%s)", job.Destinatario, job.Tipo)
		msg.Ack(false)
	}
}
