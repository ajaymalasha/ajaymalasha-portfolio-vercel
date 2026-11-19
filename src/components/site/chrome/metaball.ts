/**
 * The outline of the "neck" that joins two circles when they are close, as in a metaball: two
 * curves that leave each circle at a tangent and pinch in between. Drawn in the same colour as
 * the circles, it makes them read as one stretching drop.
 */

type Circles = { x1: number; y1: number; r1: number; x2: number; y2: number; r2: number };

const HALF_PI = Math.PI / 2;

const onCircle = (cx: number, cy: number, angle: number, radius: number): [number, number] => [
  cx + radius * Math.cos(angle),
  cy + radius * Math.sin(angle),
];

const write = (point: [number, number]) => `${point[0].toFixed(1)} ${point[1].toFixed(1)}`;

/**
 * `spread` (0 to about 0.55) is how wide the neck grips each circle: 0 is a thread between the
 * nearest points, larger values reach round towards the outer tangents. Returns "" when the
 * circles are too far apart to join, or one is inside the other.
 */
export function bridgePath({ x1, y1, r1, x2, y2, r2 }: Circles, spread: number): string {
  const distance = Math.hypot(x2 - x1, y2 - y1);
  if (distance > r1 + r2 * 2.5 || distance <= Math.abs(r1 - r2)) return "";

  // Where the circles cross, if they overlap: the neck must start outside that.
  const overlapping = distance < r1 + r2;
  const cross1 = overlapping ? Math.acos((r1 * r1 + distance * distance - r2 * r2) / (2 * r1 * distance)) : 0;
  const cross2 = overlapping ? Math.acos((r2 * r2 + distance * distance - r1 * r1) / (2 * r2 * distance)) : 0;

  const heading = Math.atan2(y2 - y1, x2 - x1);
  const tangent = Math.acos((r1 - r2) / distance);

  const a1 = heading + cross1 + (tangent - cross1) * spread;
  const a2 = heading - cross1 - (tangent - cross1) * spread;
  const b1 = heading + Math.PI - cross2 - (Math.PI - cross2 - tangent) * spread;
  const b2 = heading - Math.PI + cross2 + (Math.PI - cross2 - tangent) * spread;

  const startTop = onCircle(x1, y1, a1, r1);
  const startBottom = onCircle(x1, y1, a2, r1);
  const endTop = onCircle(x2, y2, b1, r2);
  const endBottom = onCircle(x2, y2, b2, r2);

  // Handle length: longer for a wider grip, shorter as the circles close in on each other.
  const total = r1 + r2;
  const span = Math.hypot(endTop[0] - startTop[0], endTop[1] - startTop[1]);
  const handle = Math.min(spread * 2.4, span / total) * Math.min(1, (distance * 2) / total);

  const h1 = onCircle(startTop[0], startTop[1], a1 - HALF_PI, r1 * handle);
  const h2 = onCircle(endTop[0], endTop[1], b1 + HALF_PI, r2 * handle);
  const h3 = onCircle(endBottom[0], endBottom[1], b2 - HALF_PI, r2 * handle);
  const h4 = onCircle(startBottom[0], startBottom[1], a2 + HALF_PI, r1 * handle);

  return `M ${write(startTop)} C ${write(h1)} ${write(h2)} ${write(endTop)} L ${write(endBottom)} C ${write(h3)} ${write(h4)} ${write(startBottom)} Z`;
}
