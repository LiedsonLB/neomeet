DROP TABLE IF EXISTS `canal_mensagem`;
DROP TABLE IF EXISTS `canal`;
DROP TABLE IF EXISTS `comunidade_membro`;
DROP TABLE IF EXISTS `comunidade`;

ALTER TABLE `usuario`
  DROP COLUMN `moldura`,
  DROP COLUMN `banner`;
