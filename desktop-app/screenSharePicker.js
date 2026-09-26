// desktop-app/main/screenSharePicker.js
//
// Substitui a captura antiga (desktopCapturer + getUserMedia com
// `chromeMediaSource: 'desktop'` manual, que não trazia áudio de forma
// confiável) por `session.setDisplayMediaRequestHandler`. Com isso o
// renderer chama `getDisplayMedia()` do jeito NORMAL — exatamente como no
// navegador, ver hooks/useVoiceChannel.ts, toggleScreenShare — e é o
// Electron quem intercepta o pedido: abre nosso picker.html (mesma UI de
// sempre, com as miniaturas) e resolve a captura com `audio: 'loopback'`,
// que pega o áudio do sistema inteiro não importa se a pessoa escolheu
// uma tela ou uma janela.
//
// Chame registrarScreenSharePicker(mainWindow) UMA vez, no app.whenReady()
// do processo principal.
const { BrowserWindow, desktopCapturer, ipcMain, session } = require('electron');
const path = require('path');

let janelaPicker = null;
let resolverPendente = null;
let fontesCache = [];

function abrirPicker(parentWindow) {
  janelaPicker = new BrowserWindow({
    width: 720,
    height: 480,
    parent: parentWindow,
    modal: true,
    resizable: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'picker-preload.js'),
      contextIsolation: true,
    },
  });
  janelaPicker.loadFile(path.join(__dirname, '..', 'picker.html'));

  // O renderer avisa "pronto" (window.pickerAPI.pronto(), no fim do
  // script do picker.html) só depois que o listener onFontes já está
  // registrado — sem esse handshake, fontes enviadas cedo demais se
  // perdem (o listener ainda não existia pra recebê-las).
  ipcMain.once('picker:pronto', async () => {
    fontesCache = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 300, height: 200 },
    });
    janelaPicker?.webContents.send('picker:fontes', fontesCache.map(f => ({
      id: f.id,
      name: f.name,
      thumbnail: f.thumbnail.toDataURL(),
    })));
  });

  janelaPicker.on('closed', () => {
    janelaPicker = null;
    // Fechou sem escolher (botão "cancelar" ou X da janela) — cancela a
    // captura em vez de deixar o getDisplayMedia() do renderer pendurado.
    if (resolverPendente) {
      resolverPendente({});
      resolverPendente = null;
    }
  });
}

function registrarScreenSharePicker(mainWindow) {
  ipcMain.on('picker:escolher', (_e, sourceId, comAudio) => {
    const fonte = fontesCache.find(f => f.id === sourceId);
    if (resolverPendente) {
      resolverPendente({
        video: fonte,
        // 'loopback' captura o áudio do sistema inteiro — funciona pra
        // tela inteira, janela ou guia, sem a limitação do navegador
        // (que só suporta áudio em guia e, no Windows, tela inteira).
        // Suporte por SO: Windows (sempre) e Linux/PipeWire — no macOS
        // precisa do Electron 39+ com a chave NSAudioCaptureUsageDescription
        // no Info.plist (CoreAudio Tap); versões/SOs mais antigos não têm
        // como capturar áudio de sistema no Electron.
        audio: comAudio ? 'loopback' : undefined,
      });
      resolverPendente = null;
    }
    janelaPicker?.close();
  });

  ipcMain.on('picker:cancelar', () => {
    if (resolverPendente) {
      resolverPendente({});
      resolverPendente = null;
    }
    janelaPicker?.close();
  });

  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    resolverPendente = callback;
    abrirPicker(mainWindow);
  });
}

module.exports = { registrarScreenSharePicker };