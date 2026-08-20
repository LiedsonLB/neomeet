DELETE FROM `sala` WHERE `codigo` IN (
  '7f02b1b44ae8d964', '07d4bfab10b8a4a7', '4402a9eb7d05d3bc', 'd10f263c326b6c6e',
  'd9fb1013d72ed160', '9375791943d59ac2', '29ac834e1013b913', 'ae3243a2a7d03d84'
);
DELETE FROM `usuario` WHERE `email` IN ('alex@resenha.dev', 'kira@resenha.dev', 'admin@resenha.dev');
DELETE FROM `aplicacao` WHERE `codigo` = 'WEBTESTE';
