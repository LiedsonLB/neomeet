package database

import (
	"database/sql"
	"time"

	_ "github.com/go-sql-driver/mysql"

	"github.com/liedsonlb/resenha-patch/internal/config"
)

// Connect opens a pooled connection to the exact same MySQL database used
// by the legacy Laravel app. No tables, columns or engines are touched here
// -- we only read/write using the existing schema.
func Connect(cfg *config.Config) (*sql.DB, error) {
	db, err := sql.Open("mysql", cfg.DSN())
	if err != nil {
		return nil, err
	}

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(25)
	db.SetConnMaxLifetime(5 * time.Minute)

	if err := db.Ping(); err != nil {
		return nil, err
	}

	return db, nil
}
