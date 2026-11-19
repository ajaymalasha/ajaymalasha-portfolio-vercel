"use client";

import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "@/lib/device";
import { ticker } from "@/lib/ticker";
import styles from "./DotFigures.module.css";

/** Dot pitch in px for numerals set at 100px; scales with the type. */
const PITCH_AT_100 = 5.5;
const DOT_FILL = 0.74; // dot diameter as a share of the pitch
const SPRING = 0.14;
const DAMPING = 0.74;
/** The cursor pushes dots away within this many px, this hard. */
const REACH = 70;
const PUSH = 9;
/** Each figure starts this much later than the one before it. */
const STAGGER = 0.06;
/** The last 40% of the scroll range is slack, so staggered figures still finish in time. */
const SLACK = 0.4;

/** Where the list's top edge is, in viewport heights, as the dots gather (from, to) and leave. */
const ARRIVE = [0.98, 0.66] as const;
const LEAVE = [0.22, -0.08] as const;
/** The dots have gathered once the list's bottom edge is this far (px) above the window's. */
const CLEARANCE = 48;
/** However short the window, gathering takes at least this much scrolling (in viewport heights). */
const SHORTEST_TRAVEL = 0.12;

type Dot = {
  /** Where it belongs, relative to the list. */
  tx: number;
  ty: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Which figure it is part of. */
  figure: number;
  size: number;
  /** Where it waits before arriving (below) and goes after leaving (above). */
  scatterX: number;
  below: number;
  above: number;
  seed: number;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const smooth = (value: number) => value * value * (3 - 2 * value);
const staggered = (progress: number, delay: number) => clamp01((progress - delay) / (1 - SLACK));

/**
 * Redraws the numerals of the list before it (`[data-dot-figures]`, each numeral marked
 * `[data-dot-figure]`) as grids of dots that fly in from below as the list scrolls into view,
 * scatter from the cursor, and fly off upwards as it leaves. The real numerals stay in the page,
 * transparent, for layout and for anyone not looking at the canvas. Not used with reduced motion.
 */
export function DotFigures() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = canvas.current;
    const list = element?.parentElement?.querySelector<HTMLElement>("[data-dot-figures]");
    if (!element || !list || prefersReducedMotion()) return;
    const context = element.getContext("2d");
    if (!context) return;

    let width = 0;
    let height = 0;
    let dots: Dot[] = [];
    let items: HTMLElement[] = [];
    let shown: number[] = [];
    let live = false;
    const pointer = { x: -9999, y: -9999 };

    /** Reads each numeral's shape off a hidden canvas and keeps one dot per filled grid point. */
    const build = () => {
      const box = list.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = box.width;
      height = box.height;
      // The canvas is three lists tall, so dots have room to wait below and leave above.
      element.width = width * ratio;
      element.height = height * 3 * ratio;
      element.style.top = `${-height}px`;
      element.style.height = `${height * 3}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, height * ratio);

      const numerals = [...list.querySelectorAll<HTMLElement>("[data-dot-figure]")];
      items = numerals.map((numeral) => numeral.closest("li") ?? numeral);
      shown = items.map(() => -1);
      dots = [];
      if (!numerals.length) return;
      const pitch = Math.max(3, Math.round((parseFloat(getComputedStyle(numerals[0]).fontSize) / 100) * PITCH_AT_100));

      numerals.forEach((numeral, figure) => {
        const text = numeral.firstChild;
        if (!(text instanceof Text)) return;
        const rect = numeral.getBoundingClientRect();
        const style = getComputedStyle(numeral);
        const margin = Math.ceil(parseFloat(style.fontSize) * 0.3);
        const sheet = document.createElement("canvas");
        sheet.width = Math.ceil(rect.width) + margin * 2;
        sheet.height = Math.ceil(rect.height) + margin * 2;
        const pen = sheet.getContext("2d", { willReadFrequently: true });
        if (!pen) return;
        pen.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        pen.textBaseline = "alphabetic";
        pen.fillStyle = "#000";
        const metrics = pen.measureText("0");
        const baseline =
          (rect.height - (metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent)) / 2 +
          metrics.fontBoundingBoxAscent;
        // Letter by letter at the browser's own positions, so tracking and kerning match the page.
        const range = document.createRange();
        for (let i = 0; i < text.length; i++) {
          range.setStart(text, i);
          range.setEnd(text, i + 1);
          const letter = range.getBoundingClientRect();
          pen.fillText(
            text.data[i],
            letter.left - Math.round(rect.left) + margin,
            baseline + (rect.top - Math.round(rect.top)) + margin,
          );
        }

        const { data } = pen.getImageData(0, 0, sheet.width, sheet.height);
        const left = Math.round(rect.left - box.left) - margin;
        const top = Math.round(rect.top - box.top) - margin;
        // Every figure samples the same list-wide grid, so the dots line up from one to the next.
        const startX = (pitch - (((left % pitch) + pitch) % pitch)) % pitch;
        const startY = (pitch - (((top % pitch) + pitch) % pitch)) % pitch;
        for (let y = startY; y < sheet.height; y += pitch) {
          for (let x = startX; x < sheet.width; x += pitch) {
            if (data[(y * sheet.width + x) * 4 + 3] < 128) continue;
            dots.push({
              tx: left + x,
              ty: top + y,
              x: left + x,
              y: top + y + height,
              vx: 0,
              vy: 0,
              figure,
              size: pitch * DOT_FILL,
              scatterX: Math.random() * width,
              below: height * (0.6 + Math.random() * 0.9),
              above: -height * (0.4 + Math.random() * 0.9),
              seed: Math.random(),
            });
          }
        }
      });
    };

    const draw = () => {
      const box = list.getBoundingClientRect();
      const viewport = window.innerHeight;
      if (box.bottom < -height || box.top > viewport * 1.2) return;
      const at = box.top / viewport;
      const leaving = at < LEAVE[0];
      // Gathered by the usual height, or as soon as the whole list is clear of the bottom edge if
      // that comes first: in a short window the list can come to rest lower than that height.
      const clear = (viewport - height - CLEARANCE) / viewport;
      const gathered = Math.max(ARRIVE[1], Math.min(clear, ARRIVE[0] - SHORTEST_TRAVEL));
      const arrive = clamp01((ARRIVE[0] - at) / (ARRIVE[0] - gathered));
      const leave = clamp01((at - LEAVE[1]) / (LEAVE[0] - LEAVE[1]));
      const count = items.length;

      items.forEach((item, i) => {
        const k = smooth(
          leaving ? staggered(leave, (count - 1 - i) * STAGGER * 0.5) : staggered(arrive, i * STAGGER + 0.08),
        );
        if (Math.abs(k - shown[i]) < 0.004) return;
        shown[i] = k;
        item.style.setProperty("--k", k.toFixed(3));
        item.style.setProperty("--away", leaving ? "-1" : "1");
      });

      const pointerX = pointer.x - box.left;
      const pointerY = pointer.y - box.top;
      context.clearRect(0, -height, width, height * 3);
      context.fillStyle = getComputedStyle(list).color;
      const path = new Path2D();
      for (const dot of dots) {
        const k = smooth(
          leaving
            ? staggered(leave, (count - 1 - dot.figure) * STAGGER * 0.5 + dot.seed * 0.08)
            : staggered(arrive, dot.figure * STAGGER + dot.seed * 0.08),
        );
        const awayY = leaving ? dot.above : dot.below;
        dot.vx += (dot.scatterX + (dot.tx - dot.scatterX) * k - dot.x) * SPRING;
        dot.vy += (awayY + (dot.ty - awayY) * k - dot.y) * SPRING;
        const dx = dot.x - pointerX;
        const dy = dot.y - pointerY;
        const distance = Math.hypot(dx, dy);
        if (distance < REACH && distance > 0.01) {
          const force = (1 - distance / REACH) ** 2 * PUSH;
          dot.vx += (dx / distance) * force;
          dot.vy += (dy / distance) * force;
        }
        dot.vx *= DAMPING;
        dot.vy *= DAMPING;
        dot.x += dot.vx;
        dot.y += dot.vy;
        if (k < 0.002) continue;
        const radius = (dot.size / 2) * (0.35 + 0.65 * k);
        path.moveTo(dot.x + radius * 2, dot.y + radius);
        path.arc(dot.x + radius, dot.y + radius, radius, 0, Math.PI * 2);
      }
      context.fill(path);
    };

    const onPointer = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
    };
    const onPointerGone = () => {
      pointer.x = pointer.y = -9999;
    };

    let cancelled = false;
    const sizes = new ResizeObserver(build);
    // The numerals are measured as set, so wait for the real typeface.
    void document.fonts.ready.then(() => {
      if (cancelled) return;
      live = true;
      build();
      list.dataset.dots = "on";
      sizes.observe(list);
      window.addEventListener("pointermove", onPointer, { passive: true });
      document.documentElement.addEventListener("pointerleave", onPointerGone);
      ticker.add(draw);
    });

    return () => {
      cancelled = true;
      if (!live) return;
      ticker.remove(draw);
      sizes.disconnect();
      window.removeEventListener("pointermove", onPointer);
      document.documentElement.removeEventListener("pointerleave", onPointerGone);
      delete list.dataset.dots;
      items.forEach((item) => {
        item.style.removeProperty("--k");
        item.style.removeProperty("--away");
      });
    };
  }, []);

  return <canvas ref={canvas} className={styles.canvas} aria-hidden="true" />;
}
