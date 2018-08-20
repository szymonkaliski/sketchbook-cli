const { ipcRenderer } = require("electron");

window.sketchbook = {
  shot: () => {
    ipcRenderer.send("shot-ready");
  }
};
