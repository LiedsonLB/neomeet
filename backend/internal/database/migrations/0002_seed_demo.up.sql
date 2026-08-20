-- Dados de demonstração, para o projeto já subir "funcionando" sem precisar
-- cadastrar nada manualmente. Roda só uma vez (registrada na tabela
-- `migrations`, como as demais).
--
-- Login de teste (qualquer um dos três, senha igual para todos):
--   alex@resenha.dev   / resenha123   (usuário comum)
--   kira@resenha.dev   / resenha123   (usuário comum)
--   admin@resenha.dev  / resenha123   (perfil administrador)
--
-- AppKey usada pelo frontend (.env VITE_APP_KEY): WEBTESTE

INSERT INTO `aplicacao` (`nome`, `codigo`, `tipo`, `versao`, `created_at`, `updated_at`)
VALUES ('Resenha Web', 'WEBTESTE', 1, 1, NOW(), NOW());

-- Hash bcrypt de "resenha123" (compatível com golang.org/x/crypto/bcrypt).
INSERT INTO `usuario` (`nome`, `email`, `senha`, `perfil`, `email_verified_at`, `created_at`, `updated_at`)
VALUES
  ('Alex Rios',      'alex@resenha.dev',  '$2b$10$c2Pd1OPbJS8OjvZivDbJlucGyIgbTDq8ul3uG.pKT6zgGPWvN2/HW', 2, NOW(), NOW(), NOW()),
  ('Kira Nova',       'kira@resenha.dev',  '$2b$10$c2Pd1OPbJS8OjvZivDbJlucGyIgbTDq8ul3uG.pKT6zgGPWvN2/HW', 2, NOW(), NOW(), NOW()),
  ('Admin Resenha',   'admin@resenha.dev', '$2b$10$c2Pd1OPbJS8OjvZivDbJlucGyIgbTDq8ul3uG.pKT6zgGPWvN2/HW', 1, NOW(), NOW(), NOW());

-- Comunidades/salas de exemplo, espelhando os cards do mockup.
INSERT INTO `sala` (`nome`, `codigo`, `tipo`, `descricao`, `categoria`, `criado_por`, `ativa`, `created_at`, `updated_at`)
SELECT * FROM (
  SELECT 'Devs Brasil'      AS nome, '7f02b1b44ae8d964' AS codigo, 'reuniao' AS tipo, 'Discussões sobre front-end, back-end e arquitetura de sistemas.' AS descricao, 'Tech'      AS categoria, (SELECT id FROM usuario WHERE email = 'alex@resenha.dev')  AS criado_por, 1 AS ativa, NOW() AS created_at, NOW() AS updated_at
  UNION ALL SELECT 'FPS Lounge',        '07d4bfab10b8a4a7', 'reuniao', 'Encontre seu squad para Valorant, CS2 e Apex Legends.',            'Jogos',     (SELECT id FROM usuario WHERE email = 'alex@resenha.dev'),  1, NOW(), NOW()
  UNION ALL SELECT 'E-Sports Central',  '4402a9eb7d05d3bc', 'reuniao', 'O maior hub de competições e notícias do cenário brasileiro.',    'Jogos',     (SELECT id FROM usuario WHERE email = 'admin@resenha.dev'), 1, NOW(), NOW()
  UNION ALL SELECT 'UI/UX Brasil',      'd10f263c326b6c6e', 'reuniao', 'Designers construindo o futuro digital.',                          'Tech',      (SELECT id FROM usuario WHERE email = 'kira@resenha.dev'),  1, NOW(), NOW()
  UNION ALL SELECT 'Bootcamp Hub',      'd9fb1013d72ed160', 'reuniao', 'Grupos de estudo para iniciantes em TI.',                          'Educação',  (SELECT id FROM usuario WHERE email = 'admin@resenha.dev'), 1, NOW(), NOW()
  UNION ALL SELECT 'Tech Explorers',    '9375791943d59ac2', 'reuniao', 'Comunidade de exploração de novas tecnologias e frameworks.',      'Tech',      (SELECT id FROM usuario WHERE email = 'kira@resenha.dev'),  1, NOW(), NOW()
  UNION ALL SELECT 'Gaming Hub',        '29ac834e1013b913', 'reuniao', 'Ponto de encontro geral para jogatinas e resenha.',                'Jogos',     (SELECT id FROM usuario WHERE email = 'admin@resenha.dev'), 1, NOW(), NOW()
  UNION ALL SELECT 'Art Studio',        'ae3243a2a7d03d84', 'reuniao', 'Compartilhe suas artes digitais e receba feedback ao vivo.',       'Educação',  (SELECT id FROM usuario WHERE email = 'kira@resenha.dev'),  1, NOW(), NOW()
) AS seed;
