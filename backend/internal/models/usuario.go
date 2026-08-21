package models

import "time"

// Perfil values, mirroring App\Config\Constantes
const (
	PerfilAdmin = 1
	PerfilAluno = 2
)

// Usuario maps 1:1 to the `usuario` table exactly as it exists in the
// production database (see backend/database/hmgmobieduca_webleia_usuario.sql
// in the original Laravel project). Column names/types were not changed so
// the same MySQL database can keep being used without any migration.
//
//	CREATE TABLE `usuario` (
//	  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
//	  `nome` varchar(255) NOT NULL,
//	  `email` varchar(255) NOT NULL,
//	  `senha` varchar(255) NOT NULL,
//	  `foto` varchar(255) DEFAULT NULL,
//	  `perfil` tinyint unsigned NOT NULL,
//	  `email_verified_at` timestamp NULL DEFAULT NULL,
//	  `remember_token` varchar(255) DEFAULT NULL,
//	  `created_at` timestamp NULL DEFAULT NULL,
//	  `updated_at` timestamp NULL DEFAULT NULL,
//	  `deleted_at` timestamp NULL DEFAULT NULL,
//	  `aluno_id` bigint unsigned DEFAULT NULL,
//	  PRIMARY KEY (`id`),
//	  UNIQUE KEY `usuario_email_unique` (`email`),
//	  FOREIGN KEY (`aluno_id`) REFERENCES `aluno` (`id`)
//	)
type Usuario struct {
	ID    int64   `json:"id" db:"id"`
	Nome  string  `json:"nome" db:"nome"`
	Email string  `json:"email" db:"email"`
	Senha string  `json:"-" db:"senha"`
	Foto  *string `json:"foto" db:"foto"`
	// Banner mostrado no topo do perfil (Perfil.tsx). Moldura é o
	// identificador (preset) do anel decorativo em volta do avatar, ver
	// frontend/src/components/Avatar.tsx — nenhum dos dois faz parte do
	// schema original do WebLEIA, adicionados em 0003_comunidades.up.sql.
	Banner          *string    `json:"banner" db:"banner"`
	Moldura         *string    `json:"moldura" db:"moldura"`
	Perfil          int        `json:"perfil" db:"perfil"`
	EmailVerifiedAt *time.Time `json:"email_verified_at" db:"email_verified_at"`
	CreatedAt       *time.Time `json:"created_at" db:"created_at"`
	UpdatedAt       *time.Time `json:"updated_at" db:"updated_at"`
	DeletedAt       *time.Time `json:"-" db:"deleted_at"`
	AlunoID         *int64     `json:"aluno_id" db:"aluno_id"`

	// Computed/derived fields, added at response time (not DB columns),
	// mirroring Usuario::toArray() adding foto_url/thumb.
	FotoURL *string `json:"foto_url,omitempty" db:"-"`
	Thumb   *string `json:"thumb,omitempty" db:"-"`
}

func (u *Usuario) IsAdmin() bool { return u.Perfil == PerfilAdmin }
func (u *Usuario) IsAluno() bool { return u.Perfil == PerfilAluno }

// TableName is kept explicit (rather than pluralizing/guessing) so it is
// always obvious which physical table this struct reads/writes.
func (Usuario) TableName() string { return "usuario" }
