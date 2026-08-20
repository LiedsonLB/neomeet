package database

import (
	"database/sql"
	"embed"
	"fmt"
	"log"
	"sort"
	"strings"

	_ "github.com/go-sql-driver/mysql"
)

//go:embed migrations/*.up.sql
var upMigrations embed.FS

//go:embed migrations/*.down.sql
var downMigrations embed.FS

// MigrationManager gerencia as migrations utilizando a tabela
// "migrations" já existente no banco de dados.
//
// Estrutura esperada da tabela:
//
//	id         BIGINT UNSIGNED
//	migration  VARCHAR(...)
//	batch      INT
//
// O campo "migration" armazena o nome da migration sem ".up.sql".
type MigrationManager struct {
	db *sql.DB
}

func NewMigrationManager(db *sql.DB) *MigrationManager {
	return &MigrationManager{
		db: db,
	}
}

// Up aplica todas as migrations pendentes em ordem.
func (m *MigrationManager) Up() error {
	log.Println("🔄 Iniciando aplicação de migrations...")

	// Garante que a tabela exista caso o banco seja novo.
	if err := m.createMigrationsTable(); err != nil {
		return fmt.Errorf("erro ao criar tabela de migrations: %w", err)
	}

	// Lista os arquivos .up.sql incorporados no binário.
	files, err := upMigrations.ReadDir("migrations")
	if err != nil {
		return fmt.Errorf("erro ao ler migrations: %w", err)
	}

	var upFiles []string

	for _, file := range files {
		if file.IsDir() {
			continue
		}

		if strings.HasSuffix(file.Name(), ".up.sql") {
			upFiles = append(upFiles, file.Name())
		}
	}

	sort.Strings(upFiles)

	if len(upFiles) == 0 {
		log.Println("⚠️ Nenhuma migration encontrada.")
		return nil
	}

	// Descobre o próximo batch.
	batch, err := m.nextBatch()
	if err != nil {
		return fmt.Errorf("erro ao obter próximo batch: %w", err)
	}

	for _, fileName := range upFiles {
		version := strings.TrimSuffix(fileName, ".up.sql")

		// Verifica se já foi aplicada.
		applied, err := m.isApplied(version)
		if err != nil {
			return fmt.Errorf(
				"erro ao verificar migration %s: %w",
				version,
				err,
			)
		}

		if applied {
			log.Printf(
				"⚠️ Migration %s já foi aplicada, pulando...",
				version,
			)
			continue
		}

		// Lê o conteúdo da migration.
		content, err := upMigrations.ReadFile(
			"migrations/" + fileName,
		)
		if err != nil {
			return fmt.Errorf(
				"erro ao ler arquivo %s: %w",
				fileName,
				err,
			)
		}

		// Executa a migration dentro de uma transação.
		tx, err := m.db.Begin()
		if err != nil {
			return fmt.Errorf(
				"erro ao iniciar transação para %s: %w",
				version,
				err,
			)
		}

		log.Printf("🔄 Aplicando migration: %s", version)

		if _, err := tx.Exec(string(content)); err != nil {
			_ = tx.Rollback()

			return fmt.Errorf(
				"erro ao executar migration %s: %w",
				version,
				err,
			)
		}

		// Registra a migration usando o formato existente:
		//
		// migrations(id, migration, batch)
		_, err = tx.Exec(
			"INSERT INTO migrations (migration, batch) VALUES (?, ?)",
			version,
			batch,
		)
		if err != nil {
			_ = tx.Rollback()

			return fmt.Errorf(
				"erro ao registrar migration %s: %w",
				version,
				err,
			)
		}

		if err := tx.Commit(); err != nil {
			return fmt.Errorf(
				"erro ao commitar migration %s: %w",
				version,
				err,
			)
		}

		log.Printf(
			"✅ Migration %s aplicada com sucesso",
			version,
		)

		// Todas as migrations executadas nessa chamada
		// pertencem ao mesmo batch.
	}

	log.Println("✅ Todas as migrations aplicadas com sucesso!")

	return nil
}

// Down executa o rollback de uma migration específica.
func (m *MigrationManager) Down(version string) error {
	log.Printf(
		"🔄 Iniciando rollback da migration: %s",
		version,
	)

	// Verifica se a migration está registrada.
	applied, err := m.isApplied(version)
	if err != nil {
		return fmt.Errorf(
			"erro ao verificar migration %s: %w",
			version,
			err,
		)
	}

	if !applied {
		return fmt.Errorf(
			"migration %s não foi aplicada",
			version,
		)
	}

	// Localiza o arquivo .down.sql.
	downFile := fmt.Sprintf(
		"migrations/%s.down.sql",
		version,
	)

	content, err := downMigrations.ReadFile(downFile)
	if err != nil {
		return fmt.Errorf(
			"arquivo de rollback não encontrado para %s: %w",
			version,
			err,
		)
	}

	// Executa rollback em transação.
	tx, err := m.db.Begin()
	if err != nil {
		return fmt.Errorf(
			"erro ao iniciar transação de rollback: %w",
			err,
		)
	}

	if _, err := tx.Exec(string(content)); err != nil {
		_ = tx.Rollback()

		return fmt.Errorf(
			"erro ao executar rollback de %s: %w",
			version,
			err,
		)
	}

	// A tabela migrations não possui rolled_back_at.
	//
	// Portanto, rollback = remover o registro.
	_, err = tx.Exec(
		"DELETE FROM migrations WHERE migration = ?",
		version,
	)
	if err != nil {
		_ = tx.Rollback()

		return fmt.Errorf(
			"erro ao remover registro da migration %s: %w",
			version,
			err,
		)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf(
			"erro ao commitar rollback de %s: %w",
			version,
			err,
		)
	}

	log.Printf(
		"✅ Rollback da migration %s concluído",
		version,
	)

	return nil
}

// RollbackLast executa rollback da última migration
// pertencente ao conjunto de migrations do Go.
//
// Isso é importante porque a tabela migrations também pode
// conter migrations antigas do Laravel.
func (m *MigrationManager) RollbackLast() error {
	files, err := upMigrations.ReadDir("migrations")
	if err != nil {
		return fmt.Errorf(
			"erro ao ler migrations: %w",
			err,
		)
	}

	// Monta um conjunto com as migrations conhecidas pelo Go.
	knownMigrations := make(map[string]struct{})

	for _, file := range files {
		if file.IsDir() {
			continue
		}

		if !strings.HasSuffix(file.Name(), ".up.sql") {
			continue
		}

		version := strings.TrimSuffix(
			file.Name(),
			".up.sql",
		)

		knownMigrations[version] = struct{}{}
	}

	if len(knownMigrations) == 0 {
		return fmt.Errorf(
			"nenhuma migration do Go foi encontrada",
		)
	}

	// Busca as migrations registradas, da mais recente
	// para a mais antiga.
	rows, err := m.db.Query(`
		SELECT migration
		FROM migrations
		ORDER BY id DESC
	`)
	if err != nil {
		return fmt.Errorf(
			"erro ao buscar migrations: %w",
			err,
		)
	}
	defer rows.Close()

	for rows.Next() {
		var migration string

		if err := rows.Scan(&migration); err != nil {
			return fmt.Errorf(
				"erro ao ler migration: %w",
				err,
			)
		}

		// Ignora migrations antigas do Laravel.
		if _, ok := knownMigrations[migration]; !ok {
			continue
		}

		return m.Down(migration)
	}

	if err := rows.Err(); err != nil {
		return fmt.Errorf(
			"erro ao percorrer migrations: %w",
			err,
		)
	}

	return fmt.Errorf(
		"nenhuma migration do Go foi aplicada",
	)
}

// Status mostra o status das migrations conhecidas pelo Go.
//
// Migrations antigas do Laravel que não possuem um arquivo
// correspondente em migrations/*.up.sql são ignoradas.
func (m *MigrationManager) Status() error {
	files, err := upMigrations.ReadDir("migrations")
	if err != nil {
		return fmt.Errorf(
			"erro ao ler migrations: %w",
			err,
		)
	}

	var versions []string

	for _, file := range files {
		if file.IsDir() {
			continue
		}

		if !strings.HasSuffix(file.Name(), ".up.sql") {
			continue
		}

		version := strings.TrimSuffix(
			file.Name(),
			".up.sql",
		)

		versions = append(versions, version)
	}

	sort.Strings(versions)

	fmt.Println()
	fmt.Println("📋 Status das Migrations")
	fmt.Println("============================================================")
	fmt.Printf(
		"%-40s %-15s\n",
		"MIGRATION",
		"STATUS",
	)
	fmt.Println("------------------------------------------------------------")

	for _, version := range versions {
		applied, err := m.isApplied(version)
		if err != nil {
			return fmt.Errorf(
				"erro ao verificar status de %s: %w",
				version,
				err,
			)
		}

		status := "⏳ Pendente"

		if applied {
			status = "✅ Aplicada"
		}

		fmt.Printf(
			"%-40s %-15s\n",
			version,
			status,
		)
	}

	fmt.Println("============================================================")

	return nil
}

// createMigrationsTable garante que a tabela migrations exista.
//
// IMPORTANTE:
// Se a tabela já existir, o MySQL mantém a estrutura existente.
// No seu banco atual ela possui:
//
//	id
//	migration
//	batch
//
// Esse é exatamente o formato que o MigrationManager utiliza.
func (m *MigrationManager) createMigrationsTable() error {
	query := `
	CREATE TABLE IF NOT EXISTS migrations (
		id bigint unsigned NOT NULL AUTO_INCREMENT,
		migration varchar(255) NOT NULL,
		batch int NOT NULL,
		PRIMARY KEY (id)
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
	`

	_, err := m.db.Exec(query)

	return err
}

// isApplied verifica se uma migration já está registrada.
func (m *MigrationManager) isApplied(version string) (bool, error) {
	var count int

	err := m.db.QueryRow(
		`
		SELECT COUNT(*)
		FROM migrations
		WHERE migration = ?
		`,
		version,
	).Scan(&count)

	if err != nil {
		return false, err
	}

	return count > 0, nil
}

// nextBatch retorna o próximo número de batch.
func (m *MigrationManager) nextBatch() (int, error) {
	var batch int

	err := m.db.QueryRow(
		`
		SELECT COALESCE(MAX(batch), 0) + 1
		FROM migrations
		`,
	).Scan(&batch)

	if err != nil {
		return 0, err
	}

	return batch, nil
}

// Fresh faz um reset completo do schema.
//
// ATENÇÃO:
// As tabelas são apagadas, mas a tabela migrations é preservada
// para não destruir o histórico existente do Laravel.
//
// Os registros das migrations do Go também são removidos,
// pois as tabelas correspondentes serão recriadas.
func (m *MigrationManager) Fresh() error {
	log.Println("🔄 Recriando banco de dados...")

	// Descobrir as migrations pertencentes ao Go.
	files, err := upMigrations.ReadDir("migrations")
	if err != nil {
		return fmt.Errorf(
			"erro ao ler migrations: %w",
			err,
		)
	}

	var goMigrations []string

	for _, file := range files {
		if file.IsDir() {
			continue
		}

		if strings.HasSuffix(file.Name(), ".up.sql") {
			version := strings.TrimSuffix(
				file.Name(),
				".up.sql",
			)

			goMigrations = append(
				goMigrations,
				version,
			)
		}
	}

	// Descobrir tabelas existentes.
	rows, err := m.db.Query("SHOW TABLES")
	if err != nil {
		return fmt.Errorf(
			"erro ao listar tabelas: %w",
			err,
		)
	}

	var tables []string

	for rows.Next() {
		var table string

		if err := rows.Scan(&table); err != nil {
			rows.Close()

			return fmt.Errorf(
				"erro ao ler tabela: %w",
				err,
			)
		}

		tables = append(tables, table)
	}

	if err := rows.Err(); err != nil {
		rows.Close()

		return fmt.Errorf(
			"erro ao percorrer tabelas: %w",
			err,
		)
	}

	rows.Close()

	// Remove todas as tabelas, exceto migrations.
	//
	// Isso preserva o histórico antigo do Laravel.
	for _, table := range tables {
		if table == "migrations" {
			continue
		}

		// Os nomes vêm diretamente do SHOW TABLES.
		// As crases evitam conflitos com palavras reservadas.
		query := fmt.Sprintf(
			"DROP TABLE IF EXISTS `%s`",
			strings.ReplaceAll(table, "`", "``"),
		)

		if _, err := m.db.Exec(query); err != nil {
			return fmt.Errorf(
				"erro ao remover tabela %s: %w",
				table,
				err,
			)
		}

		log.Printf(
			"🗑️ Tabela %s removida",
			table,
		)
	}

	// Remove somente os registros pertencentes às
	// migrations que o Go conhece.
	//
	// As migrations antigas do Laravel permanecem.
	for _, version := range goMigrations {
		_, err := m.db.Exec(
			"DELETE FROM migrations WHERE migration = ?",
			version,
		)

		if err != nil {
			return fmt.Errorf(
				"erro ao limpar registro da migration %s: %w",
				version,
				err,
			)
		}
	}

	log.Println("✅ Banco limpo. Reaplicando migrations...")

	return m.Up()
}
