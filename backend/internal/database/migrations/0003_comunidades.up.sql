-- Comunidades estilo Discord: uma `comunidade` tem vários `canal` (texto ou
-- voz); canais de voz são "linkados" 1:1 a uma linha da tabela `sala` já
-- existente, reaproveitando 100% da infraestrutura de LiveKit (token,
-- presença via internal/realtime.Hub) que a Sala já tinha — não foi preciso
-- duplicar nada disso.

ALTER TABLE `usuario`
  ADD COLUMN `banner` varchar(255) DEFAULT NULL AFTER `foto`,
  ADD COLUMN `moldura` varchar(60) DEFAULT NULL AFTER `banner`;

CREATE TABLE IF NOT EXISTS `comunidade` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `nome` varchar(255) NOT NULL,
  `descricao` varchar(500) DEFAULT NULL,
  `icone_url` varchar(255) DEFAULT NULL,
  `banner_url` varchar(255) DEFAULT NULL,
  `criado_por` bigint unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `comunidade_criado_por_fk` (`criado_por`),
  CONSTRAINT `comunidade_criado_por_fk` FOREIGN KEY (`criado_por`) REFERENCES `usuario` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `comunidade_membro` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `comunidade_id` bigint unsigned NOT NULL,
  `usuario_id` bigint unsigned NOT NULL,
  `papel` varchar(20) NOT NULL DEFAULT 'membro',
  `created_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `comunidade_membro_unique` (`comunidade_id`,`usuario_id`),
  KEY `comunidade_membro_usuario_fk` (`usuario_id`),
  CONSTRAINT `comunidade_membro_comunidade_fk` FOREIGN KEY (`comunidade_id`) REFERENCES `comunidade` (`id`) ON DELETE CASCADE,
  CONSTRAINT `comunidade_membro_usuario_fk` FOREIGN KEY (`usuario_id`) REFERENCES `usuario` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `canal` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `comunidade_id` bigint unsigned NOT NULL,
  `nome` varchar(100) NOT NULL,
  `tipo` varchar(10) NOT NULL DEFAULT 'texto',
  `posicao` int NOT NULL DEFAULT '0',
  `sala_id` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `canal_comunidade_fk` (`comunidade_id`),
  KEY `canal_sala_fk` (`sala_id`),
  CONSTRAINT `canal_comunidade_fk` FOREIGN KEY (`comunidade_id`) REFERENCES `comunidade` (`id`) ON DELETE CASCADE,
  CONSTRAINT `canal_sala_fk` FOREIGN KEY (`sala_id`) REFERENCES `sala` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `canal_mensagem` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `canal_id` bigint unsigned NOT NULL,
  `usuario_id` bigint unsigned NOT NULL,
  `conteudo` text NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `canal_mensagem_canal_fk` (`canal_id`),
  KEY `canal_mensagem_usuario_fk` (`usuario_id`),
  CONSTRAINT `canal_mensagem_canal_fk` FOREIGN KEY (`canal_id`) REFERENCES `canal` (`id`) ON DELETE CASCADE,
  CONSTRAINT `canal_mensagem_usuario_fk` FOREIGN KEY (`usuario_id`) REFERENCES `usuario` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
