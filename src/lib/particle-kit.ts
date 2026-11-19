"use client";

import { prefersReducedMotion } from "./device";

/**
 * The pieces every particle scene shares: turning a picture or a word into points, matching two
 * point sets in size, per-dot random numbers, and the timing of the first gathering.
 * Scenes: components/fx/ParticleMorph (the site's cloud) and components/story (the 3D story).
 */

export const PORTRAIT_URL = "/portrait/cutout.webp";
export const PORTRAIT_BW_URL = "/portrait/cutout-bw.webp";
export const AVATAR_URL = "/portrait/avatar.webp";

/** Numbers the "Show the code" panel reports. */
export const fx = { dots: 0 };

let portrait: Promise<HTMLImageElement> | null = null;

/** The cut-out portrait, decoded once and shared. */
export function loadPortrait(): Promise<HTMLImageElement> {
  portrait ??= (async () => {
    const image = new Image();
    image.src = PORTRAIT_URL;
    await image.decode();
    return image;
  })();
  return portrait;
}

export type Sample = {
  /** x, y, z per point. x and y are in picture heights, centred on the picture; y points up. */
  positions: Float32Array;
  /** Brightness per point, 0 to 1, after `tone`. */
  lums: Float32Array;
  count: number;
};

/**
 * The portrait is a black T-shirt against black: left alone, the torso would sample as almost
 * nothing. This lifts the darkest tones into a readable grey and leaves the highlights alone.
 */
export const liftShadows = (lum: number) => 0.2 + 0.8 * Math.pow(lum, 0.72);

/**
 * One point for every `step`-th opaque pixel of `source`. Brighter pixels sit slightly nearer
 * (z), which gives the flat picture a little relief when it turns.
 */
export function samplePoints(
  source: HTMLImageElement | HTMLCanvasElement,
  step: number,
  { height = source.height, tone = (lum: number) => lum }: { height?: number; tone?: (lum: number) => number } = {},
): Sample {
  const scale = height / source.height;
  const w = Math.round(source.width * scale);
  const h = Math.round(height);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(source, 0, 0, w, h);
  const { data } = context.getImageData(0, 0, w, h);

  const positions: number[] = [];
  const lums: number[] = [];
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4;
      if (data[i + 3] < 128) continue;
      const lum = tone((0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255);
      positions.push((x - w / 2) / h, 0.5 - y / h, lum * 0.04 + (Math.random() - 0.5) * 0.02);
      lums.push(lum);
    }
  }
  return { positions: new Float32Array(positions), lums: new Float32Array(lums), count: lums.length };
}

/**
 * Stretches or thins a point set to exactly `count` points, so any two shapes can be morphed
 * dot for dot. Extra points are copies of existing ones, nudged by `jitter` so they do not stack.
 */
export function fitCount(points: Float32Array, count: number, jitter = 0): Float32Array {
  const have = points.length / 3;
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const from = (have > count ? Math.floor((i * have) / count) : i < have ? i : Math.floor(Math.random() * have)) * 3;
    out[i * 3] = points[from] + (Math.random() - 0.5) * jitter;
    out[i * 3 + 1] = points[from + 1] + (Math.random() - 0.5) * jitter;
    out[i * 3 + 2] = points[from + 2];
  }
  return out;
}

/** `text` drawn in the site's bold weight on a transparent canvas `width` px wide, ready to sample. */
export async function textCanvas(text: string, { weight = 700, width = 1600 } = {}): Promise<HTMLCanvasElement> {
  const family = getComputedStyle(document.documentElement).getPropertyValue("--font-geist").trim() || "sans-serif";
  const font = (size: number) => `${weight} ${size}px ${family}, sans-serif`;
  await document.fonts.load(font(100), text);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d")!;
  context.font = font(100);
  const size = (100 * width * 0.98) / context.measureText(text).width;
  context.font = font(size);
  const metrics = context.measureText(text);
  const pad = size * 0.04;
  canvas.width = width;
  canvas.height = Math.ceil(metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent + pad * 2);
  context.font = font(size); // resizing a canvas resets its state
  context.fillStyle = "#ddd";
  context.fillText(text, (width - metrics.width) / 2, pad + metrics.actualBoundingBoxAscent);
  return canvas;
}

/** `text` as exactly `count` points, plus its width-to-height ratio. */
export async function textPoints(text: string, count: number): Promise<{ points: Float32Array; aspect: number }> {
  const step = 4;
  const canvas = await textCanvas(text);
  const { positions } = samplePoints(canvas, step);
  return { points: fitCount(positions, count, step / canvas.height), aspect: canvas.width / canvas.height };
}

/** `per` random numbers in 0..1 for each of `count` dots: their stagger, drift and size. */
export function seeds(count: number, per = 3): Float32Array {
  const out = new Float32Array(count * per);
  for (let i = 0; i < out.length; i++) out[i] = Math.random();
  return out;
}

/**
 * The first gathering: dots start scattered and assemble once the page is ready to be seen
 * (`html.is-loaded`). `progress(time)` runs 0 to 1 over `duration` seconds from that moment.
 */
export function createIntro(duration = 2.6) {
  let loaded = document.documentElement.classList.contains("is-loaded");
  let startedAt: number | null = null;
  const onLoaded = () => (loaded = true);
  window.addEventListener("app:loaded", onLoaded, { once: true });
  const reduced = prefersReducedMotion();
  return {
    progress(time: number) {
      if (reduced) return 1;
      if (loaded && startedAt === null) startedAt = time + 0.2;
      return startedAt === null ? 0 : Math.min(Math.max((time - startedAt) / duration, 0), 1);
    },
    dispose() {
      window.removeEventListener("app:loaded", onLoaded);
    },
  };
}

/** GLSL: ease in and out, cubic. Shared by every morph. */
export const EASE_GLSL = /* glsl */ `
  float easeInOut(float t) {
    return t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0;
  }
`;

/** Colours as numbers, for canvas and WebGL code that cannot read CSS variables per frame. */
export const COLORS = {
  ink: "#0b0b0a",
  sand: "#ece8df",
  accent: "#ff4f00",
  accentLight: "#ff9466",
  live: "#3ddc84",
} as const;
