"use client";

import { canHover, prefersReducedMotion } from "./device";
import { ticker } from "./ticker";

/**
 * The small motions every section shares, driven by attributes so components stay declarative:
 *
 *   data-reveal            rises into place the first time it is 15% on screen
 *                          (delay it with style={{ "--reveal-delay": "80ms" }})
 *   data-split             set by <Split>: its words rise out of their masks when seen;
 *                          data-split-on="load" waits for the page to be ready instead
 *   data-scramble          set by <Scramble>: the text settles out of random glyphs
 *   class="fill"           a disc floods the control from where the cursor entered
 *   data-magnetic="0.3"    the element leans towards the cursor while it is over it
 *   data-proximity         set by <Split proximity>: letters lift as the cursor passes
 *
 * Buttons and icon buttons (.btn-primary, .fill, .btn-icon, [data-magnet]) also get a gentle
 * pull towards the cursor without asking; data-magnet="off" opts one out.
 *
 * `initMotion()` is called once by the app shell. Elements added later are picked up by a
 * mutation observer, so sections never register anything themselves.
 */

type Run = () => void;

/* ── Seen once ───────────────────────────────────────────────────────────────────────────── */

type Watcher = { observer: IntersectionObserver; runs: WeakMap<Element, Run> };
const watchers = new Map<string, Watcher>();

/** Calls `run` the first time `element` is on screen by `threshold`. Returns a cancel function. */
export function whenSeen(element: Element, run: Run, { threshold = 0.2, rootMargin = "0px" } = {}): Run {
  const key = `${threshold} ${rootMargin}`;
  let watcher = watchers.get(key);
  if (!watcher) {
    const runs = new WeakMap<Element, Run>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.unobserve(entry.target);
          runs.get(entry.target)?.();
          runs.delete(entry.target);
        }
      },
      { threshold, rootMargin },
    );
    watcher = { observer, runs };
    watchers.set(key, watcher);
  }
  watcher.runs.set(element, run);
  watcher.observer.observe(element);
  const { observer, runs } = watcher;
  return () => {
    observer.unobserve(element);
    runs.delete(element);
  };
}

/** Calls `run` once the page is ready to be seen (the entry screen has lifted, or there was none). */
export function whenLoaded(run: Run): Run {
  if (document.documentElement.classList.contains("is-loaded")) {
    run();
    return () => {};
  }
  window.addEventListener("app:loaded", run, { once: true });
  return () => window.removeEventListener("app:loaded", run);
}

const adopted = new WeakSet<Element>();

function adopt(element: HTMLElement) {
  if (adopted.has(element)) return;
  adopted.add(element);

  if (element.hasAttribute("data-reveal") && element.dataset.reveal !== "in") {
    whenSeen(element, () => (element.dataset.reveal = "in"), { threshold: 0.15, rootMargin: "0px 0px -5% 0px" });
  }
  if (element.hasAttribute("data-split") && element.dataset.split !== "in") {
    const show = () => (element.dataset.split = "in");
    if (element.dataset.splitOn === "load") whenLoaded(() => requestAnimationFrame(show));
    else whenSeen(element, show);
  }
}

const SEEN = "[data-reveal], [data-split]";

function adoptAll(root: ParentNode) {
  if (root instanceof HTMLElement && root.matches(SEEN)) adopt(root);
  root.querySelectorAll<HTMLElement>(SEEN).forEach(adopt);
}

/* ── Scramble ────────────────────────────────────────────────────────────────────────────── */

const GLYPHS = "</>{}[]=+*#_-01";
const SCRAMBLE_STEP = 28; // ms per step

/**
 * Settles `node`'s text out of random glyphs, left to right. Works on the text node itself, so
 * the element React rendered is never replaced. Returns a cancel function.
 */
export function scramble(node: HTMLElement, text: string): Run {
  const textNode = node.firstChild;
  if (!textNode || prefersReducedMotion()) return () => {};
  const width = node.getBoundingClientRect().width;
  const style = node.style;
  style.display = "inline-block";
  style.width = `${width}px`;
  style.whiteSpace = "nowrap";
  const start = performance.now();
  let frame = 0;
  const settle = () => {
    textNode.nodeValue = text;
    style.width = style.display = style.whiteSpace = "";
  };
  const step = (time: number) => {
    const ticks = Math.floor((time - start) / SCRAMBLE_STEP);
    let out = "";
    let done = true;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === " " || ticks >= i * 1.4 + 5) out += char;
      else {
        out += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        done = false;
      }
    }
    textNode.nodeValue = out;
    if (done) settle();
    else frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
  return () => {
    cancelAnimationFrame(frame);
    settle();
  };
}

/* ── Fill ────────────────────────────────────────────────────────────────────────────────── */

function placeFill(element: HTMLElement, event: PointerEvent) {
  const box = element.getBoundingClientRect();
  element.style.setProperty("--fx", `${event.clientX - box.left}px`);
  element.style.setProperty("--fy", `${event.clientY - box.top}px`);
  element.style.setProperty("--fd", `${Math.hypot(box.width, box.height) * 2.1}px`);
}

/** pointerover/out bubble; only act when the pointer really crossed the control's edge. */
function crossing(event: PointerEvent, selector: string): HTMLElement | null {
  const target = (event.target as Element | null)?.closest?.<HTMLElement>(selector);
  if (!target) return null;
  const other = event.relatedTarget as Node | null;
  return other && target.contains(other) ? null : target;
}

function onFillEnter(event: PointerEvent) {
  if (event.pointerType !== "mouse") return;
  const element = crossing(event, ".fill");
  if (!element) return;
  placeFill(element, event);
  element.classList.add("is-filled");
}

function onFillLeave(event: PointerEvent) {
  const element = crossing(event, ".fill");
  if (!element) return;
  placeFill(element, event);
  element.classList.remove("is-filled");
}

/* ── Magnets ─────────────────────────────────────────────────────────────────────────────── */

const SOFT = ".btn-primary, .fill, .btn-icon, [data-magnet]";
const SOFT_PULL = 0.25;
const SOFT_REACH = 8; // px
const SOFT_LIMIT = { width: 280, height: 120 }; // larger controls stay put

type Pull = { x: number; y: number; tx: number; ty: number };
const pulls = new Map<HTMLElement, Pull>();
let softTarget: HTMLElement | null = null;
let strongTarget: HTMLElement | null = null;

function releaseSoft() {
  if (softTarget) Object.assign(pulls.get(softTarget) ?? {}, { tx: 0, ty: 0 });
  softTarget = null;
}

function onMagnetMove(event: PointerEvent) {
  if (event.pointerType !== "mouse") return;
  const from = event.target as Element | null;

  // The explicit, stronger pull.
  const strong = from?.closest?.<HTMLElement>("[data-magnetic]") ?? null;
  if (strong !== strongTarget) {
    if (strongTarget) strongTarget.style.transform = "";
    strongTarget = strong;
    if (strong) strong.style.transition = "transform 500ms var(--ease-spring)";
  }
  if (strong) {
    const strength = Number(strong.dataset.magnetic) || 0.3;
    const box = strong.getBoundingClientRect();
    const x = (event.clientX - (box.left + box.width / 2)) * strength;
    const y = (event.clientY - (box.top + box.height / 2)) * strength;
    strong.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  }

  // The gentle pull every button gets.
  const candidate = from?.closest?.<HTMLElement>(SOFT) ?? null;
  const soft =
    candidate && candidate.dataset.magnet !== "off" && !candidate.hasAttribute("data-magnetic") ? candidate : null;
  if (soft !== softTarget) releaseSoft();
  if (!soft) return;
  const box = soft.getBoundingClientRect();
  if (box.width > SOFT_LIMIT.width || box.height > SOFT_LIMIT.height) return;
  const pull = pulls.get(soft) ?? { x: 0, y: 0, tx: 0, ty: 0 };
  const clamp = (value: number) => Math.max(-SOFT_REACH, Math.min(SOFT_REACH, value));
  pull.tx = clamp((event.clientX - (box.left + box.width / 2 - pull.x)) * SOFT_PULL);
  pull.ty = clamp((event.clientY - (box.top + box.height / 2 - pull.y)) * SOFT_PULL);
  pulls.set(soft, pull);
  softTarget = soft;
}

function easePulls() {
  for (const [element, pull] of pulls) {
    pull.x += (pull.tx - pull.x) * 0.18;
    pull.y += (pull.ty - pull.y) * 0.18;
    const atRest = Math.abs(pull.x) < 0.05 && Math.abs(pull.y) < 0.05 && !pull.tx && !pull.ty;
    if (atRest || !element.isConnected) {
      element.style.translate = "";
      pulls.delete(element);
    } else {
      element.style.translate = `${pull.x.toFixed(2)}px ${pull.y.toFixed(2)}px`;
    }
  }
}

/* ── Proximity ───────────────────────────────────────────────────────────────────────────── */

const PROXIMITY_REACH = 170; // px
let proximityTarget: HTMLElement | null = null;

function settleProximity() {
  proximityTarget?.querySelectorAll<HTMLElement>(".prox-char").forEach((char) => (char.style.transform = ""));
  proximityTarget = null;
}

function onProximityMove(event: PointerEvent) {
  if (event.pointerType !== "mouse") return;
  const heading = (event.target as Element | null)?.closest?.<HTMLElement>("[data-proximity]") ?? null;
  if (heading !== proximityTarget) settleProximity();
  if (!heading) return;
  proximityTarget = heading;
  heading.querySelectorAll<HTMLElement>(".prox-char").forEach((char) => {
    const box = char.getBoundingClientRect();
    const dx = event.clientX - (box.left + box.width / 2);
    const dy = event.clientY - (box.top + box.height / 2);
    const near = Math.max(0, 1 - Math.hypot(dx, dy) / PROXIMITY_REACH);
    char.style.transform = near
      ? `translateY(${(-near * 0.16).toFixed(3)}em) rotate(${(Math.sign(dx) * -near * 5).toFixed(2)}deg)`
      : "";
  });
}

/* ── Start ───────────────────────────────────────────────────────────────────────────────── */

let started = false;

export function initMotion(): Run {
  if (started) return () => {};
  started = true;

  adoptAll(document);
  const mutations = new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) adoptAll(node);
      });
    }
  });
  mutations.observe(document.body, { childList: true, subtree: true });

  const hover = canHover();
  const moving = hover && !prefersReducedMotion();
  if (hover) {
    document.addEventListener("pointerover", onFillEnter);
    document.addEventListener("pointerout", onFillLeave);
  }
  if (moving) {
    window.addEventListener("pointermove", onMagnetMove, { passive: true });
    window.addEventListener("pointermove", onProximityMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", releaseSoft);
    ticker.add(easePulls);
  }

  return () => {
    started = false;
    mutations.disconnect();
    document.removeEventListener("pointerover", onFillEnter);
    document.removeEventListener("pointerout", onFillLeave);
    window.removeEventListener("pointermove", onMagnetMove);
    window.removeEventListener("pointermove", onProximityMove);
    document.documentElement.removeEventListener("pointerleave", releaseSoft);
    ticker.remove(easePulls);
    settleProximity();
  };
}
