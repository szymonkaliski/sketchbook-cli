const { ipcRenderer } = require("electron");

window.sketchbook = {
  shot: () => {
    console.log("shot!");
  }
};

ipcRenderer.on("load", (_, data) => {
  console.log({ data });
});
