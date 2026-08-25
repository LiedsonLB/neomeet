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

// UploadHandler salva imagens enviadas pelos usuários (foto/banner de
// perfil, ícone/banner de comunidade) em disco, numa pasta fora de
// backend/ e frontend/ — na raiz do projeto — para que depois um nginx
// possa apontar direto pra ela (proxy_pass /uploads/ -> essa pasta) sem
// passar pela API Go. Antes desse arquivo a rota nem estava registrada em
// internal/router/router.go, então nenhuma imagem era de fato persistida —
// isso foi corrigido junto (ver router.go).
type UploadHandler struct {
	uploadDir string
}

func NewUploadHandler(uploadDir string) *UploadHandler {
	return &UploadHandler{uploadDir: uploadDir}
}

const maxUploadSize = 5 << 20    // 5MB
const maxSomUploadSize = 2 << 20 // 2MB — sons do soundboard são clipes curtos

var allowedImageExt = map[string]bool{
	".jpg": true, ".jpeg": true, ".png": true, ".webp": true, ".gif": true, ".jfif": true,
}

var allowedAudioExt = map[string]bool{
	".mp3": true, ".wav": true, ".ogg": true, ".m4a": true,
}

// pastasPermitidas restringe onde o cliente pode gravar, evitando path
// traversal via o campo "pasta" do form (ex.: "../../etc").
var pastasPermitidas = map[string]bool{
	"fotos":       true, // foto de perfil do usuário
	"banners":     true, // banner de perfil do usuário
	"comunidades": true, // ícone/banner de uma comunidade
}

func randomFileName() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// Foto handles POST /upload/foto (multipart/form-data):
//   - campo "arquivo": obrigatório, a imagem.
//   - campo "pasta": opcional, uma de pastasPermitidas (default "fotos").
//   - campo "foto_antiga": opcional, URL antiga (na mesma pasta) a apagar.
//
// Valida o arquivo, salva em <UploadDir>/<pasta>/<token>.<ext> e devolve o
// caminho público (`/uploads/<pasta>/<token>.<ext>`) pra ser gravado via
// PUT /usuarios/{id} (foto/banner) ou PUT/POST /comunidades (icone_url/
// banner_url).
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

	pasta := r.FormValue("pasta")
	if pasta == "" {
		pasta = "fotos"
	}
	if !pastasPermitidas[pasta] {
		httpx.Error(w, "Pasta de upload inválida.", 422)
		return
	}

	// Receber a URL do arquivo antigo para deletar (enviada via form-data)
	oldFotoURL := r.FormValue("foto_antiga") // Ex: "/uploads/fotos/abc123.jpg"

	// Cria a pasta se não existir
	folder := filepath.Join(h.uploadDir, pasta)
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

	// Apaga o arquivo antigo (se existir e não for o mesmo que o novo)
	if oldFotoURL != "" {
		prefix := "/uploads/" + pasta + "/"
		oldFileName := strings.TrimPrefix(oldFotoURL, prefix)
		if oldFileName == oldFotoURL {
			oldFileName = strings.TrimPrefix(oldFotoURL, strings.TrimPrefix(prefix, "/"))
		}
		if oldFileName != "" && oldFileName != oldFotoURL && oldFileName != name {
			_ = os.Remove(filepath.Join(folder, oldFileName))
		}
	}

	httpx.JSON(w, 201, map[string]any{
		"url": "/uploads/" + pasta + "/" + name,
	})
}

// ProducaoImagem handles POST /upload/producao-imagem (multipart/form-data,
// campo "arquivo"): salva a imagem inserida pelo editor de texto rico em
// <UploadDir>/producoes/<token>.<ext> e devolve `{url}`. Diferente da foto
// de perfil, aqui não há "foto antiga" pra apagar: uma produção pode ter
// várias imagens ao longo do texto.
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

// Som handles POST /upload/som (multipart/form-data, campo "arquivo"):
// salva um clipe de áudio do soundboard de uma comunidade em
// <UploadDir>/sons/<token>.<ext> e devolve `{url}` — usado por
// POST /comunidades/{id}/sons (ver comunidade_som_handler.go).
func (h *UploadHandler) Som(w http.ResponseWriter, r *http.Request) {
	session := middleware.UserFromContext(r)
	if session == nil {
		httpx.Error(w, "Não autenticado.", 401)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxSomUploadSize+1<<20)
	if err := r.ParseMultipartForm(maxSomUploadSize); err != nil {
		httpx.Error(w, "Arquivo inválido ou muito grande (máximo 2MB).", 422)
		return
	}

	file, header, err := r.FormFile("arquivo")
	if err != nil {
		httpx.Error(w, "Envie o arquivo no campo \"arquivo\".", 422)
		return
	}
	defer file.Close()

	ext := strings.ToLower(filepath.Ext(header.Filename))
	if !allowedAudioExt[ext] {
		httpx.Error(w, "Formato não suportado. Use mp3, wav, ogg ou m4a.", 422)
		return
	}

	folder := filepath.Join(h.uploadDir, "sons")
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
		"url": "/uploads/sons/" + name,
	})
}
