"use client";

import { useEffect, useRef } from "react";

/**
 * One animation loop for the whole page. Everything that draws per frame (smooth scrolling, the
 * particle canvases, the cursor, marquees) adds a callback here instead of starting its own
 * requestAnimationFrame, so there is a single frame, in a known order, and it stops by itself
 * when nothing is listening.
 */

export type Tick = (time: number) => void;

const early = new Set<Tick>();
const late = new Set<Tick>();
let frame = 0;

/** Values read once per frame and shared, so callbacks do not each force a layout to read them. */
export const now = { scrollY: 0, time: 0 };

function run(time: number) {
  now.scrollY = window.scrollY;
  now.time = time;
  early.forEach((tick) => tick(time));
  late.forEach((tick) => tick(time));
  frame = requestAnimationFrame(run);
}

export const ticker = {
  /** `first` puts the callback ahead of the rest: used by smooth scrolling, so others see its result. */
  add(tick: Tick, { first = false } = {}) {
    (first ? early : late).add(tick);
    if (!frame) {
      now.scrollY = window.scrollY;
      frame = requestAnimationFrame(run);
    }
  },
  remove(tick: Tick) {
    early.delete(tick);
    late.delete(tick);
    if (!early.size && !late.size && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  },
};

/**
 * Runs `tick` every frame while the component is mounted (and `active`). The latest function is
 * always the one called, so it can read fresh props and state without being re-added.
 */
export function useTicker(tick: Tick, active = true) {
  const latest = useRef(tick);
  useEffect(() => {
    latest.current = tick;
  });
  useEffect(() => {
    if (!active) return;
    const call: Tick = (time) => latest.current(time);
    ticker.add(call);
    return () => ticker.remove(call);
  }, [active]);
}
