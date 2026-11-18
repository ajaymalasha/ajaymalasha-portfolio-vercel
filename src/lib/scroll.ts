"use client";

import Lenis from "lenis";
import { ticker, type Tick } from "./ticker";

/**
 * Smooth scrolling. One Lenis instance for the page, driven by the shared ticker so everything
 * that follows the scroll position sees the same value in the same frame.
 */

let lenis: Lenis | null = null;
let raf: Tick | null = null;
let holds = 0;

export function startScroll(): Lenis {
  if (lenis) return lenis;
  lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    autoRaf: false,
  });
  raf = (time) => lenis?.raf(time);
  ticker.add(raf, { first: true });
  return lenis;
}

export function stopScroll() {
  if (raf) ticker.remove(raf);
  lenis?.destroy();
  lenis = null;
  raf = null;
  holds = 0;
}

/** The page's Lenis instance. Created on first use, so it is safe to call from any effect. */
export const getLenis = (): Lenis => lenis ?? startScroll();

/** Freeze scrolling (menu open, page "broken"). Calls nest: each hold needs its own release. */
export function holdScroll() {
  if (holds++ === 0) getLenis().stop();
}

export function releaseScroll() {
  if (holds > 0 && --holds === 0) getLenis().start();
}

type ScrollTarget = number | string | HTMLElement;

/** Scroll to a position, an element, or a "#hash". `immediate` jumps without the glide. */
export function scrollToTarget(target: ScrollTarget, options: { duration?: number; immediate?: boolean; offset?: number } = {}) {
  const resolved = target === "#top" ? 0 : target;
  getLenis().scrollTo(resolved, { duration: 1.6, force: true, ...options });
}

/** Jump to the top with nothing easing behind it (used when the view changes). */
export function resetScroll() {
  getLenis().scrollTo(0, { immediate: true, force: true });
  window.scrollTo(0, 0);
}

type ScrollEvent = { scroll: number; limit: number; velocity: number; direction: number };

/** Subscribe to scroll updates. Returns the unsubscribe function. */
export function onScroll(listener: (event: ScrollEvent) => void): () => void {
  const instance = getLenis();
  const handler = (l: Lenis) =>
    listener({ scroll: l.scroll, limit: l.limit, velocity: l.velocity, direction: l.direction });
  instance.on("scroll", handler);
  return () => instance.off("scroll", handler);
}
