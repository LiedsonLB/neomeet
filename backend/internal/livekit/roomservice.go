package livekit

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/liedsonlb/resenha-patch/internal/models"
)

// httpBaseURL converte a URL de conexão do LiveKit (ws:// ou wss://, a
// mesma usada pelos clientes do navegador) para o endpoint HTTP(S)
// equivalente, onde vive a API REST/Twirp do RoomService.
func httpBaseURL(livekitURL string) string {
	switch {
	case strings.HasPrefix(livekitURL, "wss://"):
		return "https://" + strings.TrimPrefix(livekitURL, "wss://")
	case strings.HasPrefix(livekitURL, "ws://"):
		return "http://" + strings.TrimPrefix(livekitURL, "ws://")
	default:
		return strings.TrimRight(livekitURL, "/")
	}
}

type twirpTrack struct {
	Type  string `json:"type"`
	Muted bool   `json:"muted"`
}

type twirpParticipant struct {
	Identity string       `json:"identity"`
	Name     string       `json:"name"`
	Metadata string       `json:"metadata"`
	Tracks   []twirpTrack `json:"tracks"`
}

type twirpListParticipantsResponse struct {
	Participants []twirpParticipant `json:"participants"`
}

// ListParticipants chama `RoomService.ListParticipants` diretamente via
// REST/Twirp (POST JSON + Bearer JWT com grant roomAdmin), sem precisar do
// pacote oficial `livekit-server-sdk-go` — mesma filosofia do token.go,
// que já assina os JWTs de acesso na mão. Isso dá a lista REAL de quem
// está na sala agora (áudio/vídeo), diferente da tabela em memória
// interna (internal/realtime.Hub), que só sabia de quem tinha aberto a
// conexão SSE de progresso — nunca de presença de voz de verdade.
func ListParticipants(livekitURL, apiKey, apiSecret, room string) ([]models.ParticipanteInfo, error) {
	token, err := NewTokenBuilder(apiKey, apiSecret).
		Identity(apiKey).
		TTL(1 * time.Minute).
		Grant(VideoGrant{RoomAdmin: true, Room: room}).
		Sign()
	if err != nil {
		return nil, err
	}

	body, _ := json.Marshal(map[string]string{"room": room})
	req, err := http.NewRequest(http.MethodPost, httpBaseURL(livekitURL)+"/twirp/livekit.RoomService/ListParticipants", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 4 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		// Sala ainda não existe no LiveKit (ninguém entrou ainda) — não é
		// um erro de verdade, só significa "zero participantes".
		if resp.StatusCode == http.StatusNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("livekit: ListParticipants falhou (%d): %s", resp.StatusCode, string(raw))
	}

	var out twirpListParticipantsResponse
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, err
	}

	participantes := make([]models.ParticipanteInfo, 0, len(out.Participants))
	for _, p := range out.Participants {
		var meta struct {
			Nome    string `json:"nome"`
			Foto    string `json:"foto"`
			Moldura string `json:"moldura"`
		}
		_ = json.Unmarshal([]byte(p.Metadata), &meta)

		nome := meta.Nome
		if nome == "" {
			nome = p.Name
		}
		if nome == "" {
			nome = p.Identity
		}

		micEnabled := false
		for _, t := range p.Tracks {
			if strings.EqualFold(t.Type, "AUDIO") && !t.Muted {
				micEnabled = true
				break
			}
		}

		participantes = append(participantes, models.ParticipanteInfo{
			Identity:   p.Identity,
			Nome:       nome,
			Foto:       meta.Foto,
			Moldura:    meta.Moldura,
			MicEnabled: micEnabled,
		})
	}
	return participantes, nil
}
