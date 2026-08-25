DROP TABLE IF EXISTS `comunidade_som`;

ALTER TABLE `usuario`
  DROP COLUMN `descricao`;

ALTER TABLE `canal_mensagem`
  DROP COLUMN `editado_em`;

ALTER TABLE `comunidade`
  DROP COLUMN `visibilidade`;
