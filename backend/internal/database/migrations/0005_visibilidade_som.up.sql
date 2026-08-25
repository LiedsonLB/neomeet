-- Adiciona: visibilidade de comunidade (pública/privada) com fluxo de
-- solicitação de entrada para privadas; edição/exclusão de mensagens;
-- descrição (bio) do usuário; e efeitos sonoros por comunidade
-- (soundboard estilo Discord).

ALTER TABLE `comunidade`
  ADD COLUMN `visibilidade` VARCHAR(10) NOT NULL DEFAULT 'publica' AFTER `descricao`;

-- `comunidade_membro.papel` já era VARCHAR(20) livre — passa a aceitar
-- também 'pendente' (solicitação de entrada numa comunidade privada,
-- aguardando o dono aprovar ou recusar).

ALTER TABLE `canal_mensagem`
  ADD COLUMN `editado_em` TIMESTAMP NULL DEFAULT NULL AFTER `conteudo`;

ALTER TABLE `usuario`
  ADD COLUMN `descricao` VARCHAR(300) DEFAULT NULL AFTER `moldura`;

CREATE TABLE IF NOT EXISTS `comunidade_som` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `comunidade_id` bigint unsigned NOT NULL,
  `nome` varchar(60) NOT NULL,
  `emoji` varchar(10) DEFAULT NULL,
  `arquivo_url` varchar(255) NOT NULL,
  `criado_por` bigint unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `comunidade_som_comunidade_fk` (`comunidade_id`),
  CONSTRAINT `comunidade_som_comunidade_fk` FOREIGN KEY (`comunidade_id`) REFERENCES `comunidade` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
