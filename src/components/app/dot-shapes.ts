/**
 * The formations the loose dots of the entry screen and of the Site / Story transition settle
 * into: a ring while waiting, a flat grid for the site, a tilted three-arm spiral for the story.
 * Each function answers "where does this dot belong right now", in CSS pixels.
 */

export type Point = [x: number, y: number];

/** The parts of a dot that decide its place in a formation. */
export type DotSeed = {
  /** Golden-angle position around the ring. */
  angle: number;
  /** 0 to 1: how far from the ring's middle line, and the spiral's sideways scatter. */
  ring: number;
  /** Which of the three spiral arms. */
  arm: number;
  /** 0 to 1: how far along its arm. */
  along: number;
};

export type Field = { width: number; height: number };

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const ARMS = 3;

export function seedDot(index: number): DotSeed {
  return { angle: index * GOLDEN_ANGLE, ring: Math.random(), arm: index % ARMS, along: Math.random() };
}

export function ringPoint(seed: DotSeed, field: Field, radius: number, time: number): Point {
  const angle = seed.angle + time * 0.15;
  const r = radius * (0.92 + seed.ring * 0.16);
  return [field.width / 2 + Math.cos(angle) * r, field.height / 2 + Math.sin(angle) * r];
}

/** Rows of `columns` dots, centred, in a block 80% of the screen wide and a little over half as tall. */
export function gridPoint(index: number, total: number, field: Field, columns: number, maxHeight = Infinity): Point {
  const rows = Math.ceil(total / columns);
  const blockWidth = Math.min(field.width * 0.8, 1100);
  const blockHeight = Math.min(blockWidth * 0.55, maxHeight);
  const column = index % columns;
  const row = Math.floor(index / columns);
  return [
    field.width / 2 - blockWidth / 2 + (column / (columns - 1)) * blockWidth,
    field.height / 2 - blockHeight / 2 + (row / Math.max(1, rows - 1)) * blockHeight,
  ];
}

/** A slowly turning spiral seen from above its rim: squashed vertically, nearer dots spread wider. */
export function spiralPoint(seed: DotSeed, field: Field, radius: number, time: number): Point {
  const reach = Math.pow(seed.along, 0.7) * radius * 1.35;
  const angle = seed.arm * ((Math.PI * 2) / ARMS) + seed.along * 4.2 + time * 0.25;
  const x = Math.cos(angle) * reach + (seed.ring - 0.5) * 24;
  const depth = Math.sin(angle) * reach;
  const perspective = 900 / (900 + depth * 0.6);
  return [field.width / 2 + x * perspective, field.height / 2 + depth * 0.38 * perspective];
}

/** Sizes a full-screen canvas for the display and returns its 2D context, scaled to CSS pixels. */
export function fitCanvas(canvas: HTMLCanvasElement): { ctx: CanvasRenderingContext2D | null; field: Field } {
  const ratio = Math.min(window.devicePixelRatio, 2);
  const field = { width: window.innerWidth, height: window.innerHeight };
  canvas.width = field.width * ratio;
  canvas.height = field.height * ratio;
  const ctx = canvas.getContext("2d");
  ctx?.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { ctx, field };
}

export const dotCount = (field: Field) => (field.width < 648 ? 520 : 1000);
