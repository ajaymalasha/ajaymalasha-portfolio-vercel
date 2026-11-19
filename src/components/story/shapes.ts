import { site } from "@/content/site";
import { homeLabel, mottoWord, planets, systems, tiles, years, type ChapterId } from "@/content/story";
import { liftShadows, samplePoints, textPoints } from "@/lib/particle-kit";

/**
 * The shape each chapter's dots take. Every builder returns the same number of dots, so any
 * two shapes can be morphed dot for dot. Units are the scene's: a shape is about ten across.
 */

export type Vec3 = [number, number, number];

/** Something in a shape that can be pointed at: it has a floating label and an info card. */
export type StoryLabel = {
  text: string;
  detail: string;
  /** Where the label floats. */
  pos: Vec3;
  /** The thing itself: what the pointer has to be near, and where the card attaches. */
  anchor: Vec3;
  /** Which dots light up with it (matches `Shape.group`). */
  group: number;
  timeZone?: string;
  href?: string;
};

export type Shape = {
  pos: Float32Array;
  /** 0 to 1 per dot: where the travelling glow is along the shape (and dot size in the portrait). */
  param: Float32Array;
  /** The labelled group a dot belongs to, or -1. */
  group: Float32Array;
  /** Per dot: an axis (x, y) parallel to z to turn around, and how fast. Only the gears use it. */
  turn: Float32Array;
  labels: StoryLabel[];
  /** A direction that should face the viewer: the shape sways around it instead of spinning. */
  facing?: Vec3;
};

const TAU = Math.PI * 2;
const between = (min = -1, max = 1) => min + Math.random() * (max - min);
/** Roughly bell-shaped around 0, within -1..1: softer edges than plain random. */
const soft = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

function blank(count: number): Shape {
  return {
    pos: new Float32Array(count * 3),
    param: new Float32Array(count),
    group: new Float32Array(count).fill(-1),
    turn: new Float32Array(count * 3),
    labels: [],
  };
}

function put(shape: Shape, i: number, [x, y, z]: Vec3, param: number, group = -1) {
  shape.pos[i * 3] = x;
  shape.pos[i * 3 + 1] = y;
  shape.pos[i * 3 + 2] = z;
  shape.param[i] = param;
  shape.group[i] = group;
}

type Part = [weight: number, place: (dot: number, nth: number, of: number) => void];

/** Shares `count` dots between the parts of a shape by weight; the last part takes the remainder. */
function share(count: number, parts: Part[]) {
  const total = parts.reduce((sum, [weight]) => sum + weight, 0);
  let used = 0;
  parts.forEach(([weight, place], index) => {
    const n = index === parts.length - 1 ? count - used : Math.min(count - used, Math.round((weight / total) * count));
    for (let k = 0; k < n; k++) place(used + k, k, n);
    used += n;
  });
}

/** A random point inside a ball of `radius` around `centre`. */
function inBall(centre: Vec3, radius: number): Vec3 {
  const d: Vec3 = [soft(), soft(), soft()];
  const length = Math.hypot(...d) || 1;
  const r = radius * Math.cbrt(Math.random());
  return [centre[0] + (d[0] / length) * r, centre[1] + (d[1] / length) * r, centre[2] + (d[2] / length) * r];
}

/* ── nebula: where it starts, a wide flattened cloud ─────────────────────────────────────── */

function nebula(count: number): Shape {
  const shape = blank(count);
  const radius = 9;
  for (let i = 0; i < count; i++) {
    const r = Math.cbrt(Math.random()) * radius;
    const around = Math.random() * TAU;
    const tilt = Math.acos(between());
    put(
      shape,
      i,
      [r * Math.sin(tilt) * Math.cos(around), r * Math.cos(tilt) * 0.45, r * Math.sin(tilt) * Math.sin(around)],
      r / radius,
    );
  }
  return shape;
}

/* ── globe: a dotted sphere, orbit rings, and home ───────────────────────────────────────── */

function onGlobe(lat: number, lon: number): Vec3 {
  const phi = (lat * Math.PI) / 180;
  const lambda = (lon * Math.PI) / 180;
  return [Math.cos(phi) * Math.sin(lambda), Math.sin(phi), Math.cos(phi) * Math.cos(lambda)];
}

function globe(count: number): Shape {
  const shape = blank(count);
  const radius = 4;
  const home = onGlobe(site.home.lat, site.home.lon);
  const golden = Math.PI * (3 - Math.sqrt(5));
  const ringTilts = [0.35, -0.6, 1.1];

  share(count, [
    [
      72,
      (i, k, n) => {
        // An even spiral of dots; the glow ripples outward from home.
        const y = 1 - (2 * (k + 0.5)) / n;
        const r = Math.sqrt(1 - y * y);
        const p: Vec3 = [Math.cos(golden * k) * r, y, Math.sin(golden * k) * r];
        const fromHome = Math.acos(Math.min(1, p[0] * home[0] + p[1] * home[1] + p[2] * home[2])) / Math.PI;
        put(shape, i, [p[0] * radius, p[1] * radius, p[2] * radius], fromHome);
      },
    ],
    [
      16,
      (i, k) => {
        const ring = k % ringTilts.length;
        const angle = Math.random() * TAU;
        const r = radius * (1.3 + ring * 0.14);
        const y = Math.sin(angle) * r;
        put(shape, i, [Math.cos(angle) * r, y * Math.sin(ringTilts[ring]), y * Math.cos(ringTilts[ring])], 1);
      },
    ],
    [
      12,
      (i) => {
        // A tuft standing on the surface at home.
        const lift = 1 + Math.abs(soft()) * 0.25;
        const d = home.map((v) => v + soft() * 0.06);
        const length = Math.hypot(...d);
        put(
          shape,
          i,
          [(d[0] / length) * radius * lift, (d[1] / length) * radius * lift, (d[2] / length) * radius * lift],
          0,
          0,
        );
      },
    ],
  ]);

  shape.labels.push({
    ...homeLabel,
    pos: [home[0] * radius * 1.12, home[1] * radius * 1.12, home[2] * radius * 1.12],
    anchor: [home[0] * radius, home[1] * radius, home[2] * radius],
    group: 0,
  });
  shape.facing = home;
  return shape;
}

/* ── gears: where he started, three meshing spur gears ───────────────────────────────────── */

type Gear = { x: number; y: number; teeth: number; phase: number; speed: number };

/** Size of a tooth: a gear's pitch radius is `MODULE * teeth / 2`, as on a drawing. */
const MODULE = 0.3;
const GEAR_DEPTH = 0.5;

/**
 * Three gears in a train. Each is placed at the right distance and angle from the one that
 * drives it, with its teeth offset so they fall in the other's gaps, and turns the other way
 * at a speed set by the ratio of teeth: the dots mesh for as long as the scene runs.
 */
function gearTrain(): Gear[] {
  const pitch = (teeth: number) => (MODULE * teeth) / 2;
  const driver: Gear = { x: -1.9, y: -0.3, teeth: 22, phase: 0.35, speed: 0.22 };
  const train = [driver];
  const mesh = (from: Gear, teeth: number, direction: number) => {
    const distance = pitch(from.teeth) + pitch(teeth);
    const step = TAU / from.teeth;
    // How far through one of the driver's teeth the contact point is, 0 to 1.
    const through = ((((direction - from.phase) / step) % 1) + 1) % 1;
    const gear: Gear = {
      x: from.x + Math.cos(direction) * distance,
      y: from.y + Math.sin(direction) * distance,
      teeth,
      // The driven gear must be half a tooth out of step with the driver at the contact point.
      phase: direction + Math.PI - (0.5 - through) * (TAU / teeth),
      speed: (-from.speed * from.teeth) / teeth,
    };
    train.push(gear);
    return gear;
  };
  const second = mesh(driver, 13, 0.35);
  mesh(second, 9, -1.3);
  return train;
}

function gears(count: number): Shape {
  const shape = blank(count);
  const train = gearTrain();

  const parts: Part[] = train.flatMap((gear): Part[] => {
    const pitch = (MODULE * gear.teeth) / 2;
    const tip = pitch + MODULE * 0.9;
    const root = pitch - MODULE * 1.1;
    const inner = root - 0.28;
    const hub = Math.max(0.42, pitch * 0.24);
    const bore = hub * 0.5;
    const spokes = gear.teeth > 16 ? 6 : gear.teeth > 10 ? 5 : 4;
    const size = gear.teeth / 22;

    const place = (i: number, angle: number, r: number, z: number) => {
      put(
        shape,
        i,
        [gear.x + Math.cos(angle) * r, gear.y + Math.sin(angle) * r, z],
        ((((angle - gear.phase) / TAU) % 1) + 1) % 1,
      );
      shape.turn.set([gear.x, gear.y, gear.speed], i * 3);
    };
    const face = () => (Math.random() < 0.5 ? -1 : 1) * (GEAR_DEPTH / 2) + soft() * 0.015;

    // One tooth's outline, as (fraction of a tooth from its centre, radius): root, flank, tip, flank, root.
    const outline: [number, number][] = [
      [-0.5, root],
      [-0.3, root],
      [-0.13, tip],
      [0.13, tip],
      [0.3, root],
      [0.5, root],
    ];
    const arc = TAU / gear.teeth;
    const lengths = outline
      .slice(1)
      .map(([d, r], k) => Math.hypot((d - outline[k][0]) * arc * pitch, r - outline[k][1]));
    const perimeter = lengths.reduce((sum, length) => sum + length, 0);

    return [
      [
        // The toothed rim: dots spread evenly along the outline, mostly on the two faces.
        9 * size,
        (i) => {
          let along = Math.random() * perimeter;
          let segment = 0;
          while (along > lengths[segment] && segment < lengths.length - 1) along -= lengths[segment++];
          const t = along / lengths[segment];
          const [d0, r0] = outline[segment];
          const [d1, r1] = outline[segment + 1];
          const tooth = Math.floor(Math.random() * gear.teeth);
          const angle = gear.phase + (tooth + d0 + (d1 - d0) * t) * arc;
          place(
            i,
            angle,
            r0 + (r1 - r0) * t + soft() * 0.012,
            Math.random() < 0.72 ? face() : between(-0.5, 0.5) * GEAR_DEPTH,
          );
        },
      ],
      [1.6 * size, (i) => place(i, Math.random() * TAU, inner + soft() * 0.02, face())],
      [
        2.4 * size,
        (i, k) => {
          const angle = gear.phase + (Math.floor(Math.random() * spokes) / spokes) * TAU;
          const r = between(hub, inner);
          // Offsetting sideways (not by angle) keeps the spoke the same width along its length.
          const side = soft() * 0.07 * (k % 3 === 0 ? 1 : 0.5);
          place(i, angle + Math.atan2(side, r), Math.hypot(r, side), face());
        },
      ],
      [
        1.5 * size + 0.4,
        (i, k) => {
          const r = k % 3 === 0 ? bore : k % 3 === 1 ? hub : between(bore, hub);
          place(i, Math.random() * TAU, r + soft() * 0.015, k % 3 === 2 ? face() : between(-0.6, 0.6) * GEAR_DEPTH);
        },
      ],
    ];
  });

  share(count, parts);
  shape.facing = [0, 0, 1];
  return shape;
}

/* ── storefront: a page in layers ────────────────────────────────────────────────────────── */

type Panel = {
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  kind: "frame" | "block" | "copy";
  weight: number;
};

function storefront(count: number): Shape {
  const shape = blank(count);
  const width = 9.2;
  const height = 5.8;
  const panels: Panel[] = [
    // The browser window, then what is on the page, each layer a little nearer.
    { x: 0, y: 0, w: width, h: height, z: -1.2, kind: "frame", weight: 3 },
    { x: 0, y: 2.62, w: width, h: 0.56, z: -0.65, kind: "block", weight: 1.6 },
    { x: -2.45, y: 1.0, w: 3.7, h: 2.1, z: 0.15, kind: "block", weight: 4 },
    { x: 1.95, y: 1.55, w: 4.3, h: 0.36, z: 0.55, kind: "copy", weight: 1 },
    { x: 1.65, y: 0.95, w: 3.7, h: 0.2, z: 0.55, kind: "copy", weight: 0.9 },
    { x: 1.3, y: 0.62, w: 3.0, h: 0.2, z: 0.55, kind: "copy", weight: 0.7 },
    { x: 0.62, y: 0.02, w: 1.65, h: 0.46, z: 1.05, kind: "block", weight: 1 },
  ];
  for (let row = 0; row < 2; row++) {
    for (let column = 0; column < 4; column++) {
      const x = -3.375 + column * 2.25;
      const y = -1.05 - row * 1.62;
      const z = 0.85 + (row * 4 + column) * 0.2;
      panels.push({ x, y: y + 0.24, w: 1.85, h: 0.92, z, kind: "block", weight: 1.3 });
      panels.push({ x: x - 0.12, y: y - 0.4, w: 1.55, h: 0.12, z, kind: "copy", weight: 0.3 });
    }
  }

  share(
    count,
    panels.map(({ x, y, w, h, z, kind, weight }): Part => [
      weight,
      (i) => {
        let px: number;
        let py: number;
        if (kind === "frame") {
          // A point somewhere along the rectangle's outline.
          let along = Math.random() * 2 * (w + h);
          if (along < w) [px, py] = [x - w / 2 + along, y + h / 2];
          else if ((along -= w) < h) [px, py] = [x + w / 2, y + h / 2 - along];
          else if ((along -= h) < w) [px, py] = [x + w / 2 - along, y - h / 2];
          else [px, py] = [x - w / 2, y - h / 2 + along - w];
        } else {
          px = x + between(-0.5, 0.5) * w;
          py = y + between(-0.5, 0.5) * h;
        }
        // The glow runs down the page, like a page loading.
        put(shape, i, [px, py, z + (kind === "block" ? between(-0.03, 0.03) : 0)], 1 - (py + height / 2) / height);
      },
    ]),
  );
  return shape;
}

/* ── systems: a hub, and the services that talk through it ───────────────────────────────── */

function systemsShape(count: number): Shape {
  const shape = blank(count);
  const reach = 5.2;
  const n = systems.nodes.length;
  const onRing = (angle: number): Vec3 => [Math.cos(angle) * reach, Math.sin(angle * 2) * 0.6, Math.sin(angle) * reach];
  const nodes = systems.nodes.map((_, index) => onRing((index / n) * TAU - Math.PI / 2));

  share(count, [
    [12, (i) => put(shape, i, inBall([0, 0, 0], 1.1), 0, n)],
    [28, (i, k) => put(shape, i, inBall(nodes[k % n], 0.55), 1, k % n)],
    [
      45,
      (i, k) => {
        // An arc from the hub up and over to a node; the glow travels out along it.
        const node = nodes[k % n];
        const t = Math.random();
        const over: Vec3 = [node[0] * 0.5, 2.2, node[2] * 0.5];
        const at = (axis: number) => 2 * (1 - t) * t * over[axis] + t * t * node[axis] + soft() * 0.04;
        put(shape, i, [at(0), at(1), at(2)], t);
      },
    ],
    [
      15,
      (i) => {
        const angle = Math.random() * TAU;
        put(shape, i, onRing(angle), angle / TAU);
      },
    ],
  ]);

  shape.labels.push({ ...systems.hub, pos: [0, 1.6, 0], anchor: [0, 0, 0], group: n });
  systems.nodes.forEach((node, index) => {
    const [x, y, z] = nodes[index];
    shape.labels.push({ ...node, pos: [x, y + 1, z], anchor: [x, y, z], group: index });
  });
  return shape;
}

/* ── years: a tunnel travelled along, one ring per role ──────────────────────────────────── */

/** Shared with the camera, which has to know how far to travel. */
export const TUNNEL = { start: 4, gap: 6, radius: 3, rings: years.length };

function tunnel(count: number): Shape {
  const shape = blank(count);
  const { start, gap, radius, rings } = TUNNEL;
  const length = gap * (rings - 1) + 8;
  const ringZ = years.map((_, index) => start - index * gap);

  share(count, [
    [
      70,
      (i, k) => {
        // Two spirals wound around the tunnel wall.
        const t = Math.random();
        const angle = t * TAU * 9 + (k % 2) * Math.PI;
        const r = radius + soft() * 0.08;
        put(shape, i, [Math.cos(angle) * r, Math.sin(angle) * r, start + 4 - t * length], t);
      },
    ],
    [
      30,
      (i, k) => {
        const ring = k % rings;
        const angle = Math.random() * TAU;
        const r = radius * 1.2 + soft() * 0.05;
        put(
          shape,
          i,
          [Math.cos(angle) * r, Math.sin(angle) * r, ringZ[ring]],
          (start + 4 - ringZ[ring]) / length,
          ring,
        );
      },
    ],
  ]);

  years.forEach((role, index) => {
    const at: Vec3 = [1.4, index % 2 ? 0.6 : -0.6, ringZ[index]];
    shape.labels.push({ ...role, pos: at, anchor: at, group: index });
  });
  return shape;
}

/* ── orbits: a sun, and a planet per storefront ──────────────────────────────────────────── */

function orbits(count: number): Shape {
  const shape = blank(count);
  const bodies = planets.map((planet, index) => {
    const orbit = 2.4 + index * 0.8;
    const angle = index * 2.2 + 0.6;
    const centre: Vec3 = [Math.cos(angle) * orbit, 0, Math.sin(angle) * orbit];
    return { planet, orbit, centre, size: 0.34 + (index % 2) * 0.12 };
  });
  const n = bodies.length;

  share(count, [
    [8, (i) => put(shape, i, inBall([0, 0, 0], 0.6), 0)],
    [
      50,
      (i, k) => {
        const { orbit } = bodies[k % n];
        const angle = Math.random() * TAU;
        put(shape, i, [Math.cos(angle) * orbit, soft() * 0.02, Math.sin(angle) * orbit], angle / TAU);
      },
    ],
    [
      42,
      (i, k) => {
        // Planets are shells, not solid balls: they read as spheres at this dot count.
        const { centre, size } = bodies[k % n];
        const d: Vec3 = [soft(), soft(), soft()];
        const length = Math.hypot(...d) || 1;
        put(
          shape,
          i,
          [centre[0] + (d[0] / length) * size, centre[1] + (d[1] / length) * size, centre[2] + (d[2] / length) * size],
          1,
          k % n,
        );
      },
    ],
  ]);

  bodies.forEach(({ planet, centre, size }, index) => {
    shape.labels.push({ ...planet, pos: [centre[0], centre[1] + size + 0.5, centre[2]], anchor: centre, group: index });
  });
  return shape;
}

/* ── products: one solid rounded tile per shipped feature ────────────────────────────────── */

function products(count: number): Shape {
  const shape = blank(count);
  const side = 2.7;
  const corner = 0.5;
  const flat = side - 2 * corner;
  const bend = (Math.PI / 2) * corner;
  const slots = tiles.map((tile, index) => {
    const x = (index - (tiles.length - 1) / 2) * 3.8;
    return { tile, x, y: index % 2 ? -0.35 : 0.35, z: -Math.abs(x) * 0.25 };
  });

  /** A point on the rounded square's outline, `t` of the way round. */
  const onEdge = (t: number): [number, number] => {
    let along = t * 4 * (flat + bend);
    for (let quarter = 0; quarter < 4; quarter++) {
      const turn = (quarter * Math.PI) / 2;
      const cos = Math.cos(turn);
      const sin = Math.sin(turn);
      if (along < flat) {
        const across = along - flat / 2;
        return [cos * (side / 2) - sin * across, sin * (side / 2) + cos * across];
      }
      along -= flat;
      if (along < bend) {
        const angle = turn + along / corner;
        const cx = ((cos - sin) * flat) / 2;
        const cy = ((sin + cos) * flat) / 2;
        return [cx + Math.cos(angle) * corner, cy + Math.sin(angle) * corner];
      }
      along -= bend;
    }
    return [side / 2, 0];
  };

  /** A point inside it: try again when one falls outside a rounded corner. */
  const inside = (): [number, number] => {
    for (;;) {
      const x = between(-side / 2, side / 2);
      const y = between(-side / 2, side / 2);
      const dx = Math.max(Math.abs(x) - flat / 2, 0);
      const dy = Math.max(Math.abs(y) - flat / 2, 0);
      if (dx * dx + dy * dy <= corner * corner) return [x, y];
    }
  };

  share(
    count,
    slots.flatMap(({ x, y, z }, index): Part[] => [
      [
        3,
        (i) => {
          const [px, py] = onEdge(Math.random());
          put(shape, i, [x + px, y + py, z], 1, index);
        },
      ],
      [
        9,
        (i) => {
          const [px, py] = inside();
          // The glow rises through the tile.
          put(shape, i, [x + px, y + py, z + between(-0.04, 0.04)], 0.5 + py / side, index);
        },
      ],
    ]),
  );

  slots.forEach(({ tile, x, y, z }, index) => {
    shape.labels.push({ ...tile, pos: [x, y + side / 2 + 0.55, z], anchor: [x, y, z], group: index });
  });
  return shape;
}

/* ── motto: one word, spelled in dots ────────────────────────────────────────────────────── */

const WORD_WIDTH = 9.5;

async function word(count: number): Promise<Shape> {
  const shape = blank(count);
  const { points, aspect } = await textPoints(mottoWord, count);
  // textPoints measures in word heights: scale so the word is WORD_WIDTH across.
  const scale = WORD_WIDTH / aspect;
  for (let i = 0; i < count; i++) {
    const x = points[i * 3] * scale;
    put(shape, i, [x, points[i * 3 + 1] * scale, between(-0.25, 0.25)], x / WORD_WIDTH + 0.5);
  }
  return shape;
}

/* ── portrait: the photo, bright areas nearer and bigger ─────────────────────────────────── */

export const PORTRAIT_HEIGHT = 9.5;
/** How far the brightest dots stand out from the picture plane. */
export const PORTRAIT_RELIEF = 0.9;

function portrait(count: number, image: HTMLImageElement): Shape {
  const shape = blank(count);
  // A sampling step that gives about as many opaque pixels as there are dots.
  const step = Math.max(2, Math.round(Math.sqrt((image.width * image.height * 0.45) / count)));
  const sample = samplePoints(image, step, { tone: liftShadows });
  if (!sample.count) return nebula(count);
  for (let i = 0; i < count; i++) {
    // Too many samples: take them evenly. Too few: the spare dots double up at random.
    const from =
      sample.count > count
        ? Math.floor((i * sample.count) / count)
        : i < sample.count
          ? i
          : Math.floor(Math.random() * sample.count);
    const lum = sample.lums[from];
    put(
      shape,
      i,
      [
        sample.positions[from * 3] * PORTRAIT_HEIGHT,
        sample.positions[from * 3 + 1] * PORTRAIT_HEIGHT,
        lum * PORTRAIT_RELIEF + between(-0.05, 0.05),
      ],
      lum,
    );
  }
  return shape;
}

/* ── portal: the way out ─────────────────────────────────────────────────────────────────── */

function portal(count: number): Shape {
  const shape = blank(count);
  share(count, [
    [
      80,
      (i) => {
        const angle = Math.random() * TAU;
        const r = 4.6 + soft() * 0.35;
        put(shape, i, [Math.cos(angle) * r, Math.sin(angle) * r, soft() * 0.35], angle / TAU);
      },
    ],
    [
      20,
      (i) => {
        // Dust drawn towards it.
        const angle = Math.random() * TAU;
        const r = 2 + Math.random() * 7;
        put(shape, i, [Math.cos(angle) * r, Math.sin(angle) * r, between(-6, 2)], Math.random());
      },
    ],
  ]);
  return shape;
}

/** Builds one chapter's shape. `image` is the portrait photo, or null if it could not be loaded. */
export async function buildShape(id: ChapterId, count: number, image: HTMLImageElement | null): Promise<Shape> {
  switch (id) {
    case "nebula":
      return nebula(count);
    case "globe":
      return globe(count);
    case "gears":
      return gears(count);
    case "storefront":
      return storefront(count);
    case "systems":
      return systemsShape(count);
    case "years":
      return tunnel(count);
    case "orbits":
      return orbits(count);
    case "products":
      return products(count);
    case "motto":
      return word(count).catch(() => portal(count));
    case "portrait":
      return image ? portrait(count, image) : nebula(count);
    case "portal":
      return portal(count);
  }
}
