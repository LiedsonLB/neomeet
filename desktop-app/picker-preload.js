const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pickerAPI", {
  pronto: () => ipcRenderer.send("picker:pronto"),
  onFontes: (cb) => ipcRenderer.on("picker:fontes", (_e, fontes) => cb(fontes)),
  escolher: (id, audio) => ipcRenderer.send("picker:escolha", { id, audio }),
  cancelar: () => ipcRenderer.send("picker:escolha", null),
});