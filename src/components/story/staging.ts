import { chapters, type ChapterId } from "@/content/story";
import { TUNNEL, type Vec3 } from "./shapes";

/**
 * How each chapter is staged: where the camera stands and how it drifts while the chapter
 * holds, how the shape turns, how its glow travels, and how bright the music is.
 */
export type Staging = {
  /**
   * `dolly` is how far the camera travels over the chapter's hold. What it looks at travels
   * with it, unless `pan` says how far that moves instead.
   */
  camera: { pos: Vec3; target: Vec3; dolly: Vec3; pan?: Vec3 };
  /** Radians per second; shapes with a facing side sway at this pace instead. */
  spin: number;
  /** Glow bands: speed, how many along the shape, strength; and how much the dots flicker. */
  wave: [number, number, number, number];
  mood: number;
  /** Dot size follows brightness (the portrait). */
  sizeByLum?: boolean;
};

const tunnelEnd = TUNNEL.start - TUNNEL.gap * (TUNNEL.rings - 2);

export const STAGING: Record<ChapterId, Staging> = {
  nebula: {
    camera: { pos: [0, 3, 24], target: [0, 0, 0], dolly: [0, -2, -6] },
    spin: 0.05,
    wave: [0.05, 1.5, 0.35, 0],
    mood: 0.15,
  },
  globe: {
    camera: { pos: [0, 1, 14.5], target: [0, 0, 0], dolly: [0, 0, -2] },
    spin: 0.06,
    wave: [0.25, 3, 1, 0],
    mood: 0.3,
  },
  gears: {
    camera: { pos: [4.4, 1.6, 17.5], target: [0.9, -0.3, 0], dolly: [-2.8, -0.4, -1.5], pan: [0, 0, 0] },
    spin: 0.045,
    wave: [0.16, 2, 0.9, 0],
    mood: 0.4,
  },
  storefront: {
    camera: { pos: [7, 2.4, 12], target: [0.6, -0.1, 0.5], dolly: [-9, 0, 1.5], pan: [-0.6, 0, 0] },
    spin: 0,
    wave: [0.3, 1, 1, 0],
    mood: 0.5,
  },
  systems: {
    // Sinks from above the ring to nearly level with it, looking at the hub all the way.
    camera: { pos: [0, 8.2, 13.6], target: [0, 0, 0], dolly: [0, -5.1, 1.3], pan: [0, 0, 0] },
    spin: 0.07,
    wave: [0.6, 3, 1, 0],
    mood: 0.6,
  },
  years: {
    // Starts outside the newest ring and travels to the one before the oldest.
    camera: {
      pos: [0, 0.4, TUNNEL.start + 9],
      target: [0, 0, TUNNEL.start - 3],
      dolly: [0, 0, tunnelEnd - TUNNEL.start - 9],
    },
    spin: 0,
    wave: [0.15, 6, 0.8, 0],
    mood: 0.7,
  },
  orbits: {
    camera: { pos: [0, 6.5, 14], target: [0, 0, 0], dolly: [2, -2, -2] },
    spin: 0.05,
    wave: [0.2, 1, 0.6, 0],
    mood: 0.65,
  },
  products: {
    camera: { pos: [0, 1.2, 15.5], target: [0, 0, 0], dolly: [0, -0.5, -2.2] },
    spin: 0,
    wave: [0.4, 2, 0.8, 0],
    mood: 0.6,
  },
  motto: {
    camera: { pos: [0, 0, 15], target: [0, 0, 0], dolly: [0, 0, -3] },
    spin: 0,
    wave: [0.1, 2, 0.3, 1],
    mood: 0.35,
  },
  portrait: {
    camera: { pos: [0, 0.3, 13], target: [0, 0.3, 0], dolly: [0, 0, -1.5] },
    spin: 0,
    wave: [0, 0, 0, 0],
    mood: 0.55,
    sizeByLum: true,
  },
  portal: {
    camera: { pos: [0, 0, 16], target: [0, 0, 0], dolly: [0, 0, -9] },
    spin: 0,
    wave: [0.35, 4, 1, 0],
    mood: 0.9,
  },
};

/* ── The scroll track ────────────────────────────────────────────────────────────────────── */

/** Scroll distance per chapter, in viewport heights. */
export const SPAN_VH = 120;
/** The first part of each span the shape holds still for; it morphs over the rest. */
export const HOLD = 0.55;

/** The last chapter only holds, then the page ends. */
export const TRACK_VH = (chapters.length - 1 + HOLD) * SPAN_VH + 100;

export const spanPx = () => (window.innerHeight * SPAN_VH) / 100;

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = Math.min(Math.max((value - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
};

export type Place = {
  /** The chapter being left and the one being arrived at (the same on the last chapter). */
  from: number;
  to: number;
  /** How far through `from`'s span, 0 to 1. */
  within: number;
  /** How far the morph from `from` to `to` has got, 0 to 1. */
  mix: number;
  /** The chapter whose text is on show. */
  current: number;
  /** How far through the whole story, 0 to 1. */
  progress: number;
};

/** Where in the story a scroll position is. */
export function placeAt(scroll: number): Place {
  const last = chapters.length - 1;
  const at = Math.min(Math.max(scroll, 0) / spanPx(), last + HOLD);
  const from = Math.min(Math.floor(at), last);
  const final = from === last;
  const mix = final ? 0 : smoothstep(HOLD, 1, at - from);
  return {
    from,
    to: final ? from : from + 1,
    within: at - from,
    mix,
    current: mix < 0.5 ? from : from + 1,
    progress: at / (last + HOLD),
  };
}
