-- Adiciona presença básica (heartbeat) ao usuário: o frontend chama
-- POST /usuarios/heartbeat a cada ~30s enquanto o app está aberto, e isso
-- atualiza `ultimo_acesso`. A aba "Membros" de uma comunidade
-- (ComunidadeHandler.Membros) usa essa coluna pra mostrar quem está online
-- agora (ultimo_acesso dentro dos últimos 2 minutos) — ver
-- ComunidadeRepository.ListMembros.

ALTER TABLE `usuario`
  ADD COLUMN `ultimo_acesso` TIMESTAMP NULL DEFAULT NULL AFTER `descricao`;
