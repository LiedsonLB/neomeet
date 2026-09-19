-- "Descobrir comunidades" com categorias (🎮 Jogos, 💻 Tecnologia, 🎵
-- Música...) — ver models.CategoriasComunidade e Dashboard.tsx.
ALTER TABLE `comunidade`
  ADD COLUMN `categoria` VARCHAR(30) DEFAULT NULL AFTER `descricao`;
