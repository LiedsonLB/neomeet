package models

// Cidade maps 1:1 to the `cidade` table.
//
//	CREATE TABLE `cidade` (
//	  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
//	  `nome` varchar(255) NOT NULL,
//	  `uf` char(2) NOT NULL,
//	  PRIMARY KEY (`id`)
//	)
type Cidade struct {
	ID   int64  `json:"id" db:"id"`
	Nome string `json:"nome" db:"nome"`
	UF   string `json:"uf" db:"uf"`
}

func (Cidade) TableName() string { return "cidade" }
