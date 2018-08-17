// stolen from budo

function connect() {
  var reconnectPoll = 1000;
  var maxRetries = 50;
  var retries = 0;
  var reconnectInterval;
  var isReconnecting = false;
  var hostname = document.location.hostname;
  var pathname = document.location.pathname.replace("/", "");
  var port = document.location.port;
  var host = hostname + ":" + port;

  var socket = createWebSocket();

  function scheduleReconnect() {
    if (retries >= maxRetries) {
      console.warn(
        "[sketchbook-cli] LiveReload disconnected, exceeded retry count, please reload the page to retry"
      );

      return;
    }

    if (!isReconnecting) {
      isReconnecting = true;
      console.warn("[sketchbook-cli] LiveReload disconnected, retrying...");
    }

    retries++;

    clearTimeout(reconnectInterval);

    reconnectInterval = setTimeout(reconnect, reconnectPoll);
  }

  function reconnect() {
    if (socket) {
      // force close the existing socket
      socket.onclose = function() {};
      socket.close();
    }
    socket = createWebSocket();
  }

  function createWebSocket() {
    var wsUrl = "ws://" + host;
    var ws = new window.WebSocket(wsUrl);

    ws.onmessage = function(event) {
      var data;

      try {
        data = JSON.parse(event.data);
      } catch (err) {
        console.warn(
          "[sketchbook-cli] Error parsing LiveReload server data: " + event.data
        );
        return;
      }

      if (data.event === "reload") {
        reloadPage();
      }
    };

    ws.onclose = function(ev) {
      if (ev.code === 1000 || ev.code === 1001) {
        // browser is navigating away
        return;
      }
      scheduleReconnect();
    };

    ws.onopen = function() {
      if (isReconnecting) {
        isReconnecting = false;
        retries = 0;
        console.info("[sketchbook-cli] LiveReload reconnected");
      }

      console.info("[sketchbook-cli] LiveReload connected");

      ws.send(JSON.stringify({ script: pathname.replace("sketch/", "") }));
    };

    ws.onerror = function() {
      return false;
    };

    return ws;
  }
}

function reloadPage() {
  window.location.reload(true);
}

connect();
