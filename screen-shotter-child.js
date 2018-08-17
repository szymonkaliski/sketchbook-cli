const path = require("path");
const puppeteer = require("puppeteer");
const { argv } = require("yargs");

const run = async () => {
  const { port, script, folder } = argv;
  const size = argv.size || 400;

  const url = `http://localhost:${port}/sketch/${script.replace(/.js$/, "")} `;
  const output = path.join(
    folder,
    ".sketchbook_cli",
    "screens",
    script.replace(/.js$/, ".png")
  );

  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.setViewport({ width: size, height: size });
  await page.goto(url, { waituntil: "domcontentloaded" });
  await page.screenshot({ path: output });

  await browser.close();
};

run();
