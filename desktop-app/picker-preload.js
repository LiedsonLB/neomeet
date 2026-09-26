// picker-preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pickerAPI', {
  onFontes: (callback) => {
    ipcRenderer.on('picker:fontes', (_e, fontes) => callback(fontes));
  },
  // main.js espera um objeto único { id, audio } no canal "picker:escolha"
  // (não dois argumentos separados) — ver ipcMain.once("picker:escolha", ...).
  escolher: (sourceId, comAudio) => ipcRenderer.send('picker:escolha', { id: sourceId, audio: comAudio }),
  // main.js não tem um canal de "cancelar": ele resolve pra `null` sozinho
  // no listener `pickerWindow.once("closed", ...)`. Então cancelar aqui é
  // só fechar a janela.
  cancelar: () => window.close(),
  pronto: () => ipcRenderer.send('picker:pronto'),
});