/**
 * The shapes the site's particle cloud takes, one per section, and how each is placed.
 *
 * Every shape is generated here, in code: `count` points inside a box roughly one unit across,
 * centred on the origin, y up, z towards the viewer. There are no model files. The cloud
 * (components/fx/ParticleMorph) morphs between two of them at a time as the page scrolls; the
 * dot stage (components/fx/DotStage) borrows the medal and the wave to hand over to it.
 */

export type FormName =
  | "portrait"
  | "line"
  | "medal"
  | "cube"
  | "torus"
  | "helix"
  | "wave"
  | "cloud"
  | "braces"
  | "shuttle"
  | "gear"
  | "name";

/** Which shape each section turns the cloud into, in page order. */
export const SECTIONS: [selector: string, form: FormName][] = [
  ["#about", "medal"],
  ["#services", "cube"],
  ["#work", "torus"],
  ["#building", "helix"],
  ["#experience", "wave"],
  ["#motto", "cloud"],
  ["#method", "braces"],
  ["#off-clock", "shuttle"],
  ["#brief", "gear"],
  ["#contact", "name"],
];

/** Sections that draw their own pictures on the dot stage: the cloud skips their shapes then. */
export const STAGED = ["#services", "#work", "#building"];

export type FormConfig = {
  /**
   * portrait: in the hero's portrait box. side / center / full: free on screen, used when the
   * section has no slot for it. line: on the hero's name line. name: on the footer's name.
   */
  layout: "portrait" | "side" | "center" | "full" | "line" | "name";
  /** Lean back, in radians, and turns per second about the upright axis. */
  tilt?: number;
  spin?: number;
  alpha: number;
  /** Size when free on screen, and when placed in its section's slot (times the slot's size). */
  scale?: number;
  slotScale?: number;
  /** How much the shape turns to face the pointer (1 = fully, 0 = not at all). */
  follow?: number;
  /** Where on screen when free, as fractions of the viewport (laptops and up). */
  at?: [number, number];
};

export const FORMS: Record<FormName, FormConfig> = {
  portrait: { layout: "portrait", alpha: 1 },
  line: { layout: "line", alpha: 1.6, follow: 0 },
  medal: { layout: "side", alpha: 0.55, slotScale: 1.1 },
  cube: { layout: "side", tilt: 0.55, spin: 0.2, alpha: 0.5, scale: 0.62, slotScale: 1.3 },
  torus: { layout: "side", tilt: 1.05, spin: 0.18, alpha: 0.32, slotScale: 1.2 },
  helix: { layout: "side", tilt: 0.25, spin: 0.35, alpha: 0.4, scale: 0.5, slotScale: 1.1 },
  wave: { layout: "center", tilt: 0.95, spin: 0.06, alpha: 0.45, slotScale: 1.15 },
  cloud: { layout: "full", spin: 0.03, alpha: 0.3 },
  braces: { layout: "side", alpha: 0.45, scale: 0.5, follow: 0.25, slotScale: 0.8 },
  shuttle: { layout: "side", tilt: 0.42, spin: 0.5, alpha: 0.5, scale: 0.4, slotScale: 1.25 },
  gear: { layout: "side", tilt: 0.95, spin: 0.32, alpha: 0.45, scale: 0.3, slotScale: 1.25 },
  name: { layout: "name", alpha: 0.55, follow: 0.12 },
};

const TAU = Math.PI * 2;
const rand = (min = -1, max = 1) => min + Math.random() * (max - min);

/** A four-point sparkle centred at (cx, cy): the mark cut out of the medal. */
function inSparkle(x: number, y: number, cx: number, cy: number, size: number): boolean {
  const dx = Math.abs(x - cx) / size;
  const dy = Math.abs(y - cy) / size;
  return Math.pow(dx, 0.62) + Math.pow(dy, 0.62) < 1;
}

type Shape = (count: number, out: Float32Array) => void;

export const SHAPES: Partial<Record<FormName, Shape>> = {
  /** A coin of dots with a sparkle (and a smaller one) left empty in it: "AI", without a logo. */
  medal(count, out) {
    const R = 0.46;
    for (let i = 0; i < count; i++) {
      let x: number, y: number, z: number;
      do {
        // A point on a sphere, squashed almost flat: denser towards the rim, like a struck coin.
        y = rand();
        const angle = rand(0, TAU);
        const ring = Math.sqrt(1 - y * y);
        x = Math.cos(angle) * ring;
        z = Math.sin(angle) * ring;
      } while (inSparkle(x, y, -0.08, -0.06, 0.62) || inSparkle(x, y, 0.42, 0.42, 0.26));
      out.set([x * R, y * R, z * R * 0.15], i * 3);
    }
  },

  /** The six faces of a box, as a lattice. */
  cube(count, out) {
    const half = 0.3;
    for (let i = 0; i < count; i++) {
      const a = (Math.floor(Math.random() * 14) / 13 - 0.5) * 2 * half + rand() * 0.006;
      const b = (Math.floor(Math.random() * 14) / 13 - 0.5) * 2 * half + rand() * 0.006;
      const side = i % 2 ? half : -half;
      const axis = (i >> 1) % 3;
      out.set(axis === 0 ? [side, a, b] : axis === 1 ? [a, side, b] : [a, b, side], i * 3);
    }
  },

  torus(count, out) {
    for (let i = 0; i < count; i++) {
      const around = Math.random() * TAU;
      const tube = Math.random() * TAU;
      const r = 0.33 + 0.11 * Math.cos(tube);
      out.set([r * Math.cos(around), 0.11 * Math.sin(tube), r * Math.sin(around)], i * 3);
    }
  },

  /** Two strands and the rungs between them. */
  helix(count, out) {
    const radius = 0.17;
    const height = 0.85;
    for (let i = 0; i < count; i++) {
      const t = Math.random();
      if (i % 5 < 2) {
        const angle = t * TAU * 2 + (i % 5) * Math.PI;
        out.set(
          [Math.cos(angle) * radius + rand() * 0.008, (t - 0.5) * height, Math.sin(angle) * radius + rand() * 0.008],
          i * 3,
        );
      } else {
        const rung = Math.floor(t * 26) / 26;
        const angle = rung * TAU * 2;
        const along = rand();
        out.set([Math.cos(angle) * radius * along, (rung - 0.5) * height, Math.sin(angle) * radius * along], i * 3);
      }
    }
  },

  /** A rippling sheet. */
  wave(count, out) {
    const side = Math.ceil(Math.sqrt(count));
    for (let i = 0; i < count; i++) {
      const x = ((i % side) / side - 0.5) * 1.1;
      const z = (Math.floor(i / side) / side - 0.5) * 1.1;
      out.set([x, 0.06 * Math.sin(x * 9) + 0.06 * Math.cos(z * 7), z], i * 3);
    }
  },

  /** Dust filling the screen. */
  cloud(count, out) {
    for (let i = 0; i < count; i++) {
      const [x, y, z] = [rand(), rand(), rand()];
      const reach = (Math.cbrt(Math.random()) * 1.2) / (Math.hypot(x, y, z) || 1);
      out.set([x * reach, y * reach, z * reach], i * 3);
    }
  },

  /**
   * A shuttlecock, standing on its cork: he plays badminton professionally. Sixteen feathers
   * fan out from a rounded cork, with two bands of thread around them.
   */
  shuttle(count, out) {
    const FEATHERS = 16;
    const corkR = 0.105;
    const skirtBase = -0.2; // where the feathers leave the cork
    const skirtTop = 0.38;
    const radiusAt = (y: number) => 0.085 + ((y - skirtBase) / (skirtTop - skirtBase)) * 0.25;
    for (let i = 0; i < count; i++) {
      const pick = i % 20;
      if (pick < 5) {
        // The cork: the lower half of a ball, and a flat band where it meets the feathers.
        const angle = rand(0, TAU);
        const down = Math.random();
        const ring = Math.sqrt(1 - down * down);
        const flat = pick === 0;
        const r = flat ? corkR * Math.sqrt(Math.random()) : corkR * ring;
        out.set([Math.cos(angle) * r, skirtBase - (flat ? 0 : down * corkR * 1.15), Math.sin(angle) * r], i * 3);
      } else if (pick < 17) {
        // The feathers: each a narrow stripe from cork to tip, wider at the top.
        const feather = Math.floor(Math.random() * FEATHERS);
        const up = Math.pow(Math.random(), 0.8);
        const y = skirtBase + up * (skirtTop - skirtBase);
        const spread = (0.012 + up * 0.075) * rand();
        const angle = (feather / FEATHERS) * TAU + spread / radiusAt(y);
        const tip = up > 0.92 ? Math.cos(spread * 14) * 0.02 : 0; // a slight scallop along the top edge
        out.set([Math.cos(angle) * radiusAt(y), y + tip, Math.sin(angle) * radiusAt(y)], i * 3);
      } else {
        // Two bands of thread that hold the feathers.
        const y = skirtBase + (pick === 17 ? 0.16 : 0.3) * (skirtTop - skirtBase) + rand() * 0.004;
        const angle = rand(0, TAU);
        out.set([Math.cos(angle) * radiusAt(y), y, Math.sin(angle) * radiusAt(y)], i * 3);
      }
    }
  },

  /**
   * A spur gear lying flat (its axle is the upright axis, so it turns as it spins): toothed rim,
   * hub and spokes. He started out designing gearboxes.
   */
  gear(count, out) {
    const TEETH = 14;
    const root = 0.34;
    const tip = 0.43;
    const thick = 0.05;
    const SPOKES = 6;
    const rimRadius = (angle: number) => {
      // A flat-topped tooth profile with sloped flanks.
      const phase = ((angle / TAU) * TEETH) % 1;
      const rise = Math.min(1, Math.max(0, (0.5 - Math.abs(phase - 0.5)) * 5 - 0.6));
      return root + (tip - root) * rise;
    };
    for (let i = 0; i < count; i++) {
      const pick = i % 10;
      const angle = rand(0, TAU);
      const y = rand() * thick;
      if (pick < 5) {
        // The toothed outline, top and bottom faces and the wall between them.
        const r = rimRadius(angle) - (pick === 0 ? Math.random() * 0.05 : 0);
        out.set([Math.cos(angle) * r, pick < 3 ? Math.sign(y || 1) * thick : y, Math.sin(angle) * r], i * 3);
      } else if (pick < 7) {
        // The inner edge of the rim.
        out.set([Math.cos(angle) * 0.27, y, Math.sin(angle) * 0.27], i * 3);
      } else if (pick < 9) {
        // Spokes.
        const spoke = (Math.floor(Math.random() * SPOKES) / SPOKES) * TAU;
        const r = rand(0.09, 0.27);
        const off = rand() * 0.018;
        out.set([Math.cos(spoke) * r - Math.sin(spoke) * off, y, Math.sin(spoke) * r + Math.cos(spoke) * off], i * 3);
      } else {
        // The hub, with its bore left open.
        const r = rand(0.045, 0.095);
        out.set([Math.cos(angle) * r, y * 1.6, Math.sin(angle) * r], i * 3);
      }
    }
  },
};

/**
 * A shape as the dot stage needs it: seen from the front at its resting tilt, flattened to
 * 0..1 across a square (x right, y down), `count` points.
 */
export function flatten(name: FormName, count: number): Float32Array {
  const points = new Float32Array(count * 3);
  SHAPES[name]?.(count, points);
  const tilt = FORMS[name].tilt ?? 0;
  const cos = Math.cos(tilt);
  const sin = Math.sin(tilt);
  const flat = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    flat[i * 2] = points[i * 3] + 0.5;
    flat[i * 2 + 1] = 0.5 - (points[i * 3 + 1] * cos - points[i * 3 + 2] * sin);
  }
  return flat;
}
