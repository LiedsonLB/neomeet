// Package httpx contains small helpers for writing JSON responses in the
// exact shape the existing frontend/mobile clients already expect from the
// Laravel API (so the client apps don't need to change).
package httpx

import (
	"encoding/json"
	"net/http"
)

func JSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

// Success mirrors ApiController::responseJsonSucess
func Success(w http.ResponseWriter, message string, status int) {
	JSON(w, status, map[string]any{"message": message, "code": status})
}

// Error mirrors ApiController::responseJsonError
func Error(w http.ResponseWriter, message string, status int) {
	if status < 400 || status > 599 {
		status = 500
	}
	JSON(w, status, map[string]any{"message": message, "code": status})
}

// ErrorWithFields mirrors ApiController::responseJsonErrorData (validation errors)
func ErrorWithFields(w http.ResponseWriter, message string, fields map[string]string, status int) {
	if status < 400 || status > 599 {
		status = 500
	}
	JSON(w, status, map[string]any{"message": message, "code": status, "errors": fields})
}

// Paginated mirrors the shape of Laravel's ->paginate($limit) response.
type Paginated struct {
	Data        any   `json:"data"`
	CurrentPage int   `json:"current_page"`
	PerPage     int   `json:"per_page"`
	Total       int64 `json:"total"`
	LastPage    int   `json:"last_page"`
}
