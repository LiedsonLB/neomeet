# NeoMeet Desktop

App desktop do NeoMeet: uma janela nativa (Electron) que abre `https://resenha.mooo.com`
— igual ao que o Discord/Slack fazem. Não roda o backend localmente; ele continua
usando seu servidor já em produção (Go API, MySQL, RabbitMQ, LiveKit).

## Rodar em modo dev (testar antes de gerar o instalador)

```bash
cd desktop-app
npm install
npm start
```

Isso abre uma janela desktop carregando seu site normalmente.

## Gerar o instalador (.exe)

**Importante:** gerar o `.exe` funciona melhor rodando isto no Windows, ou no Linux
com o `wine` instalado (o electron-builder usa o wine pra empacotar o NSIS installer
quando você não está no Windows).

```bash
cd desktop-app
npm install
npm run dist:win
```

O instalador vai sair em `desktop-app/release/NeoMeet Setup <versão>.exe`.

Para gerar também a versão Linux (`.AppImage`) ou Mac (`.dmg`), use `npm run dist:linux`
ou `npm run dist:mac`.

## Antes de distribuir

1. **Ícone**: coloque seus ícones em `build/icon.ico` (Windows, 256x256),
   `build/icon.png` (Linux, 512x512) e `build/icon.icns` (Mac). Sem eles o
   electron-builder usa um ícone padrão genérico.
2. **HTTPS**: o app só vai abrir corretamente com o certificado válido em
   resenha.mooo.com (o certbot que você estava configurando). Sem HTTPS o
   Electron pode bloquear a página por segurança.
3. **Domínio fixo**: se o domínio mudar no futuro, edite `APP_URL` em `main.js`
   (ou rode com a variável de ambiente `NEOMEET_URL=https://novo-dominio.com npm start`).
4. **Assinatura de código (opcional)**: sem certificado de assinatura, o Windows
   vai mostrar um aviso do SmartScreen ("Windows protegeu seu PC") na primeira
   execução. Isso é normal para apps não assinados e não impede o uso — o usuário
   clica em "Mais informações" → "Executar assim mesmo".

## Por que não rodar o backend inteiro dentro do .exe?

Seu backend depende de Go API + MySQL + RabbitMQ + LiveKit rodando via Docker.
Embutir tudo isso num instalador pra rodar 100% offline na máquina do usuário
daria um pacote gigante e frágil (cada usuário precisaria do Docker instalado).
O padrão do mercado (Discord, Slack, Teams) é exatamente este: app leve local +
backend na nuvem. Se um dia você quiser uma versão realmente offline/local-first,
isso é um projeto bem maior — me avisa que a gente pensa nisso separado.
