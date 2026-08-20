package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/liedsonlb/resenha-patch/internal/httpx"
	"github.com/liedsonlb/resenha-patch/internal/middleware"
)

// UploadHandler salva imagens enviadas pelos usuários (foto de perfil, por
// enquanto) em disco, numa pasta fora de backend/ e frontend/ — na raiz do
// projeto — para que depois um nginx possa apontar direto pra ela
// (proxy_pass /uploads/ -> essa pasta) sem passar pela API Go.
type UploadHandler struct {
	uploadDir string
}

func NewUploadHandler(uploadDir string) *UploadHandler {
	return &UploadHandler{uploadDir: uploadDir}
}

const maxUploadSize = 5 << 20 // 5MB

var allowedImageExt = map[string]bool{
	".jpg": true, ".jpeg": true, ".png": true, ".webp": true, ".gif": true, ".jfif": true,
}

// Foto handles POST /upload/foto (multipart/form-data, campo "arquivo"):
// valida o arquivo, salva em <UploadDir>/fotos/<token>.<ext> e devolve o
// caminho público (`/uploads/fotos/<token>.<ext>`) pra ser gravado em
// usuario.foto via PUT /usuarios/{id}.
func (h *UploadHandler) Foto(w http.ResponseWriter, r *http.Request) {
	session := middleware.UserFromContext(r)
	if session == nil {
		httpx.Error(w, "Não autenticado.", 401)
		return
	}

	// Limita o tamanho do upload
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize+1<<20)
	if err := r.ParseMultipartForm(maxUploadSize); err != nil {
		httpx.Error(w, "Arquivo inválido ou muito grande (máximo 5MB).", 422)
		return
	}

	// Pega o arquivo do form
	file, header, err := r.FormFile("arquivo")
	if err != nil {
		httpx.Error(w, "Envie o arquivo no campo \"arquivo\".", 422)
		return
	}
	defer file.Close()

	// Valida extensão
	ext := strings.ToLower(filepath.Ext(header.Filename))
	if !allowedImageExt[ext] {
		httpx.Error(w, "Formato não suportado. Use jpg, png, webp ou gif.", 422)
		return
	}

	// Receber a URL da foto antiga para deletar (enviada via form-data)
	oldFotoURL := r.FormValue("foto_antiga") // Ex: "/uploads/fotos/abc123.jpg"

	// Cria a pasta se não existir
	folder := filepath.Join(h.uploadDir, "fotos")
	if err := os.MkdirAll(folder, 0755); err != nil {
		httpx.Error(w, "Erro interno ao preparar armazenamento.", 500)
		return
	}

	// Gera nome aleatório para o arquivo
	name, err := randomFileName()
	if err != nil {
		httpx.Error(w, "Erro interno.", 500)
		return
	}
	name += ext

	// Salva o novo arquivo
	dst, err := os.Create(filepath.Join(folder, name))
	if err != nil {
		httpx.Error(w, "Erro interno ao salvar o arquivo.", 500)
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		httpx.Error(w, "Erro interno ao salvar o arquivo.", 500)
		return
	}

	// Apaga a foto antiga (se existir e não for a mesma que a nova)
	if oldFotoURL != "" {
		oldFileName := strings.TrimPrefix(oldFotoURL, "/uploads/fotos/")
		if oldFileName == oldFotoURL {
			// Tenta sem a barra inicial
			oldFileName = strings.TrimPrefix(oldFotoURL, "uploads/fotos/")
		}
		if oldFileName != "" && oldFileName != name {
			oldPath := filepath.Join(folder, oldFileName)
			_ = os.Remove(oldPath) // Ignora erro se o arquivo não existir
		}
	}

	httpx.JSON(w, 201, map[string]any{
		"url": "/uploads/fotos/" + name,
	})
}

func randomFileName() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// ProducaoImagem handles POST /upload/producao-imagem (multipart/form-data,
// campo "arquivo"): salva a imagem inserida pelo editor de texto rico em
// <UploadDir>/producoes/<token>.<ext> e devolve `{url}` — o mesmo formato
// que o editor (RichTextEditor.tsx) espera para inserir a imagem no
// conteúdo. Diferente da foto de perfil, aqui não há "foto antiga" pra
// apagar: uma produção pode ter várias imagens ao longo do texto.
func (h *UploadHandler) ProducaoImagem(w http.ResponseWriter, r *http.Request) {
	session := middleware.UserFromContext(r)
	if session == nil {
		httpx.Error(w, "Não autenticado.", 401)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize+1<<20)
	if err := r.ParseMultipartForm(maxUploadSize); err != nil {
		httpx.Error(w, "Arquivo inválido ou muito grande (máximo 5MB).", 422)
		return
	}

	file, header, err := r.FormFile("arquivo")
	if err != nil {
		httpx.Error(w, "Envie o arquivo no campo \"arquivo\".", 422)
		return
	}
	defer file.Close()

	ext := strings.ToLower(filepath.Ext(header.Filename))
	if !allowedImageExt[ext] {
		httpx.Error(w, "Formato não suportado. Use jpg, png, webp ou gif.", 422)
		return
	}

	folder := filepath.Join(h.uploadDir, "producoes")
	if err := os.MkdirAll(folder, 0755); err != nil {
		httpx.Error(w, "Erro interno ao preparar armazenamento.", 500)
		return
	}

	name, err := randomFileName()
	if err != nil {
		httpx.Error(w, "Erro interno.", 500)
		return
	}
	name += ext

	dst, err := os.Create(filepath.Join(folder, name))
	if err != nil {
		httpx.Error(w, "Erro interno ao salvar o arquivo.", 500)
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		httpx.Error(w, "Erro interno ao salvar o arquivo.", 500)
		return
	}

	httpx.JSON(w, 201, map[string]any{
		"url": "/uploads/producoes/" + name,
	})
}
