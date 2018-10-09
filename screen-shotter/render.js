const { ipcRenderer } = require("electron");

let port;
let webview;

ipcRenderer.on("port", (_, data) => (port = data.port));

ipcRenderer.on("load", (_, data) => {
  if (webview) {
    document.body.removeChild(webview);
    webview = undefined;
  }

  webview = document.createElement("webview");

  webview.nodeintegration = true;
  webview.preload = "./preload.js";
  webview.src = `http://localhost:${port}/sketch/${data.file.replace(/.js$/, "")}`;

  document.body.appendChild(webview);

  const onLoaded = () => {
    if (data.autoShot) {
      setTimeout(() => {
        ipcRenderer.send("shot-ready");
      }, 10);
    }

    webview.removeEventListener("did-stop-loading", onLoaded);
  };

  webview.addEventListener("did-stop-loading", onLoaded);
});

ipcRenderer.on("cleanup", () => {
  if (webview) {
    document.body.removeChild(webview);
    webview = undefined;
  }
});
