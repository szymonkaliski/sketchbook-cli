const fs = require("fs");
const ipc = require("node-ipc");
const path = require("path");
const { app, BrowserWindow, ipcMain } = require("electron");
const { argv } = require("yargs");

ipc.config.id = "child";
ipc.config.retry = 2000;
ipc.config.silent = true;
ipc.config.sync = true;

const IS_HIDDEN = true;

const { port, folder } = argv;
const captureDir = path.join(folder, ".sketchbook_cli", "screens");

const createWindow = ({ ipc }) => {
  let win = new BrowserWindow(
    IS_HIDDEN
      ? {
          show: false,
          webPreferences: {
            webgl: true,
            offscreen: true
          }
        }
      : {}
  );

  win.setContentSize(600, 600);
  win.setResizable(false);

  win.webContents.loadURL(`file://${__dirname}/screen-shotter.html`);

  win.on("closed", () => (win = null));

  let currentFile;

  win.webContents.on("did-finish-load", () => {
    win.webContents.send("port", { port });

    ipc.of.server.emit("ready");

    ipc.of.server.on("shot", data => {
      win.webContents.send("load", data);
      currentFile = data.file;
    });
  });

  ipcMain.on("shot-ready", () => {
    win.webContents.capturePage(image => {
      const imgPath = path.join(
        captureDir,
        currentFile.replace(/.js$/, ".png")
      );

      fs.writeFile(imgPath, image.toPNG(), () => {
        setTimeout(() => {
          win.webContents.send("cleanup");
          ipc.of.server.emit("shot-done");
        }, 1);
      });
    });
  });
};

const start = ({ ipc }) => {
  app.dock.hide();

  app.on("ready", () => createWindow({ ipc }));
  app.on("win-all-closed", () => app.quit());
};

ipc.connectTo("server", () => {
  ipc.of.server.on("connect", () => start({ ipc }));
});
