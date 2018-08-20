const { ipcRenderer } = require("electron");

// TODO: take shot when this fn is called,
// or if it's not implemented (regex on code text), call it after require
window.sketchbook = {
  shot: () => {
    console.log("shot!");
  }
};

ipcRenderer.on("load", (_, data) => {
  console.log({ data });
});
