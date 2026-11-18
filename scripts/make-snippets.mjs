// Cuts the excerpts of this site's own source that the "Show the code" panel displays.
//
//   npm run assets:snippets      (also runs before every `dev` and `build`)
//
// src/content/source-panel.json lists, for each section of the page, the file behind its effect
// and optionally a line to start from (`from`, matched as text) and how many lines to show.
// Each excerpt is written to public/code/<id>.txt, where the panel fetches it when opened, so
// what a visitor reads is always the code that is actually running.

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const manifest = JSON.parse(readFileSync(path.join(root, "src/content/source-panel.json"), "utf8"));
const outDir = path.join(root, "public/code");
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

let failed = false;
for (const entry of [...manifest.sections, ...Object.values(manifest.stages ?? {})]) {
  let lines;
  try {
    lines = readFileSync(path.join(root, entry.file), "utf8").trimEnd().split("\n");
  } catch {
    console.error(`snippets: ${entry.id}: cannot read ${entry.file}`);
    failed = true;
    continue;
  }
  let start = 0;
  if (entry.from) {
    start = lines.findIndex((line) => line.includes(entry.from));
    if (start < 0) {
      console.error(`snippets: ${entry.id}: "${entry.from}" not found in ${entry.file}`);
      failed = true;
      continue;
    }
  }
  const excerpt = lines.slice(start, entry.lines ? start + entry.lines : undefined).join("\n");
  writeFileSync(path.join(outDir, `${entry.id}.txt`), `${excerpt}\n`);
}
process.exit(failed ? 1 : 0);
