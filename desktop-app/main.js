const {
  app,
  BrowserWindow,
  Menu,
  shell,
  session,
  desktopCapturer,
  ipcMain
} = require("electron");

const path = require("path");

const APP_URL = "https://resenha.mooo.com";

let pickerWindow = null;

function abrirPickerDeTela(fontes) {
  return new Promise((resolve) => {
    pickerWindow = new BrowserWindow({
      width: 720,
      height: 560,
      resizable: false,
      title: "Compartilhar tela",
      backgroundColor: "#1e1f22",

      webPreferences: {
        preload: path.join(__dirname, "picker-preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    pickerWindow.setMenuBarVisibility(false);

    pickerWindow.loadFile(
      path.join(__dirname, "picker.html")
    );

    ipcMain.once("picker:pronto", (event) => {
      event.sender.send(
        "picker:fontes",
        fontes.map((f) => ({
          id: f.id,
          name: f.name,
          thumbnail: f.thumbnail.toDataURL(),
        }))
      );
    });

    ipcMain.once("picker:escolha", (_e, resultado) => {
      resolve(resultado);
      fechar();
    });

    pickerWindow.once("closed", () => {
      resolve(null);
      fechar();
    });

    function fechar() {
      if (pickerWindow) {
        pickerWindow.destroy();
        pickerWindow = null;
      }
    }
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,

    icon: path.join(
      __dirname,
      "build",
      "resenha_icon.png"
    ),

    autoHideMenuBar: true,
    backgroundColor: "#0f0f13",

    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.loadURL(APP_URL);

  // Links externos abrem no navegador padrão
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(APP_URL)) {
      shell.openExternal(url);
      return {
        action: "deny"
      };
    }

    return {
      action: "allow"
    };
  });

  Menu.setApplicationMenu(null);
}

app.whenReady().then(() => {

  session.defaultSession.setDisplayMediaRequestHandler(
    async (request, callback) => {

      const fontes = await desktopCapturer.getSources({
        types: ["window", "screen"],
        thumbnailSize: {
          width: 300,
          height: 200
        },
      });

      const escolha = await abrirPickerDeTela(fontes);

      if (!escolha) {
        callback({});
        return;
      }

      const fonte = fontes.find(
        (f) => f.id === escolha.id
      );

      if (!fonte) {
        callback({});
        return;
      }

      callback({
        video: fonte,
        audio: escolha.audio
          ? "loopback"
          : undefined,
      });
    }
  );

  // CRIA APENAS UMA JANELA
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});