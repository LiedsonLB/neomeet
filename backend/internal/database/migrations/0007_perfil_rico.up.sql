-- Perfil muito mais personalizável (ver Perfil.tsx / EditarPerfilModal.tsx):
-- links de redes sociais/site, jogos favoritos, um status curto tipo bio
-- rápida ("fazendo código e resenha") e a "atividade" atual, que alimenta a
-- presença rica ("🟢 Na resenha · Jogando Minecraft") em vez do simples
-- online/offline que já existia (ultimo_acesso).

ALTER TABLE `usuario`
  ADD COLUMN `links` TEXT DEFAULT NULL AFTER `descricao`,
  ADD COLUMN `jogos` TEXT DEFAULT NULL AFTER `links`,
  ADD COLUMN `status_customizado` VARCHAR(80) DEFAULT NULL AFTER `jogos`,
  ADD COLUMN `atividade` VARCHAR(120) DEFAULT NULL AFTER `status_customizado`,
  ADD COLUMN `atividade_tipo` VARCHAR(20) DEFAULT NULL AFTER `atividade`;

-- links e jogos são guardados como JSON (texto) — mais simples que criar
-- duas tabelas novas só pra listas curtas de poucos itens por usuário, e o
-- Go decodifica/codifica isso no handler (ver models/usuario.go).
