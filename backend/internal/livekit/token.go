// Package livekit gera tokens de acesso (JWT) compatíveis com o protocolo
// do LiveKit Server, no mesmo formato que o `livekit-server-sdk` (Node/Go)
// produz — isso evita puxar o SDK oficial como dependência só para assinar
// um JWT: é um HS256 comum com um claim "video" contendo os grants.
//
// Referência do formato (mesmo usado no NeoMeet, via livekit-server-sdk JS):
//
//	{
//	  "exp": ...,
//	  "iss": "<api key>",
//	  "nbf": ...,
//	  "sub": "<identity>",
//	  "name": "<display name>",
//	  "video": {
//	    "room": "<nome da sala>",
//	    "roomJoin": true,
//	    "canPublish": true,
//	    "canSubscribe": true,
//	    "canPublishData": true
//	  }
//	}
package livekit

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"time"
)

type VideoGrant struct {
	RoomJoin       bool   `json:"roomJoin,omitempty"`
	Room           string `json:"room,omitempty"`
	CanPublish     bool   `json:"canPublish,omitempty"`
	CanSubscribe   bool   `json:"canSubscribe,omitempty"`
	CanPublishData bool   `json:"canPublishData,omitempty"`
	// CanUpdateOwnMetadata permite ao participante chamar
	// localParticipant.setMetadata() depois de conectado — usado para
	// publicar o estado de "ensurdecido" (deafened), que o LiveKit não
	// sabe sozinho (não corresponde a nenhuma track silenciada), para que
	// quem ainda não entrou no canal também veja esse selo (ver
	// ListParticipants em internal/livekit/roomservice.go).
	CanUpdateOwnMetadata bool `json:"canUpdateOwnMetadata,omitempty"`
	RoomAdmin            bool `json:"roomAdmin,omitempty"`
	RoomCreate           bool `json:"roomCreate,omitempty"`
}

type claims struct {
	Exp      int64      `json:"exp"`
	Iss      string     `json:"iss"`
	Nbf      int64      `json:"nbf"`
	Sub      string     `json:"sub"`
	Name     string     `json:"name,omitempty"`
	Metadata string     `json:"metadata,omitempty"`
	Video    VideoGrant `json:"video"`
}

type header struct {
	Alg string `json:"alg"`
	Typ string `json:"typ"`
}

// TokenBuilder monta as opções de um token antes de assiná-lo.
type TokenBuilder struct {
	apiKey    string
	apiSecret string
	identity  string
	name      string
	metadata  string
	ttl       time.Duration
	grant     VideoGrant
}

func NewTokenBuilder(apiKey, apiSecret string) *TokenBuilder {
	return &TokenBuilder{apiKey: apiKey, apiSecret: apiSecret, ttl: 6 * time.Hour}
}

func (b *TokenBuilder) Identity(identity string) *TokenBuilder { b.identity = identity; return b }
func (b *TokenBuilder) Name(name string) *TokenBuilder         { b.name = name; return b }
func (b *TokenBuilder) Metadata(m string) *TokenBuilder        { b.metadata = m; return b }
func (b *TokenBuilder) TTL(ttl time.Duration) *TokenBuilder    { b.ttl = ttl; return b }

// Grant define a room + permissões concedidas (mesma semântica do
// AccessToken.addGrant do SDK oficial).
func (b *TokenBuilder) Grant(g VideoGrant) *TokenBuilder { b.grant = g; return b }

func base64url(b []byte) string {
	return base64.RawURLEncoding.EncodeToString(b)
}

// Sign gera o JWT final (header.payload.signature) assinado com HS256.
func (b *TokenBuilder) Sign() (string, error) {
	if b.apiKey == "" || b.apiSecret == "" {
		return "", errors.New("livekit: API key/secret não configurados (LIVEKIT_API_KEY / LIVEKIT_API_SECRET)")
	}
	if b.identity == "" {
		return "", errors.New("livekit: identity é obrigatório")
	}

	now := time.Now()
	c := claims{
		Exp:      now.Add(b.ttl).Unix(),
		Iss:      b.apiKey,
		Nbf:      now.Add(-10 * time.Second).Unix(),
		Sub:      b.identity,
		Name:     b.name,
		Metadata: b.metadata,
		Video:    b.grant,
	}

	h := header{Alg: "HS256", Typ: "JWT"}
	headerJSON, err := json.Marshal(h)
	if err != nil {
		return "", err
	}
	payloadJSON, err := json.Marshal(c)
	if err != nil {
		return "", err
	}

	signingInput := base64url(headerJSON) + "." + base64url(payloadJSON)

	mac := hmac.New(sha256.New, []byte(b.apiSecret))
	mac.Write([]byte(signingInput))
	sig := mac.Sum(nil)

	return signingInput + "." + base64url(sig), nil
}