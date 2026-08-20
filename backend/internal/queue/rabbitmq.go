// Package queue encapsula a conexão com o RabbitMQ usada pelos workers de
// email e de exportação de produções textuais. Segue o mesmo padrão já usado
// no projeto Mensageria (canal isolado por publish/consume, filas duráveis).
package queue

import (
	"encoding/json"
	"fmt"
	"log"

	amqp "github.com/streadway/amqp"
)

// Nomes das filas usadas pelo WebLEIA.
const (
	QueueEmail            = "webleia.emails"
	QueueExport           = "webleia.exportacoes"
	QueueExportConcluida  = "webleia.exportacoes.concluidas"
)

type RabbitMQ struct {
	conn *amqp.Connection
	ch   *amqp.Channel
	url  string
}

// NewRabbitMQ conecta ao broker e mantém um channel principal para publish
// rápido. Cada consumer abre seu próprio channel (newChannel), evitando
// concorrência sobre o mesmo *amqp.Channel.
//
// Retorna (nil, err) em vez de matar o processo quando o broker não está
// disponível — a API e os workers devem continuar funcionando sem fila
// (o mailer cai para envio direto/log, ver internal/mailer).
func NewRabbitMQ(url string) (*RabbitMQ, error) {
	conn, err := amqp.Dial(url)
	if err != nil {
		return nil, fmt.Errorf("erro ao conectar RabbitMQ: %w", err)
	}

	ch, err := conn.Channel()
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("erro ao criar channel: %w", err)
	}

	r := &RabbitMQ{conn: conn, ch: ch, url: url}
	if err := r.setupQueues(); err != nil {
		r.Close()
		return nil, fmt.Errorf("erro ao declarar filas: %w", err)
	}
	log.Println("✅ Conectado ao RabbitMQ")
	return r, nil
}

func (r *RabbitMQ) newChannel() (*amqp.Channel, error) {
	return r.conn.Channel()
}

// setupQueues declara as filas duráveis usadas pela aplicação. Chamado uma
// vez na conexão tanto pela API (produtora) quanto pelos workers
// (consumidores), então a ordem de start não importa.
func (r *RabbitMQ) setupQueues() error {
	for _, q := range []string{QueueEmail, QueueExport, QueueExportConcluida} {
		if _, err := r.ch.QueueDeclare(q, true, false, false, false, nil); err != nil {
			return err
		}
	}
	return nil
}

// Publish serializa `payload` em JSON e publica na fila indicada.
func (r *RabbitMQ) Publish(queue string, payload interface{}) error {
	ch, err := r.newChannel()
	if err != nil {
		return err
	}
	defer ch.Close()

	if _, err := ch.QueueDeclare(queue, true, false, false, false, nil); err != nil {
		return err
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	return ch.Publish("", queue, false, false, amqp.Publishing{
		ContentType:  "application/json",
		DeliveryMode: amqp.Persistent,
		Body:         body,
	})
}

// Consume retorna um canal de deliveries com ack manual e prefetch=1 (um job
// por vez, só confirma quando o worker realmente terminou de processar).
func (r *RabbitMQ) Consume(queue string) (<-chan amqp.Delivery, error) {
	ch, err := r.newChannel()
	if err != nil {
		return nil, err
	}

	if _, err := ch.QueueDeclare(queue, true, false, false, false, nil); err != nil {
		return nil, err
	}

	if err := ch.Qos(1, 0, false); err != nil {
		return nil, err
	}

	return ch.Consume(queue, "", false, false, false, false, nil)
}

func (r *RabbitMQ) Close() {
	if r.ch != nil {
		r.ch.Close()
	}
	if r.conn != nil {
		r.conn.Close()
		log.Println("🔌 RabbitMQ conexão encerrada")
	}
}
