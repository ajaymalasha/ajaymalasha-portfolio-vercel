// Makes the card shown when the site's link is shared: a photograph of the site's own hero.
//
//   npm run assets:og            (the site must be running: `npm run dev` or `npm run start`)
//   npm run assets:og -- http://localhost:3200
//
// Opens the hero in headless Chromium at 1200x630 with the real GPU, waits for the dots to
// gather into the portrait, hides the dock, and writes src/app/opengraph-image.png and
// twitter-image.png (Next.js picks both up by name). The first run needs the browser:
// `npx playwright install chromium-headless-shell`.

import { writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const origin = (process.argv[2] ?? "http://localhost:3200").replace(/\/+$/, "");

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"],
});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.goto(`${origin}/?v=site`, { waitUntil: "load", timeout: 60000 });
await page.waitForTimeout(7000);

const drawn = await page.evaluate(() => document.documentElement.classList.contains("has-particles"));
if (!drawn) console.warn("og: the particle cloud did not start (no GPU?): the card shows the still fallback");

await page.addStyleTag({ content: "[data-dock], nextjs-portal { display: none !important; }" });
const shot = await page.screenshot({ type: "png" });
await browser.close();

const card = await sharp(shot).png({ compressionLevel: 9, palette: true, quality: 90 }).toBuffer();
for (const name of ["opengraph-image.png", "twitter-image.png"]) {
  writeFileSync(path.join(root, "src/app", name), card);
}
console.log(`og: wrote opengraph-image.png and twitter-image.png (${Math.round(card.length / 1024)} KB)`);
