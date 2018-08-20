const async = require("async");
const crypto = require("crypto");
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

    ipc.serve(() => {
      this.child = spawn(path.join(__dirname, "node_modules/.bin/electron"), [
        "screen-shotter-child.js",
        "--port",
        port,
        "--folder",
        folderPath
      ]);

      this.child.stdout.on("data", data => {
        console.log(`[screen-shotter-child stdout] ${data}`);
      });

      this.child.stderr.on("data", data => {
        console.log(`[screen-shotter-child stderr] ${data}`);
      });

      this.child.on("close", code => {
        console.log(`[screen-shotter-child exit] ${code}`);
      });

      ipc.server.on("ready", (_, socket) => {
        console.log("child ready!");

        this.grabQueue = async.queue((task, callback) => {
          const { file, hash } = task;

          this.db.get(file, (err, value) => {
            if (!err && value === hash) {
              console.log(`${file} [${hash}] was already screenshotted`);
              return callback();
            }

            console.log(`${file} [${hash}] shotting...`);

            ipc.server.emit(socket, "shot", task);

            ipc.server.on("shot-done", data => {
              ipc.server.off("shot-done", "*");

              this.db.put(file, hash, () => {
                console.log(`${file} [${hash}] done!`);
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
