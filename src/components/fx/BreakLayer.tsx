"use client";

import { useEffect, useRef, useState } from "react";
import { motto } from "@/content/sections";
import { breakState } from "@/lib/experience";
import { holdScroll, releaseScroll } from "@/lib/scroll";
import { useStore } from "@/lib/store";
import { ticker } from "@/lib/ticker";
import "./BreakLayer.global.css";
import styles from "./BreakLayer.module.css";

/*
 * "Break it": the motto section's button takes the page at its word. Every piece of text on
 * screen comes loose and falls, piles up on the floor, and can be picked up and thrown, while
 * the page's "console" fills with errors. "Fix it" applies a patch and everything springs back
 * to where it was.
 *
 * Nothing is rebuilt: the real elements are moved with transforms and put back afterwards.
 */

/** What comes loose: text and controls, not layout boxes. Innermost matches only. */
const PIECES = [
  "nav a",
  "nav p",
  "nav button",
  "#motto .split-word",
  "#motto button",
  "[data-section-header] > *",
  "main h2",
  "main h3",
  "main p",
  "main li",
  "#contact h2",
  "#contact p",
].join(",");

/** Parts of the page that stay put: copies hidden inside a lens, and this layer's own controls. */
const FIXED = "[data-lens-layer], [data-break-ui], [data-dock], [data-dialog]";

const GRAVITY = 2600; // px/s²
const MAX_PIECES = 90;
const BOUNCE = 0.35;
const SHAKE_MS = 420;

type Piece = {
  element: HTMLElement;
  inline: boolean;
  width: number;
  height: number;
  home: { x: number; y: number };
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  /** Seconds before it lets go, so the page crumbles rather than drops as one. */
  delay: number;
  grabX: number;
  grabY: number;
};

function collect(): Piece[] {
  const height = window.innerHeight;
  const visible: HTMLElement[] = [];
  document.querySelectorAll<HTMLElement>(PIECES).forEach((element) => {
    if (element.closest(FIXED) || element.closest('[data-reveal]:not([data-reveal="in"])')) return;
    const box = element.getBoundingClientRect();
    if (!box.width || !box.height || box.bottom < 0 || box.top > height) return;
    if (getComputedStyle(element).visibility === "hidden") return;
    visible.push(element);
  });
  return visible
    .filter((element) => !visible.some((other) => other !== element && element.contains(other)))
    .slice(0, MAX_PIECES)
    .map((element) => {
      const box = element.getBoundingClientRect();
      return {
        element,
        inline: getComputedStyle(element).display === "inline",
        width: box.width,
        height: box.height,
        home: { x: box.left, y: box.top },
        x: box.left,
        y: box.top,
        vx: (Math.random() - 0.5) * 420,
        vy: -Math.random() * 500,
        angle: 0,
        spin: (Math.random() - 0.5) * 3,
        delay: Math.random() * 0.45,
        grabX: 0,
        grabY: 0,
      };
    });
}

export function BreakLayer() {
  const state = useStore(breakState, "idle");
  const [errors, setErrors] = useState<string[]>([]);
  const [fixable, setFixable] = useState(false);
  const [patch, setPatch] = useState<string[]>([]);
  const [fixed, setFixed] = useState(false);
  const pieces = useRef<Piece[]>([]);
  const fix = useRef<() => void>(() => {});

  useEffect(() => {
    if (state !== "broken") return;
    const root = document.documentElement;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (run: () => void, ms: number) => timers.push(setTimeout(run, ms));
    let held: Piece | null = null;
    let last = { x: 0, y: 0, time: 0 };
    let lastMs = performance.now();
    let running = false;

    const place = (piece: Piece) => {
      piece.element.style.transform = `translate3d(${(piece.x - piece.home.x).toFixed(1)}px, ${(piece.y - piece.home.y).toFixed(1)}px, 0) rotate(${piece.angle.toFixed(3)}rad)`;
    };

    const tick = (ms: number) => {
      const dt = Math.min(0.033, (ms - lastMs) / 1000);
      lastMs = ms;
      const floor = window.innerHeight;
      const wall = window.innerWidth;
      const all = pieces.current;

      for (const piece of all) {
        if (piece === held) continue;
        if (piece.delay > 0) {
          piece.delay -= dt;
          continue;
        }
        piece.vy += GRAVITY * dt;
        piece.x += piece.vx * dt;
        piece.y += piece.vy * dt;
        piece.angle += piece.spin * dt;
        if (piece.y < 0 && piece.vy < 0) piece.vy = 0;
        if (piece.y + piece.height > floor) {
          piece.y = floor - piece.height;
          piece.vy *= -BOUNCE;
          piece.vx *= 0.82;
          piece.spin *= 0.7;
          piece.angle *= 0.96; // it comes to rest lying flat
        }
        if (piece.x < 0) {
          piece.x = 0;
          piece.vx *= -BOUNCE;
        }
        if (piece.x + piece.width > wall) {
          piece.x = wall - piece.width;
          piece.vx *= -BOUNCE;
        }
      }

      // Pieces rest on each other: where two boxes overlap, the upper one is pushed clear.
      for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) {
          const a = all[i];
          const b = all[j];
          const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
          const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
          if (overlapX <= 0 || overlapY <= 0) continue;
          const upper = a.y < b.y ? a : b;
          const lower = upper === a ? b : a;
          if (upper === held) continue;
          if (overlapY < overlapX) {
            upper.y -= overlapY * 0.5;
            upper.vy = Math.min(upper.vy, 0) * 0.3;
            upper.vx *= 0.92;
          } else {
            const side = upper.x + upper.width / 2 < lower.x + lower.width / 2 ? -1 : 1;
            upper.x += side * overlapX * 0.5;
            upper.vx += side * 40;
          }
          upper.spin *= 0.9;
          upper.angle *= 0.97;
        }
      }
      all.forEach(place);
    };

    const pieceAt = (x: number, y: number) => {
      const all = pieces.current;
      for (let i = all.length - 1; i >= 0; i--) {
        const p = all[i];
        if (x >= p.x - 6 && x <= p.x + p.width + 6 && y >= p.y - 6 && y <= p.y + p.height + 6) return p;
      }
      return null;
    };
    const ownControl = (target: EventTarget | null) =>
      !!(target as Element | null)?.closest?.("[data-break-ui], [data-dock]");

    const onDown = (event: PointerEvent) => {
      if (ownControl(event.target)) return;
      held = pieceAt(event.clientX, event.clientY);
      if (!held) return;
      held.grabX = event.clientX - held.x;
      held.grabY = event.clientY - held.y;
      last = { x: event.clientX, y: event.clientY, time: performance.now() };
      event.preventDefault();
    };
    const onMove = (event: PointerEvent) => {
      if (!held) return;
      const time = performance.now();
      const dt = Math.max(0.008, (time - last.time) / 1000);
      held.vx = (event.clientX - last.x) / dt;
      held.vy = (event.clientY - last.y) / dt;
      last = { x: event.clientX, y: event.clientY, time };
      held.x = event.clientX - held.grabX;
      held.y = event.clientY - held.grabY;
    };
    const onUp = () => {
      if (!held) return;
      held.spin = (Math.random() - 0.5) * 8;
      held = null;
    };
    // While the page is in pieces its links and buttons are things to throw, not to press.
    const onClick = (event: MouseEvent) => {
      if (ownControl(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
    };
    const listen = (on: boolean) => {
      const change = on ? "addEventListener" : "removeEventListener";
      window[change]("pointerdown", onDown as EventListener, true);
      window[change]("pointermove", onMove as EventListener, { passive: true } as AddEventListenerOptions);
      window[change]("pointerup", onUp);
      window[change]("click", onClick as EventListener, true);
    };

    const stopPhysics = () => {
      if (!running) return;
      running = false;
      ticker.remove(tick);
      listen(false);
      held = null;
    };

    const restore = () => {
      for (const piece of pieces.current) {
        const style = piece.element.style;
        style.transition = style.transform = style.willChange = style.cursor = "";
        if (piece.inline) style.display = "";
      }
      pieces.current = [];
      setPatch([]);
      setFixed(false);
      root.classList.remove("is-breaking");
      releaseScroll();
      breakState.set("idle");
    };

    fix.current = () => {
      breakState.set("fixing");
      setFixable(false);
      setErrors([]);
      stopPhysics();
      motto.patch.forEach((line, i) => later(() => setPatch((lines) => [...lines, line]), i * 170));
      pieces.current.forEach((piece, i) => {
        piece.element.style.transition = `transform 1000ms var(--ease-spring) ${i * 9}ms`;
        piece.element.style.transform = "translate3d(0, 0, 0) rotate(0rad)";
      });
      later(() => setFixed(true), motto.patch.length * 170 + 150);
      later(restore, 2900);
    };

    // The page shudders, then lets go.
    holdScroll();
    root.classList.add("is-shaking");
    later(() => {
      root.classList.remove("is-shaking");
      root.classList.add("is-breaking");
      pieces.current = collect();
      for (const piece of pieces.current) {
        const style = piece.element.style;
        if (piece.inline) style.display = "inline-block"; // transforms do not apply to inline boxes
        style.transition = "none";
        style.willChange = "transform";
        style.cursor = "grab";
      }
      lastMs = performance.now();
      running = true;
      ticker.add(tick);
      listen(true);
      motto.errors.forEach((line, i) => later(() => setErrors((lines) => [...lines, line]), 150 + i * 420));
      later(() => setFixable(true), 1700);
    }, SHAKE_MS);

    return () => {
      // Only reached if the layer goes away mid-break (the view changed): leave the page whole.
      if (breakState.get() === "broken") {
        timers.forEach(clearTimeout);
        stopPhysics();
        root.classList.remove("is-shaking");
        restore();
      }
    };
    // The sequence starts when the state becomes "broken" and manages the rest itself.
  }, [state]);

  if (state === "idle" && !errors.length && !patch.length) return null;
  return (
    <div className={`${styles.layer} font-regular`} data-break-ui="" aria-live="polite">
      <ul className={styles.errors}>
        {errors.map((line) => (
          <li key={line} className={styles.error}>
            {line}
          </li>
        ))}
      </ul>
      {fixable ? (
        <button type="button" className={`btn-primary ${styles.fix}`} data-magnet="off" onClick={() => fix.current()}>
          <span>{motto.fixIt}</span>
        </button>
      ) : null}
      {patch.length ? (
        <div className={styles.patch}>
          <p className={styles.file}>{motto.patchFile}</p>
          {patch.map((line, i) => (
            <p key={i} className={line.startsWith("+") ? styles.added : styles.removed}>
              {line}
            </p>
          ))}
          {fixed ? <p className={styles.done}>{motto.fixed}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
