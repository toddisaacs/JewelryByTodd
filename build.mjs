import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { minify } from "terser";

async function removeFinderFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const path = dir + "/" + entry.name;
    if (entry.name === ".DS_Store") await rm(path, { force: true });
    else if (entry.isDirectory()) await removeFinderFiles(path);
  }
}

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });

const source = await readFile("catalog.js", "utf8");
const result = await minify(source, { compress: true, mangle: true });
if (!result.code) {
  throw new Error("The catalog script did not minify.");
}

await writeFile("dist/catalog.min.js", result.code);
await cp("index.html", "dist/index.html");
await cp("styles.css", "dist/styles.css");
await cp("images", "dist/images", { recursive: true });
await removeFinderFiles("dist");
