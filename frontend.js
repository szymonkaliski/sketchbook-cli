const hdom = require("@thi.ng/hdom");
const { Atom } = require("@thi.ng/atom");

const state = new Atom({ inited: false });

const CHECKERBOARD_PNG =
  "url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAIAAAAC64paAAAAK0lEQVQ4y2P8//8/A25w7949PLJMDBSAUc0jQzML/jSkpKQ0GmCjminRDADJNQjBr5nbigAAAABJRU5ErkJggg==')";

const connect = () => {
  const reconnectPoll = 1000;
  const maxRetries = 50;
  const hostname = document.location.hostname;
  const port = document.location.port;
  const host = hostname + ":" + port;

  let isReconnecting = false;
  let reconnectInterval;
  let retries = 0;
  let socket;
  let scheduleReconnect;

  const createWebSocket = () => {
    const wsUrl = "ws://" + host;
    const ws = new window.WebSocket(wsUrl);

    ws.onmessage = function(event) {
      let data;

      try {
        data = JSON.parse(event.data);
      } catch (err) {
        console.warn(
          "[sketchbook-cli] Error parsing server data: " + event.data
        );
        return;
      }

      if (data.files) {
        state.resetIn("sketches", data.files);
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
        console.info("[sketchbook-cli] reconnected");
      }

      console.info("[sketchbook-cli] connected");

      ws.send(JSON.stringify({ mainPage: true }));
    };

    ws.onerror = function() {
      return false;
    };

    return ws;
  };

  const reconnect = () => {
    if (socket) {
      socket.onclose = () => {};
      socket.close();
    }

    socket = createWebSocket();
  };

  scheduleReconnect = () => {
    if (retries >= maxRetries) {
      console.warn(
        "[sketchbook-cli] disconnected, exceeded retry count, please reload the page to retry"
      );

      return;
    }

    if (!isReconnecting) {
      isReconnecting = true;
      console.warn("[sketchbook-cli] disconnected, retrying...");
    }

    retries++;

    clearTimeout(reconnectInterval);

    reconnectInterval = setTimeout(reconnect, reconnectPoll);
  };

  socket = createWebSocket();
};

const domUpdate = (parent, root, state) => {
  let prev = [];

  state.addWatch("dom-update", (_, __, curr) => {
    curr = hdom.normalizeTree(root(curr));

    if (curr != null) {
      hdom.diffElement(parent, prev, curr);

      prev = curr;
    }
  });
};

const root = state => {
  return [
    "div.w-100.sans-serif.bg-white",
    [
      ["h2.f3.fw4.pa3.mv0", document.title],
      [
        "div.cf.pa2",
        (state.sketches || []).map(({ file, shot, hash }) => {
          const screenFile = file.replace(/.js$/, ".png");
          const t = Date.now();

          return [
            "div.fl.w-50.w-33-m.w-25-l.pa2",
            [
              "a.db.link.dim",
              { href: `/sketch/${file.replace(/.js$/, "")}` },
              [
                shot
                  ? [
                      "img.w-100.db.outline.black-10",
                      {
                        src: `/.sketchbook_cli/screens/${screenFile}?t=${hash}@${t}`
                      }
                    ]
                  : [
                      "div.w-100.db.outline.black-10.aspect-ratio.aspect-ratio--1x1",
                      { style: { background: CHECKERBOARD_PNG } }
                    ],
                ["div.gray.truncate.w-100.mt2", file]
              ]
            ]
          ];
        })
      ]
    ]
  ];
};

domUpdate(document.body, root, state);
state.resetIn("inited", true);
connect();
