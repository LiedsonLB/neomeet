-- Adiciona campo de emoji/ícone nos canais para fácil identificação visual.
ALTER TABLE `canal`
  ADD COLUMN `icone` varchar(10) DEFAULT NULL AFTER `nome`;
