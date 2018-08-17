const { app, BrowserWindow, ipcMain } = require("electron");
const { argv } = require("yargs");

const folder = argv.folder;
//   const output = path.join(
//     folder,
//     ".sketchbook_cli",
//     "screens",
//     script.replace(/.js$/, ".png")
//   );

const createWindow = () => {
  let win = new BrowserWindow({
    show: false,
    webPreferences: {
      webgl: true,
      offscreen: true
    }
  });

  win.setContentSize(600, 600);
  win.setResizable(false);

  win.webContents.loadURL(`file://${__dirname}/screen-shotter.html`);

  win.on("closed", () => (win = null));

  win.webContents.on("did-finish-load", () => {
    win.webContents.send("load", "test");
  });

  ipcMain.on("loaded", (a, b, c) => {
    console.log([a, b, c]);
  });
};

const start = () => {
  app.dock.hide();

  app.on("ready", createWindow);

  app.on("win-all-closed", () => {
    app.quit();
  });
};

start();
