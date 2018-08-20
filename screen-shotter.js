const async = require("async");
const crypto = require("crypto");
const fs = require("fs");
const level = require("level");
const path = require("path");
const { spawn } = require("child_process");

const DB_FILE_NAME = ".sketchbook_cli";
const CONCURRENT_SHOTS = 1;

module.exports = class {
  constructor({ folderPath }) {
    if (!fs.existsSync(path.join(folderPath, DB_FILE_NAME))) {
      fs.mkdirSync(path.join(folderPath, DB_FILE_NAME));
    }

    if (!fs.existsSync(path.join(folderPath, DB_FILE_NAME, "screens"))) {
      fs.mkdirSync(path.join(folderPath, DB_FILE_NAME, "screens"));
    }

    this.db = level(path.join(folderPath, DB_FILE_NAME, "db"));

    // TODO
    // grab screenshot - talk with electron through ipc
    // once done, callback so next screen can be grabbed
    // notify listeners so results can be pushed in real time
    this.grabQueue = async.queue((task, callback) => {});

    this.notifyCallbacks = [];

    this.child = spawn(path.join(__dirname, "node_modules/.bin/electron"), [
      "screen-shotter-child.js",
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

    this.grab();
  }

  on(key, callback) {
    if (key === "shots") {
      this.notifyCallbacks.push(callback);
    }
  }

  grab() {
    // if (this.isGrabbing) {
    //   return;
    // }
    // this.isGrabbing = true;
    // const files = fs
    //   .readdirSync(this.folderPath)
    //   .filter(file => file.endsWith(".js"))
    //   .map(file => ({
    //     file,
    //     hash: crypto
    //       .createHash("md5")
    //       .update(
    //         fs.readFileSync(path.join(this.folderPath, file), {
    //           encoding: "utf8"
    //         })
    //       )
    //       .digest("hex")
    //   }));
    // async.mapLimit(
    //   files,
    //   CONCURRENT_SHOTS,
    //   ({ file, hash }, callback) => {
    //     this.db.get(file, (err, value) => {
    //       if (!err && value === hash) {
    //         console.log(`${file} [${hash}] was already screenshotted`);
    //         return callback();
    //       }
    //       console.log(`${file} [${hash}] shotting...`);
    //       const child = fork(
    //         path.join(__dirname, "./screen-shotter-child.js"),
    //         ["--script", file, "--port", this.port, "--folder", this.folderPath]
    //       );
    //       child.on("error", err => {
    //         console.log(`${file} [${hash}] error ${err}`);
    //         callback(err);
    //       });
    //       child.on("exit", () => {
    //         this.db.put(file, hash, () => {
    //           console.log(`${file} [${hash}] done!`);
    //           callback();
    //         });
    //       });
    //     });
    //   },
    //   () => {
    //     this.notifyCallbacks.forEach(callback => callback());
    //     this.isGrabbing = false;
    //   }
    // );
  }
};
