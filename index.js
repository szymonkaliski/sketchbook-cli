#!/usr/bin/env node

const browserify = require("browserify-middleware");
const chokidar = require("chokidar");
const crypto = require("crypto");
const express = require("express");
const fs = require("fs");
const getPort = require("get-port");
const path = require("path");
const { Server: WebSocketServer } = require("ws");
const { argv } = require("yargs");

const ScreenShotter = require("./screen-shotter");

const RUN_SCREEN_SHOTTER = argv.screenshots !== false;

const WATCH_IGNORED = /\.git|node_modules|bower_components/;

const TACHYONS_CSS = fs.readFileSync(
  path.join(__dirname, "node_modules/tachyons/css/tachyons.min.css")
);

const CLIENT_RELOAD_CODE = fs.readFileSync(
  path.join(__dirname, "live-reload.js")
);

const port = argv.port || "3000";
const folder = argv._[0];

if (!folder) {
  console.log("Provide folder with sketches as an argument");
  process.exit(0);
}

if (!fs.existsSync(folder)) {
  console.log(`${folder} doesn't exist`);
  process.exit(0);
}

const start = ({ port }) => {
  const app = express();
  const server = app.listen(port);

  const wss = new WebSocketServer({
    server,
    perMessageDeflate: false
  });

  const folderPath = path.join(process.cwd(), folder);
  const folderGlob = `${folderPath}/*.js`;

  const liveReload = file => {
    wss.clients.forEach(ws => {
      if (file.endsWith(`${ws.script}.js`)) {
        ws.send(JSON.stringify({ event: "reload" }));
      }
    });
  };

  const updateMain = () => {
    const files = fs
      .readdirSync(folderPath)
      .filter(file => file.endsWith(".js"))
      .map(file => {
        const shotFile = path.join(
          folderPath,
          ".sketchbook_cli",
          "screens",
          file.replace(/.js$/, ".png")
        );

        const shot = fs.existsSync(shotFile);

        const hash = crypto
          .createHash("md5")
          .update(
            fs.readFileSync(path.join(folderPath, file), {
              encoding: "utf8"
            })
          )
          .digest("hex");

        return { file, shot, hash };
      });

    wss.clients.forEach(ws => {
      if (ws.mainPage) {
        ws.send(JSON.stringify({ files }));
      }
    });
  };

  wss.on("connection", ws => {
    ws.on("message", msg => {
      const { script, mainPage } = JSON.parse(msg);

      if (script) {
        ws.script = script;
      }

      if (mainPage) {
        ws.mainPage = mainPage;
        updateMain();
      }
    });
  });

  let screenShotter;

  if (RUN_SCREEN_SHOTTER) {
    screenShotter = new ScreenShotter({ folderPath, port });
    screenShotter.on("shot", updateMain);
  }

  const grabIfOnMain = () => {
    const isOnMain = [...wss.clients.values()].some(ws => ws.mainPage);

    if (!isOnMain) {
      return;
    }

    updateMain();

    if (screenShotter) {
      screenShotter.grab();
    }
  };

  chokidar
    .watch(folderGlob, { ignored: WATCH_IGNORED })
    .on("add", grabIfOnMain)
    .on("unlink", grabIfOnMain)
    .on("change", file => {
      liveReload(file);
      grabIfOnMain();
    });

  app.use(express.static(folderPath));

  app.get("/", (req, res) => {
    if (screenShotter) {
      screenShotter.grab();
    }

    res.send(`
      <html>
        <head>
          <title>sketchbook: ${folder}</title>
          <style type="text/css">
            ${TACHYONS_CSS}
          </style>
        </head>
        <body>
          <script src="/frontend.js"></script>
        </body>
      </html>
    `);
  });

  const handleScript = (req, res, next) => {
    const scriptFile = path.join(process.cwd(), folder, `${req.params.script}`);

    if (!fs.existsSync(scriptFile)) {
      return res.send();
    }

    return browserify(scriptFile, { gzip: true, cache: "dynamic" })(
      req,
      res,
      next
    );
  };

  const handlePage = (req, res) => {
    const scriptFile = path.join(
      process.cwd(),
      folder,
      `${req.params.script}.js`
    );

    if (!fs.existsSync(scriptFile)) {
      return res.redirect("/");
    }

    // prettier-ignore
    res.send(`
      <html>
        <head>
          <title>sketchbook: ${req.params.script}</title>
        </head>
        <body>
          <script>
            ${CLIENT_RELOAD_CODE}
          </script>
          <script src="/sketch/${req.params.script}.js" type="text/javascript"></script>
        </body>
      </html>
    `);
  };

  app.get(
    "/frontend.js",
    browserify(path.join(__dirname, "frontend.js"), {
      gzip: true,
      cache: true,
      precompile: true
    })
  );

  app.get("/sketch/:script", (req, res, next) => {
    if (req.params.script.endsWith(".js")) {
      return handleScript(req, res, next);
    } else {
      return handlePage(req, res);
    }
  });

  console.log(`sketchbook-cli running on: http://localhost:${port}`);
};

getPort({ port }).then(port => start({ port }));

process.on("unhandledRejection", e => {
  if (e) {
    console.log(e);
  }
});
