// Prepares the storefront captures shown in the work section.
//
//   npm run assets:work -- <folder>
//
// <folder> holds one capture per brand, named by its slug in src/content/sections.ts, either as
// <slug>.png|jpg|webp or as <slug>/card-960.webp (the layout of the earlier portfolio's
// public/work folder). Each is cropped from the top to 16:10 and written to
// public/work/<slug>.webp at 960x600: the size the dot stage samples, and the hover preview.
//
// Captures show the stores as they looked on capture day and belong to the brands; see README.

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const folder = process.argv[2];
if (!folder) {
  console.error("usage: npm run assets:work -- <folder with captures>");
  process.exit(2);
}

// Slugs come from the content file, so the two cannot drift apart.
const content = readFileSync(path.join(root, "src/content/sections.ts"), "utf8");
const slugs = [...content.matchAll(/slug:\s*"([a-z0-9-]+)"/g)].map((m) => m[1]);
const outDir = path.join(root, "public/work");
mkdirSync(outDir, { recursive: true });

let missing = 0;
for (const slug of slugs) {
  const candidates = [`${slug}.png`, `${slug}.jpg`, `${slug}.webp`, `${slug}/card-960.webp`, `${slug}-desktop.png`].map(
    (name) => path.join(folder, name),
  );
  const input = candidates.find((file) => existsSync(file));
  if (!input) {
    console.warn(`missing  ${slug}`);
    missing++;
    continue;
  }
  await sharp(input)
    .resize(960, 600, { fit: "cover", position: "top" })
    .webp({ quality: 80 })
    .toFile(path.join(outDir, `${slug}.webp`));
  console.log(`wrote    public/work/${slug}.webp`);
}
process.exit(missing ? 1 : 0);
