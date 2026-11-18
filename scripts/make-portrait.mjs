// Turns one portrait photo into every rendition the site uses.
//
//   npm run assets:portrait -- [path/to/photo]        (default: .context/source/portrait.png)
//
// The raw photo stays out of the repository. The person is cut out with macOS Vision
// (scripts/portrait-mask.swift), then sharp writes:
//
//   public/portrait/cutout.webp    colour, transparent background: the photo behind the hero's dots,
//                                  and the source the dots themselves are sampled from
//   public/portrait/cutout-bw.webp the same in black and white (menu)
//   public/portrait/avatar.webp    square head-and-shoulders crop on the photo's own background
//   public/portrait/portrait.json  sizes, so the page can reserve the right space
//
// A portrait framed like the current one (head near the top, cropped around the hips) needs no
// options. `--head 0.185` moves the avatar's centre down the figure, `--zoom 0.4` sets how much of
// the figure's height the avatar shows.

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};
const positional = args.filter((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
const source = path.resolve(positional[0] ?? path.join(root, ".context/source/portrait.png"));
const outDir = path.join(root, "public/portrait");
const tmpDir = path.join(root, ".context/tmp");
const mattePath = path.join(tmpDir, "portrait-matte.png");
mkdirSync(outDir, { recursive: true });
mkdirSync(tmpDir, { recursive: true });

execFileSync("swift", [path.join(root, "scripts/portrait-mask.swift"), source, mattePath, "subject"], {
  stdio: "inherit",
});

const photo = sharp(source).removeAlpha();
const { width, height } = await photo.metadata();
const matte = await sharp(mattePath).resize(width, height, { fit: "fill" }).greyscale().raw().toBuffer();

// Where the person is.
let minX = width,
  maxX = 0,
  minY = height,
  maxY = 0;
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    if (matte[y * width + x] > 128) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}
const figureHeight = maxY - minY + 1;

// The cut-out: the figure with a little air above and beside it, flush at the bottom.
const padX = Math.round((maxX - minX) * 0.03);
const padTop = Math.round(figureHeight * 0.03);
const crop = {
  left: Math.max(0, minX - padX),
  top: Math.max(0, minY - padTop),
  width: 0,
  height: 0,
};
crop.width = Math.min(width, maxX + padX + 1) - crop.left;
crop.height = maxY + 1 - crop.top;

const OUT_HEIGHT = 1200;
const outWidth = Math.round((crop.width / crop.height) * OUT_HEIGHT);

const withAlpha = await sharp(source)
  .removeAlpha()
  .joinChannel(matte, { raw: { width, height, channels: 1 } })
  .extract(crop)
  .resize(outWidth, OUT_HEIGHT)
  .png()
  .toBuffer();

await sharp(withAlpha).webp({ quality: 86, alphaQuality: 92 }).toFile(path.join(outDir, "cutout.webp"));
await sharp(withAlpha)
  .greyscale()
  .linear(1.12, -6)
  .webp({ quality: 84, alphaQuality: 92 })
  .toFile(path.join(outDir, "cutout-bw.webp"));

// The avatar: a square around the head, centred on the top of the figure.
let sumX = 0,
  count = 0;
const headRows = minY + Math.round(figureHeight * 0.2);
for (let y = minY; y < headRows; y++) {
  for (let x = 0; x < width; x++) {
    if (matte[y * width + x] > 128) {
      sumX += x;
      count++;
    }
  }
}
const headX = count ? sumX / count : (minX + maxX) / 2;
const side = Math.round(figureHeight * flag("zoom", 0.4));
const centreY = minY + figureHeight * flag("head", 0.185);
const avatar = {
  left: Math.round(Math.min(Math.max(0, headX - side / 2), width - side)),
  top: Math.round(Math.min(Math.max(0, centreY - side / 2), height - side)),
  width: side,
  height: side,
};
await sharp(source).removeAlpha().extract(avatar).resize(512, 512).webp({ quality: 84 }).toFile(path.join(outDir, "avatar.webp"));

writeFileSync(
  path.join(outDir, "portrait.json"),
  `${JSON.stringify({ width: outWidth, height: OUT_HEIGHT, avatar: 512 }, null, 2)}\n`,
);

console.log(`figure ${maxX - minX + 1}x${figureHeight} in ${width}x${height}`);
console.log(`cutout.webp, cutout-bw.webp ${outWidth}x${OUT_HEIGHT} · avatar.webp 512x512`);
