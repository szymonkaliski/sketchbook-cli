const async = require("async");
const crypto = require("crypto");
const debug = require("debug")("screen-shotter");
const fs = require("fs");
const ipc = require("node-ipc");
const level = require("level");
const path = require("path");
const { spawn } = require("child_process");

const DB_FILE_NAME = ".sketchbook_cli";

ipc.config.id = "server";
ipc.config.retry = 2000;
ipc.config.silent = true;
ipc.config.sync = true;

module.exports = class {
  constructor({ folderPath, port }) {
    if (!fs.existsSync(path.join(folderPath, DB_FILE_NAME))) {
      fs.mkdirSync(path.join(folderPath, DB_FILE_NAME));
    }

    if (!fs.existsSync(path.join(folderPath, DB_FILE_NAME, "screens"))) {
      fs.mkdirSync(path.join(folderPath, DB_FILE_NAME, "screens"));
    }

    this.db = level(path.join(folderPath, DB_FILE_NAME, "db"));
    this.folderPath = folderPath;
    this.notifyCallbacks = [];
    this.port = port;

    this.init();
  }

  init() {
    debug("starting");

    ipc.serve(() => {
      this.child = spawn(
        path.join(__dirname, "../node_modules/.bin/electron"),
        [
          path.join(__dirname, "child.js"),
          "--port",
          this.port,
          "--folder",
          this.folderPath
        ]
      );

      this.child.stdout.on("data", data => {
        debug(`[child stdout] ${data}`);
      });

      this.child.stderr.on("data", data => {
        debug(`[child stderr] ${data}`);
      });

      this.child.on("close", code => {
        debug(`[child exit] ${code}`);

        ipc.server.stop();
        setTimeout(() => this.init(), 100);
      });

      ipc.server.on("ready", (_, socket) => {
        this.grabQueue = async.queue((task, callback) => {
          const { file, hash } = task;

          this.db.get(file, (err, value) => {
            if (!err && value === hash) {
              debug(`ignoring: ${file} (${hash})`);
              return callback();
            }

            debug(`shotting: ${file} (${hash})`);

            ipc.server.emit(socket, "shot", task);

            ipc.server.on("shot-done", () => {
              ipc.server.off("shot-done", "*");

              this.db.put(file, hash, () => {
                debug(`finished: ${file} (${hash})`);
                this.notifyCallbacks.forEach(callback => callback());
                callback();
              });
            });
          });
        });

        this.grab();
      });
    });

    ipc.server.start();
  }

  on(key, callback) {
    if (key === "shot") {
      this.notifyCallbacks.push(callback);
    }
  }

  grab() {
    if (!this.grabQueue) {
      return;
    }

    const tasks = fs
      .readdirSync(this.folderPath)
      .filter(file => file.endsWith(".js"))
      .map(file => {
        const content = fs.readFileSync(path.join(this.folderPath, file), {
          encoding: "utf8"
        });

        // this is super stupid way to do this
        const autoShot = content.indexOf("window.sketchbook.shot()") === -1;

        return {
          file,
          autoShot,
          hash: crypto
            .createHash("md5")
            .update(content)
            .digest("hex")
        };
      });

    tasks.forEach(task => {
      this.grabQueue.push(task);
    });
  }
};
