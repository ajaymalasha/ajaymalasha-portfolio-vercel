import type { Feature, ProcessStep, Service } from "@/content/sections";
import { COLORS } from "@/lib/particle-kit";

/**
 * What the dot stage draws. Each picture is painted on a small hidden canvas with ordinary 2D
 * drawing calls, then sampled: a dot lands more often where the paint is stronger, and takes
 * the colour of the paint it landed on. Two colours per picture: the page's foreground, and one
 * highlight. These are diagrams of how things work, not screenshots of any product.
 */

export const DRAW_WIDTH = 960;
export const DRAW_HEIGHT = 600;

export type Palette = { fg: string; accent: string };
type Pen = CanvasRenderingContext2D;
type Painter = (pen: Pen, palette: Palette) => void;

const MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace";
const TAU = Math.PI * 2;

/* ── Strokes shared by the pictures ──────────────────────────────────────────────────────── */

function path(pen: Pen, points: [number, number][], width = 5) {
  pen.lineWidth = width;
  pen.beginPath();
  points.forEach(([x, y], i) => (i ? pen.lineTo(x, y) : pen.moveTo(x, y)));
  pen.stroke();
}

/** A rounded outline, optionally with a faint wash inside it. */
function frame(pen: Pen, x: number, y: number, w: number, h: number, radius = 10, wash = 0) {
  pen.lineWidth = 5;
  pen.beginPath();
  pen.roundRect(x, y, w, h, radius);
  if (wash) {
    pen.save();
    pen.globalAlpha = wash;
    pen.fill();
    pen.restore();
  }
  pen.stroke();
}

function block(pen: Pen, x: number, y: number, w: number, h: number, radius = 6) {
  pen.beginPath();
  pen.roundRect(x, y, w, h, radius);
  pen.fill();
}

function disc(pen: Pen, x: number, y: number, r: number) {
  pen.beginPath();
  pen.arc(x, y, r, 0, TAU);
  pen.fill();
}

function ring(pen: Pen, x: number, y: number, r: number, width = 5) {
  pen.lineWidth = width;
  pen.beginPath();
  pen.arc(x, y, r, 0, TAU);
  pen.stroke();
}

function ink(pen: Pen, colour: string) {
  pen.strokeStyle = colour;
  pen.fillStyle = colour;
}

/** A browser window: outline, title bar, three lights. */
function browser(pen: Pen, x: number, y: number, w: number, h: number) {
  frame(pen, x, y, w, h, 16);
  path(pen, [
    [x, y + 44],
    [x + w, y + 44],
  ]);
  for (const i of [0, 1, 2]) disc(pen, x + 28 + i * 24, y + 22, 6);
}

/** A product card: outline with two lines of "text" at its foot. */
function card(pen: Pen, x: number, y: number, w: number, h: number) {
  frame(pen, x, y, w, h, 12);
  block(pen, x + 16, y + h - 56, w * 0.6, 12, 4);
  block(pen, x + 16, y + h - 32, w * 0.36, 12, 4);
}

/** A four-point sparkle. */
function sparkle(pen: Pen, x: number, y: number, r: number) {
  pen.beginPath();
  for (let i = 0; i < 8; i++) {
    const reach = i % 2 ? r * 0.26 : r;
    const angle = (i / 8) * TAU - Math.PI / 2;
    const px = x + Math.cos(angle) * reach;
    const py = y + Math.sin(angle) * reach;
    if (i) pen.lineTo(px, py);
    else pen.moveTo(px, py);
  }
  pen.closePath();
  pen.fill();
}

function label(pen: Pen, text: string, x: number, y: number, size = 32, align: CanvasTextAlign = "center") {
  pen.font = `700 ${size}px ${getComputedStyle(document.documentElement).getPropertyValue("--font-geist") || "sans-serif"}, sans-serif`;
  pen.textAlign = align;
  pen.textBaseline = "middle";
  pen.fillText(text, x, y);
}

/** A tick, cut out of whatever is already painted there. */
function cutTick(pen: Pen, x: number, y: number, size: number) {
  pen.save();
  pen.globalCompositeOperation = "destination-out";
  pen.lineCap = "round";
  path(
    pen,
    [
      [x - size * 0.5, y + size * 0.03],
      [x - size * 0.14, y + size * 0.4],
      [x + size * 0.54, y - size * 0.4],
    ],
    size * 0.23,
  );
  pen.restore();
}

/** A hub in the middle and six named things around it, each joined to the hub. */
function hub(pen: Pen, names: string[], { fg, accent }: Palette) {
  const cx = DRAW_WIDTH / 2;
  const cy = DRAW_HEIGHT / 2;
  const places: [number, number][] = [
    [170, 105],
    [790, 105],
    [130, 300],
    [830, 300],
    [170, 495],
    [790, 495],
  ];
  ink(pen, accent);
  for (const [x, y] of places)
    path(
      pen,
      [
        [cx, cy],
        [x, y],
      ],
      5,
    );
  names.forEach((name, i) => {
    const [x, y] = places[i];
    // Clear the line under the pill, so the name reads.
    pen.globalCompositeOperation = "destination-out";
    block(pen, x - 100, y - 38, 200, 76, 38);
    pen.globalCompositeOperation = "source-over";
    ink(pen, fg);
    frame(pen, x - 100, y - 38, 200, 76, 38);
    label(pen, name, x, y + 2, 30);
  });
  ink(pen, accent);
  disc(pen, cx, cy, 70);
}

/* ── (02) What I do ──────────────────────────────────────────────────────────────────────── */

const servicePainters: Record<Service["id"], Painter> = {
  /** A page that writes itself: some blocks are there, some still dashed, with a sparkle over it. */
  ai(pen, { fg, accent }) {
    browser(pen, 110, 60, 600, 480);
    block(pen, 145, 135, 250, 24);
    block(pen, 145, 175, 170, 24);
    ink(pen, accent);
    block(pen, 145, 225, 130, 44, 22);
    ink(pen, fg);
    card(pen, 145, 300, 160, 200);
    pen.setLineDash([14, 12]);
    frame(pen, 330, 300, 160, 200, 12);
    frame(pen, 515, 300, 160, 200, 12);
    frame(pen, 440, 120, 235, 150, 12);
    pen.setLineDash([]);
    ink(pen, accent);
    sparkle(pen, 770, 190, 120);
    sparkle(pen, 870, 330, 46);
    sparkle(pen, 660, 70, 34);
  },

  /** A storefront: banner, four products, a bag. */
  shopify(pen, { fg, accent }) {
    browser(pen, 90, 30, 780, 540);
    ink(pen, accent);
    frame(pen, 120, 96, 720, 168, 12);
    block(pen, 150, 148, 300, 22);
    block(pen, 150, 186, 180, 22);
    // The bag.
    frame(pen, 690, 150, 96, 86, 10);
    pen.lineWidth = 5;
    pen.beginPath();
    pen.arc(738, 150, 24, Math.PI, TAU);
    pen.stroke();
    ink(pen, fg);
    for (const i of [0, 1, 2, 3]) card(pen, 120 + i * 184, 290, 168, 250);
  },

  /** A design, selected and being placed: one component picked out, handles on its corners, a cursor. */
  frontend(pen, { fg, accent }) {
    frame(pen, 90, 50, 780, 500, 14);
    for (let i = 0; i < 6; i++) {
      const x = 125 + (i % 3) * 245;
      const y = 90 + Math.floor(i / 3) * 225;
      if (i === 4) {
        ink(pen, accent);
        block(pen, x, y, 220, 195, 12);
        ink(pen, fg);
        for (const [hx, hy] of [
          [x, y],
          [x + 220, y],
          [x, y + 195],
          [x + 220, y + 195],
        ]) {
          pen.fillRect(hx - 11, hy - 11, 22, 22);
        }
      } else {
        card(pen, x, y, 220, 195);
      }
    }
    // The cursor.
    pen.beginPath();
    pen.moveTo(540, 430);
    pen.lineTo(540, 530);
    pen.lineTo(566, 506);
    pen.lineTo(590, 556);
    pen.lineTo(610, 546);
    pen.lineTo(587, 498);
    pen.lineTo(622, 496);
    pen.closePath();
    pen.fill();
  },

  /** Three layers, one above the other: interface, API, database. */
  fullstack(pen, { fg, accent }) {
    const layers: [number, string, boolean][] = [
      [430, "DATA", false],
      [300, "API", true],
      [170, "UI", false],
    ];
    for (const [y, name, highlighted] of layers) {
      ink(pen, highlighted ? accent : fg);
      pen.lineWidth = highlighted ? 9 : 5;
      pen.beginPath();
      pen.moveTo(400, y - 105);
      pen.lineTo(720, y);
      pen.lineTo(400, y + 105);
      pen.lineTo(80, y);
      pen.closePath();
      pen.stroke();
      label(pen, name, 760, y, 34, "left");
    }
    ink(pen, fg);
    for (const x of [80, 720])
      path(
        pen,
        [
          [x, 170],
          [x, 430],
        ],
        3,
      );
  },

  integrations(pen, palette) {
    hub(pen, ["Shopify", "Meta ads", "Gorgias", "NetSuite", "Celigo", "CSV"], palette);
  },

  /** A dial, nearly at the top of its range. */
  performance(pen, { fg, accent }) {
    const cx = DRAW_WIDTH / 2;
    const cy = 440;
    pen.lineCap = "round";
    ink(pen, fg);
    pen.lineWidth = 26;
    pen.globalAlpha = 0.25;
    pen.beginPath();
    pen.arc(cx, cy, 300, Math.PI, TAU);
    pen.stroke();
    pen.globalAlpha = 1;
    ink(pen, accent);
    pen.beginPath();
    pen.arc(cx, cy, 300, Math.PI, Math.PI * 1.9);
    pen.stroke();
    ink(pen, fg);
    const needle = Math.PI * 1.88;
    path(
      pen,
      [
        [cx, cy],
        [cx + Math.cos(needle) * 245, cy + Math.sin(needle) * 245],
      ],
      10,
    );
    disc(pen, cx, cy, 26);
    pen.lineCap = "butt";
    for (let i = 0; i <= 10; i++) {
      const angle = Math.PI + (i / 10) * Math.PI;
      path(
        pen,
        [
          [cx + Math.cos(angle) * 336, cy + Math.sin(angle) * 336],
          [cx + Math.cos(angle) * 362, cy + Math.sin(angle) * 362],
        ],
        4,
      );
    }
  },
};

/* ── How the work ships ──────────────────────────────────────────────────────────────────── */

const processPainters: Record<ProcessStep["id"], Painter> = {
  /** Two sides of a conversation. */
  listen(pen, { fg, accent }) {
    const bubbles: [number, number, number, boolean][] = [
      [90, 70, 520, false],
      [350, 215, 520, true],
      [90, 360, 600, false],
    ];
    for (const [x, y, w, mine] of bubbles) {
      ink(pen, mine ? accent : fg);
      frame(pen, x, y, w, 110, 44);
      block(pen, x + 44, y + 36, w * 0.6, 12, 5);
      block(pen, x + 44, y + 62, w * 0.36, 12, 5);
    }
    // A voice, as a few bars.
    ink(pen, accent);
    for (let i = 0; i < 9; i++) {
      const h = 18 + Math.abs(Math.sin(i * 1.3)) * 62;
      block(pen, 730 + i * 16, 540 - h, 9, h, 4);
    }
  },

  /** Three tables and how they refer to each other. */
  model(pen, { fg, accent }) {
    const table = (x: number, y: number, rows: number, highlighted: boolean) => {
      ink(pen, highlighted ? accent : fg);
      frame(pen, x, y, 250, 64 + rows * 44, 12);
      block(pen, x, y, 250, 52, 12);
      ink(pen, fg);
      for (let r = 0; r < rows; r++) {
        disc(pen, x + 28, y + 86 + r * 44, 7);
        block(pen, x + 50, y + 80 + r * 44, 110 + ((r * 37) % 60), 12, 5);
      }
    };
    ink(pen, fg);
    path(
      pen,
      [
        [340, 176],
        [400, 176],
        [400, 130],
        [460, 130],
      ],
      4,
    );
    path(
      pen,
      [
        [340, 220],
        [400, 220],
        [400, 420],
        [620, 420],
      ],
      4,
    );
    path(
      pen,
      [
        [710, 262],
        [710, 330],
        [745, 330],
        [745, 355],
      ],
      4,
    );
    table(90, 110, 4, false);
    table(460, 70, 3, true);
    table(620, 355, 3, false);
  },

  /** A few lines of TypeScript. */
  build(pen, { fg, accent }) {
    const lines: [string, string][] = [
      ["export async function page(ad: MetaAd) {", accent],
      ["  const spec = await plan(ad)", fg],
      ["  assertGrounded(spec, catalog)", fg],
      ["  return publish(spec)", fg],
      ["}", accent],
    ];
    pen.font = `bold 37px ${MONO}`;
    pen.textBaseline = "middle";
    pen.textAlign = "left";
    lines.forEach(([text, colour], i) => {
      pen.fillStyle = colour;
      pen.fillText(text, 40, 150 + i * 76);
    });
  },

  /** A pull request: lines out, lines in, and the checks that passed. */
  review(pen, { fg, accent }) {
    frame(pen, 90, 60, 560, 480, 16);
    path(pen, [
      [90, 120],
      [650, 120],
    ]);
    block(pen, 120, 84, 200, 14, 5);
    const rows: [boolean, number][] = [
      [false, 330],
      [true, 420],
      [true, 280],
      [false, 240],
      [true, 380],
      [true, 300],
    ];
    rows.forEach(([added, w], i) => {
      const y = 160 + i * 60;
      ink(pen, added ? accent : fg);
      pen.globalAlpha = added ? 1 : 0.45;
      block(pen, 124, y + 12, 22, 8, 3);
      if (added) block(pen, 131, y + 5, 8, 22, 3);
      block(pen, 170, y + 8, w, 16, 6);
      pen.globalAlpha = 1;
    });
    // Checks.
    [150, 300, 450].forEach((y) => {
      pen.fillStyle = COLORS.live;
      disc(pen, 790, y, 50);
      cutTick(pen, 790, y, 50);
    });
    ink(pen, fg);
    path(
      pen,
      [
        [790, 200],
        [790, 250],
      ],
      4,
    );
    path(
      pen,
      [
        [790, 350],
        [790, 400],
      ],
      4,
    );
  },

  /** A page, live. */
  ship(pen, { fg, accent }) {
    browser(pen, 90, 30, 780, 540);
    ink(pen, accent);
    frame(pen, 120, 96, 720, 168, 12);
    block(pen, 150, 148, 300, 22);
    block(pen, 150, 186, 180, 22);
    ink(pen, fg);
    for (const i of [0, 1, 2]) card(pen, 120 + i * 245, 290, 230, 250);
    pen.fillStyle = COLORS.live;
    disc(pen, 760, 180, 70);
    cutTick(pen, 760, 180, 62);
  },

  /** A pulse, watched. */
  watch(pen, { accent }) {
    ink(pen, accent);
    pen.lineJoin = "round";
    const beat = (x: number): [number, number][] => [
      [x, 300],
      [x + 50, 300],
      [x + 72, 252],
      [x + 96, 300],
      [x + 120, 300],
      [x + 142, 338],
      [x + 172, 112],
      [x + 206, 468],
      [x + 232, 300],
      [x + 290, 300],
    ];
    path(pen, [[40, 300], ...beat(70), ...beat(360), ...beat(650).slice(0, 8)], 11);
    pen.fillStyle = COLORS.live;
    disc(pen, 884, 300, 24);
  },
};

/* ── (04) Now building: what goes in, then what comes out ────────────────────────────────── */

const featurePainters: Record<Feature["id"], [Painter, Painter]> = {
  landing: [
    /** An ad as it appears in a feed. */
    (pen, { fg, accent }) => {
      frame(pen, 270, 30, 420, 540, 18);
      disc(pen, 318, 82, 24);
      block(pen, 358, 66, 150, 12, 5);
      block(pen, 358, 88, 90, 10, 5);
      ink(pen, accent);
      block(pen, 290, 130, 380, 260, 10);
      ink(pen, fg);
      // A picture's mountain and sun, cut from the block.
      pen.globalCompositeOperation = "destination-out";
      pen.beginPath();
      pen.moveTo(320, 370);
      pen.lineTo(440, 220);
      pen.lineTo(520, 310);
      pen.lineTo(570, 260);
      pen.lineTo(645, 370);
      pen.closePath();
      pen.fill();
      disc(pen, 600, 185, 26);
      pen.globalCompositeOperation = "source-over";
      block(pen, 290, 416, 270, 14, 5);
      block(pen, 290, 444, 190, 14, 5);
      frame(pen, 290, 488, 380, 56, 28);
      block(pen, 420, 509, 120, 14, 5);
    },
    /** The page generated from it. */
    (pen, { fg, accent }) => {
      browser(pen, 90, 30, 780, 540);
      block(pen, 130, 110, 330, 26);
      block(pen, 130, 150, 250, 26);
      block(pen, 130, 196, 190, 12, 5);
      ink(pen, accent);
      block(pen, 130, 232, 150, 46, 23);
      block(pen, 560, 96, 280, 190, 12);
      ink(pen, fg);
      for (const i of [0, 1, 2, 3]) card(pen, 120 + i * 184, 316, 168, 224);
    },
  ],
  figma: [
    /** A design on the canvas: a frame, its layers, a curve with handles. */
    (pen, { fg, accent }) => {
      pen.globalAlpha = 0.2;
      for (let x = 60; x <= 900; x += 60)
        path(
          pen,
          [
            [x, 30],
            [x, 570],
          ],
          2,
        );
      for (let y = 30; y <= 570; y += 60)
        path(
          pen,
          [
            [60, y],
            [900, y],
          ],
          2,
        );
      pen.globalAlpha = 1;
      ink(pen, accent);
      frame(pen, 180, 90, 600, 420, 4);
      for (const [x, y] of [
        [180, 90],
        [780, 90],
        [180, 510],
        [780, 510],
      ]) {
        pen.fillRect(x - 12, y - 12, 24, 24);
      }
      ink(pen, fg);
      block(pen, 220, 130, 240, 26);
      block(pen, 220, 172, 160, 26);
      frame(pen, 520, 130, 220, 150, 10);
      for (const i of [0, 1, 2]) frame(pen, 220 + i * 180, 320, 160, 150, 10);
      label(pen, "Frame 1", 180, 62, 26, "left");
    },
    /** The same design, rebuilt for a wide screen and a phone. */
    (pen, { fg, accent }) => {
      browser(pen, 60, 60, 600, 480);
      block(pen, 95, 136, 230, 22);
      block(pen, 95, 172, 150, 22);
      ink(pen, accent);
      block(pen, 420, 120, 205, 130, 10);
      ink(pen, fg);
      for (const i of [0, 1, 2]) card(pen, 95 + i * 180, 290, 164, 210);
      // The phone.
      frame(pen, 720, 110, 190, 400, 30);
      block(pen, 790, 128, 50, 10, 5);
      block(pen, 745, 170, 120, 16, 5);
      block(pen, 745, 198, 80, 16, 5);
      ink(pen, accent);
      block(pen, 745, 236, 140, 96, 10);
      ink(pen, fg);
      frame(pen, 745, 352, 140, 130, 10);
    },
  ],
  quiz: [
    /** A question and its answers, one of them chosen. */
    (pen, { fg, accent }) => {
      frame(pen, 180, 40, 600, 520, 18);
      block(pen, 230, 96, 360, 24);
      block(pen, 230, 134, 240, 24);
      [0, 1, 2].forEach((i) => {
        const y = 200 + i * 96;
        const chosen = i === 1;
        ink(pen, chosen ? accent : fg);
        frame(pen, 230, y, 500, 72, 36, chosen ? 0.18 : 0);
        ring(pen, 272, y + 36, 15);
        if (chosen) disc(pen, 272, y + 36, 8);
        ink(pen, fg);
        block(pen, 310, y + 29, 200 + i * 50, 14, 5);
      });
      for (const i of [0, 1, 2, 3]) {
        pen.globalAlpha = i === 1 ? 1 : 0.35;
        disc(pen, 440 + i * 28, 520, 7);
      }
      pen.globalAlpha = 1;
    },
    /** The product it recommends, ready to add to the cart. */
    (pen, { fg, accent }) => {
      frame(pen, 250, 30, 460, 540, 18);
      frame(pen, 290, 70, 380, 230, 12, 0.15);
      // A bottle, for a product.
      block(pen, 448, 150, 64, 120, 14);
      block(pen, 464, 112, 32, 44, 6);
      block(pen, 290, 330, 260, 20);
      block(pen, 290, 364, 170, 16, 5);
      block(pen, 290, 402, 90, 22);
      ink(pen, accent);
      block(pen, 290, 462, 380, 68, 34);
      ink(pen, fg);
      pen.globalCompositeOperation = "destination-out";
      block(pen, 400, 489, 160, 14, 5);
      pen.globalCompositeOperation = "source-over";
      pen.fillStyle = COLORS.live;
      disc(pen, 700, 50, 46);
      cutTick(pen, 700, 50, 44);
    },
  ],
};

/* ── Painting and sampling ───────────────────────────────────────────────────────────────── */

function paint(painter: Painter, palette: Palette): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = DRAW_WIDTH;
  canvas.height = DRAW_HEIGHT;
  const pen = canvas.getContext("2d", { willReadFrequently: true })!;
  pen.strokeStyle = palette.fg;
  pen.fillStyle = palette.fg;
  pen.lineJoin = "round";
  painter(pen, palette);
  return canvas;
}

export type Picture = {
  /** x, y per dot, 0..1 across the picture. */
  to: Float32Array;
  /** r, g, b per dot, 0..1. */
  color: Float32Array;
};

// `count` dots, each somewhere on the paint: a random pixel is kept with a chance equal to
// how opaque it is, so heavy strokes gather more dots than faint washes.
function sample(canvas: HTMLCanvasElement, count: number): Picture {
  const { width, height } = canvas;
  const { data } = canvas.getContext("2d")!.getImageData(0, 0, width, height);
  const to = new Float32Array(count * 2);
  const color = new Float32Array(count * 3);
  let placed = 0;
  let tries = 0;
  const limit = count * 400;
  while (placed < count && tries++ < limit) {
    const x = Math.floor(Math.random() * width);
    const y = Math.floor(Math.random() * height);
    const i = (y * width + x) * 4;
    if (Math.random() * 255 >= data[i + 3]) continue;
    to[placed * 2] = (x + Math.random()) / width;
    to[placed * 2 + 1] = (y + Math.random()) / height;
    for (let c = 0; c < 3; c++) color[placed * 3 + c] = data[i + c] / 255;
    placed++;
  }
  return { to, color };
}

export const drawService = (id: Service["id"], palette: Palette, count: number) =>
  sample(paint(servicePainters[id], palette), count);

export const drawStep = (id: ProcessStep["id"], palette: Palette, count: number) =>
  sample(paint(processPainters[id], palette), count);

export const drawFeature = (id: Feature["id"], palette: Palette, count: number): [Picture, Picture] => {
  const [input, output] = featurePainters[id];
  return [sample(paint(input, palette), count), sample(paint(output, palette), count)];
};
