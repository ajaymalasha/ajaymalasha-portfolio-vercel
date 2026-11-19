// Cuts the excerpts of this site's own source that the "Show the code" panel displays.
//
//   npm run assets:snippets      (also runs before every `dev` and `build`)
//
// src/content/source-panel.json lists, for each section of the page, the file behind its effect
// and where the excerpt is in it:
//
//   from    text of the first line (the first line containing it). Without it: from the top.
//   until   text of the line the excerpt stops before.
//   rest    true: everything from `from` to the end of the file.
//   lines   never more than this many.
//
// With neither `until` nor `rest`, the excerpt is the block that `from` starts: it ends at the
// first line indented no deeper than the first one that closes a bracket without opening
// another, or before the first shallower line, whichever comes first.
//
// Lines are found by their text, not their number, so reformatting or editing a file does not
// leave an excerpt cut off in the middle of something. Each excerpt is written to
// public/code/<id>.txt, where the panel fetches it when opened: what a visitor reads is always
// the code that is actually running.

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const manifest = JSON.parse(readFileSync(path.join(root, "src/content/source-panel.json"), "utf8"));
const outDir = path.join(root, "public/code");
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const indentOf = (line) => line.match(/^ */)[0].length;
const isBlank = (line) => !line.trim();
/** `}` or `});` ends a block; `) {` and `} else {` close one bracket only to open the next. */
const closes = (line) => /^[\])}]/.test(line.trim()) && !/([{([]|=>)$/.test(line.trim());
const isComment = (line) => /^(\/\/|\/\*|\*)/.test(line.trim());

/** Index after the last line of the block starting at `start`. */
function blockEnd(lines, start) {
  const depth = indentOf(lines[start]);
  for (let i = start + 1; i < lines.length; i++) {
    if (isBlank(lines[i])) continue;
    const indent = indentOf(lines[i]);
    if (indent <= depth && closes(lines[i])) return i + 1;
    if (indent < depth) return i;
  }
  return lines.length;
}

let failed = false;
const fail = (entry, message) => {
  console.error(`snippets: ${entry.id}: ${message}`);
  failed = true;
};

for (const entry of [...manifest.sections, ...Object.values(manifest.stages ?? {})]) {
  let lines;
  try {
    lines = readFileSync(path.join(root, entry.file), "utf8").trimEnd().split("\n");
  } catch {
    fail(entry, `cannot read ${entry.file}`);
    continue;
  }

  let start = 0;
  if (entry.from) {
    start = lines.findIndex((line) => line.includes(entry.from));
    if (start < 0) {
      fail(entry, `"${entry.from}" not found in ${entry.file}`);
      continue;
    }
  }

  let end = lines.length;
  if (entry.until) {
    end = lines.findIndex((line, i) => i > start && line.includes(entry.until));
    if (end < 0) {
      fail(entry, `"${entry.until}" not found after "${entry.from}" in ${entry.file}`);
      continue;
    }
    // The comment above the line stopped at belongs to that line, not to the excerpt.
    while (end > start + 1 && (isBlank(lines[end - 1]) || isComment(lines[end - 1]))) end--;
  } else if (entry.from && !entry.rest) {
    end = blockEnd(lines, start);
  }
  if (entry.lines) end = Math.min(end, start + entry.lines);
  while (end > start + 1 && isBlank(lines[end - 1])) end--;

  // Excerpts from inside a function are shown flush left: the shared indentation is removed.
  const picked = lines.slice(start, end);
  const indent = Math.min(...picked.filter((line) => !isBlank(line)).map(indentOf));
  const excerpt = picked.map((line) => line.slice(indent)).join("\n");
  writeFileSync(path.join(outDir, `${entry.id}.txt`), `${excerpt}\n`);
}
process.exit(failed ? 1 : 0);
