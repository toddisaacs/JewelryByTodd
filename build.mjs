import { access, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { minify } from "terser";
import { loadSettings, loadSite, renderPage, workList } from "./catalog-page.mjs";

async function removeFinderFiles(dir) {
  const { readdir } = await import("node:fs/promises");
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const path = dir + "/" + entry.name;
    if (entry.name === ".DS_Store") await rm(path, { force: true });
    else if (entry.isDirectory()) await removeFinderFiles(path);
  }
}

async function absent(path) {
  try {
    await access(path);
    return false;
  } catch {
    return true;
  }
}

const site = await loadSite();
const settings = await loadSettings();
const template = await readFile("index.html", "utf8");
const html = renderPage(template, site, settings);

if (html.includes("data-hours") || html.includes("data-rate") || html.includes("setting.json")) {
  throw new Error("The page includes the labor file.");
}
for (const setting of settings) {
  const grams = setting.grams.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const required = [
    setting.title,
    setting.lede,
    `${grams} g in sterling silver.`,
    `data-grams="${grams}"`,
    setting.stone,
    setting.priceNote,
  ];
  for (const text of required) {
    if (!html.includes(text)) throw new Error(`The page is missing ${text}`);
  }
}

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await writeFile("dist/index.html", html);

const source = await readFile("catalog.js", "utf8");
const filled = source.replace("var work = {};", () => `var work = ${JSON.stringify(workList(settings))};`);
if (filled === source) throw new Error("catalog.js is missing the work list.");
const result = await minify(filled, { compress: true, mangle: true });
if (!result.code) throw new Error("The catalog script did not minify.");
await writeFile("dist/catalog.min.js", result.code);

await cp("styles.css", "dist/styles.css");
for (const setting of settings) {
  const dest = `dist/images/${setting.id}`;
  await mkdir(dest, { recursive: true });
  for (const item of setting.media) {
    await cp(`${setting.dir}/${item.file}`, `${dest}/${item.file}`);
  }
}
await removeFinderFiles("dist");

for (const path of ["dist/catalog.js", "dist/site.json", "dist/settings", "dist/images/traditional-bezel/setting.json", "dist/images/traditional-bezel/ADD-PHOTOS.txt"]) {
  if (!(await absent(path))) throw new Error(`${path} was published.`);
}
