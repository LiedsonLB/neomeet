package repository

import (
	"database/sql"
	"time"
)

// PasswordResetRepository manages `password_reset_tokens`, matching the
// production table exactly: `email` is the primary key (one active reset
// per e-mail at a time), plus `token` and `created_at`.
type PasswordResetRepository struct{ db *sql.DB }

func NewPasswordResetRepository(db *sql.DB) *PasswordResetRepository {
	return &PasswordResetRepository{db: db}
}

// ResetTokenTTL is how long a reset link/token stays valid after creation.
const ResetTokenTTL = 60 * time.Minute

// Create replaces any existing token for that e-mail (email is PK) and
// stores the new one with the current timestamp.
func (r *PasswordResetRepository) Create(email, token string) error {
	_, err := r.db.Exec(
		`INSERT INTO password_reset_tokens (email, token, created_at) VALUES (?, ?, NOW())
		 ON DUPLICATE KEY UPDATE token = VALUES(token), created_at = NOW()`,
		email, token,
	)
	return err
}

// Verify returns true if the given email+token pair exists and hasn't
// expired yet (ResetTokenTTL after creation).
func (r *PasswordResetRepository) Verify(email, token string) (bool, error) {
	var createdAt time.Time
	err := r.db.QueryRow(
		"SELECT created_at FROM password_reset_tokens WHERE email = ? AND token = ?",
		email, token,
	).Scan(&createdAt)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if time.Since(createdAt) > ResetTokenTTL {
		return false, nil
	}
	return true, nil
}

// Delete removes the token once it's been used (or invalidated).
func (r *PasswordResetRepository) Delete(email string) error {
	_, err := r.db.Exec("DELETE FROM password_reset_tokens WHERE email = ?", email)
	return err
}
