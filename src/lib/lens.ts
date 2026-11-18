"use client";

/**
 * The hover lens: a circle that follows the cursor over a block of copy and shows a second
 * version of it inside. Only one lens is open at a time, and where it is on screen is shared
 * here so the particle cloud can pack its dots into the same circle (components/fx/ParticleMorph).
 */

export const lens = {
  /** Centre in viewport px, and current radius (0 while closed). */
  x: 0,
  y: 0,
  r: 0,
  /** The radius it opens to. */
  max: 1,
  owner: null as object | null,
};

const shut = new WeakSet<HTMLElement>();

/**
 * Called every frame by whichever block owns a lens. `x`/`y` are relative to `element`'s box
 * grown by `overhang` on every side (the lens may hang over the edge of the copy).
 * Also exposes the circle to CSS as --lens-x, --lens-y and --lens-r on `element`.
 */
export function publishLens(
  owner: object,
  element: HTMLElement,
  overhang: number,
  x: number,
  y: number,
  r: number,
  max: number,
) {
  const closed = r < 0.5;
  if (closed) {
    if (lens.owner === owner) lens.r = 0;
    if (shut.has(element)) return; // already written as closed: nothing to do until it opens
    shut.add(element);
  } else {
    shut.delete(element);
  }

  element.style.setProperty("--lens-x", `${(x - overhang).toFixed(1)}px`);
  element.style.setProperty("--lens-y", `${(y - overhang).toFixed(1)}px`);
  element.style.setProperty("--lens-r", closed ? "0px" : `${r.toFixed(1)}px`);
  if (closed) return;

  const box = element.getBoundingClientRect();
  lens.owner = owner;
  lens.x = box.left + x - overhang;
  lens.y = box.top + y - overhang;
  lens.r = r;
  lens.max = max;
}
