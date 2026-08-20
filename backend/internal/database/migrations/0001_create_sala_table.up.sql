-- Tabela `sala` — cada linha é uma "comunidade"/sala de reunião em vídeo
-- (LiveKit) do Resenha. `genero_textual_id` foi mantido apenas por
-- compatibilidade com o código antigo de "sala de produção" do WebLEIA
-- (sempre NULL no Resenha) e por isso não tem mais FK — a tabela
-- `genero_textual` não existe neste projeto.

CREATE TABLE IF NOT EXISTS `sala` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `nome` varchar(255) NOT NULL,
  `codigo` varchar(40) NOT NULL,
  `tipo` varchar(20) NOT NULL DEFAULT 'reuniao',
  `descricao` varchar(500) DEFAULT NULL,
  `categoria` varchar(60) DEFAULT NULL,
  `genero_textual_id` bigint unsigned DEFAULT NULL,
  `criado_por` bigint unsigned NOT NULL,
  `ativa` tinyint unsigned NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `sala_codigo_unique` (`codigo`),
  KEY `sala_criado_por_fk` (`criado_por`),
  CONSTRAINT `sala_criado_por_fk` FOREIGN KEY (`criado_por`) REFERENCES `usuario` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
