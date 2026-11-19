"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { hero } from "@/content/sections";
import { site } from "@/content/site";
import { describeGap, useClock, zoneOffsetMinutes } from "@/lib/clock";
import { prefersReducedMotion } from "@/lib/device";
import { whenLoaded } from "@/lib/motion";
import { ticker } from "@/lib/ticker";
import { landMask } from "./land-mask";
import styles from "./HomeGlobe.module.css";

type Vec = readonly [number, number, number];
type Place = { lat: number; lon: number };

const RAD = Math.PI / 180;

/** After a drag, the globe coasts for this long before it starts turning back to home. */
const REST_MS = 2500;
/** How far the canvas itself follows the cursor, as a share of the cursor's offset. */
const FOLLOW = 0.36;
/** The most the cursor can turn the globe, in radians. */
const TILT = { lon: 0.55, lat: 0.22 };
/** Home sits a little right of centre, so the sway never carries it off the visible side. */
const HOME_OFFSET_DEG = 13.4;
const SWAY_DEG = 28;
const PITCH_DEG = 10;
const ARC_STEPS = 48;

const onSphere = (lat: number, lon: number): Vec => [
  Math.cos(lat * RAD) * Math.sin(lon * RAD),
  Math.sin(lat * RAD),
  Math.cos(lat * RAD) * Math.cos(lon * RAD),
];

/** One dot per land cell, thinned towards the poles where the grid's cells crowd together. */
function landDots(): Vec[] {
  const bits = Uint8Array.from(atob(landMask.data), (char) => char.charCodeAt(0));
  const dots: Vec[] = [];
  for (let cell = 0; cell < landMask.cols * landMask.rows; cell++) {
    if (!(bits[cell >> 3] & (1 << (cell & 7)))) continue;
    const lat = 90 - (Math.floor(cell / landMask.cols) + 0.5) * landMask.step;
    const lon = -180 + ((cell % landMask.cols) + 0.5) * landMask.step;
    // A fixed pseudo-random number per cell, so the same dots are dropped on every visit.
    const chance = Math.abs(Math.sin(cell * 12.9898) * 43758.5453) % 1;
    if (chance <= Math.cos(lat * RAD) + 0.15) dots.push(onSphere(lat, lon));
  }
  return dots;
}

/** Points along the great circle from `from` to `to`, lifted off the surface in the middle. */
function flightArc(from: Place, to: Place): Vec[] {
  const a = onSphere(from.lat, from.lon);
  const b = onSphere(to.lat, to.lon);
  const angle = Math.acos(a[0] * b[0] + a[1] * b[1] + a[2] * b[2]);
  return Array.from({ length: ARC_STEPS + 1 }, (_, step) => {
    const t = step / ARC_STEPS;
    const wa = Math.sin((1 - t) * angle) / Math.sin(angle);
    const wb = Math.sin(t * angle) / Math.sin(angle);
    const lift = 1 + 0.18 * Math.sin(Math.PI * t);
    return [(a[0] * wa + b[0] * wb) * lift, (a[1] * wa + b[1] * wb) * lift, (a[2] * wa + b[2] * wb) * lift] as const;
  });
}

/** "13½ hours ahead of San Francisco", from the two zones as they are right now. */
function gapLine(): string {
  const minutes = zoneOffsetMinutes(site.home.timeZone) - zoneOffsetMinutes(site.away.timeZone);
  const template = minutes === 0 ? hero.same : minutes > 0 ? hero.ahead : hero.behind;
  return template.replace("{n}", describeGap(minutes)).replace("{city}", site.away.city);
}

const never = () => () => {};
const noGap = () => "";

type Props = {
  /** Diameter in px. */
  size?: number;
  /** Spin in from the far side when the page is first shown. */
  entrance?: boolean;
};

/**
 * A small dotted globe: where home is (the pulsing dot), where the team is (the far end of the
 * arc), the time at home and the gap between the two. It sways by itself, leans towards the
 * cursor, and can be dragged round; let go and it coasts, then turns back to home.
 */
export function HomeGlobe({ size = 96, entrance = false }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const time = useClock(site.home.timeZone, { hour12: false });
  // Empty on the server: the gap depends on the visitor's date (daylight saving), not the build's.
  const gap = useSyncExternalStore(never, gapLine, noGap);

  useEffect(() => {
    const element = canvas.current;
    const holder = root.current;
    if (!element || !holder) return;
    const context = element.getContext("2d");
    if (!context) return;

    const reduced = prefersReducedMotion();
    const dots = landDots();
    const arc = flightArc(site.home, site.away);
    const home = onSphere(site.home.lat, site.home.lon);
    const away = onSphere(site.away.lat, site.away.lon);
    const accent = getComputedStyle(holder).getPropertyValue("--accent").trim() || "#ff4f00";

    let ratio = 1;
    let visible = false;
    let hovered = false;
    let dragging = false;
    let spin = 0; // what dragging has added to the globe's turn, in radians
    let coast = 0; // spin carried over from the last drag move, per frame
    let lastX = 0;
    let releasedAt = 0;
    let sway = 0; // seconds of free swaying (stops while the globe is held or hovered)
    let last = performance.now();
    let follow = { x: 0, y: 0 };
    const lean = { lon: 0, lat: 0 };
    const leanTo = { lon: 0, lat: 0 };

    const resize = () => {
      ratio = Math.min(window.devicePixelRatio || 1, 2);
      element.width = size * ratio;
      element.height = size * ratio;
    };

    const draw = (at: number) => {
      if (!visible) return;
      const dt = Math.min(0.1, (at - last) / 1000);
      last = at;
      const clock = reduced ? 0 : at / 1000;

      if (!hovered && !dragging && !reduced) sway += dt;
      if (!dragging) {
        spin += coast;
        coast *= 0.94;
        if (at - releasedAt > REST_MS && !hovered) spin *= 0.96;
      }
      const ease = reduced ? 1 : 0.08;
      lean.lon += (leanTo.lon - lean.lon) * ease;
      lean.lat += (leanTo.lat - lean.lat) * ease;

      const ink = getComputedStyle(holder).color;
      const centre = size / 2;
      const radius = size / 2 - 3;
      const yaw = (site.home.lon - HOME_OFFSET_DEG + Math.sin(sway * 0.25) * SWAY_DEG) * RAD + spin + lean.lon;
      const pitch = PITCH_DEG * RAD + lean.lat;
      const [cosYaw, sinYaw, cosPitch, sinPitch] = [Math.cos(yaw), Math.sin(yaw), Math.cos(pitch), Math.sin(pitch)];
      /** Screen x, screen y, and depth (positive is the near side). */
      const project = ([x, y, z]: Vec): Vec => {
        const turnedX = x * cosYaw - z * sinYaw;
        const turnedZ = x * sinYaw + z * cosYaw;
        return [
          centre + turnedX * radius,
          centre - (y * cosPitch - turnedZ * sinPitch) * radius,
          y * sinPitch + turnedZ * cosPitch,
        ];
      };

      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, size, size);

      context.globalAlpha = 0.18;
      context.strokeStyle = ink;
      context.lineWidth = 1;
      context.beginPath();
      context.arc(centre, centre, radius, 0, Math.PI * 2);
      context.stroke();

      context.fillStyle = ink;
      for (const dot of dots) {
        const [x, y, depth] = project(dot);
        if (depth <= 0) continue;
        context.globalAlpha = 0.15 + depth * 0.7;
        context.fillRect(x - 0.7, y - 0.7, 1.4, 1.4);
      }

      // The arc, with a brighter, larger run of dots travelling from home to the far end.
      const head = (clock * 0.35) % 1;
      context.fillStyle = accent;
      arc.forEach((point, i) => {
        const [x, y, depth] = project(point);
        if (depth <= -0.05) return;
        const glow = Math.max(0, 1 - Math.abs(i / ARC_STEPS - head) * 8);
        const half = 0.9 + glow * 1.1;
        context.globalAlpha = 0.45 + glow * 0.55;
        context.fillRect(x - half, y - half, half * 2, half * 2);
      });

      const [awayX, awayY, awayDepth] = project(away);
      if (awayDepth > 0) {
        context.globalAlpha = 0.9;
        context.fillStyle = ink;
        context.beginPath();
        context.arc(awayX, awayY, 2, 0, Math.PI * 2);
        context.fill();
      }

      const [homeX, homeY, homeDepth] = project(home);
      if (homeDepth > 0) {
        const pulse = (clock * 0.6) % 1;
        context.globalAlpha = 1 - pulse;
        context.strokeStyle = accent;
        context.beginPath();
        context.arc(homeX, homeY, 3 + pulse * 9, 0, Math.PI * 2);
        context.stroke();
        context.globalAlpha = 1;
        context.fillStyle = accent;
        context.beginPath();
        context.arc(homeX, homeY, 3, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
    };

    /** With motion reduced there is no loop: the globe is redrawn only when something changes it. */
    const redrawIfStill = () => {
      if (reduced) draw(performance.now());
    };

    const leanTowards = (event: PointerEvent) => {
      const box = element.getBoundingClientRect();
      // Measured from where the canvas rests, not from where following the cursor has moved it.
      const dx = event.clientX - (box.left + box.width / 2 - follow.x);
      const dy = event.clientY - (box.top + box.height / 2 - follow.y);
      const unit = (value: number) => Math.max(-1, Math.min(1, value));
      leanTo.lon = -unit(dx / (box.width / 2)) * TILT.lon;
      leanTo.lat = unit(dy / (box.height / 2)) * TILT.lat;
      if (reduced) return;
      follow = { x: dx * FOLLOW, y: dy * FOLLOW };
      element.style.translate = `${follow.x.toFixed(1)}px ${follow.y.toFixed(1)}px`;
    };

    const onEnter = (event: PointerEvent) => {
      if (event.pointerType === "mouse") hovered = true;
    };
    const onLeave = () => {
      hovered = false;
      leanTo.lon = leanTo.lat = 0;
      follow = { x: 0, y: 0 };
      element.style.translate = "";
      redrawIfStill();
    };
    const onDown = (event: PointerEvent) => {
      dragging = true;
      lastX = event.clientX;
      coast = 0;
      element.setPointerCapture(event.pointerId);
      element.classList.add(styles.dragging);
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && !dragging) leanTowards(event);
      if (dragging) {
        const turn = -(event.clientX - lastX) * (Math.PI / size) * 1.2;
        spin += turn;
        coast = turn;
        lastX = event.clientX;
      }
      redrawIfStill();
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      releasedAt = performance.now();
      element.classList.remove(styles.dragging);
    };

    resize();
    const watcher = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) draw(performance.now());
    });
    watcher.observe(holder);

    // Starts most of a turn away and is already "released", so it swings round to home as it appears.
    const cancelEntrance =
      entrance && !reduced
        ? whenLoaded(() => {
            spin = -Math.PI * 0.8;
            releasedAt = performance.now() - REST_MS + 450;
          })
        : () => {};

    if (!reduced) ticker.add(draw);
    window.addEventListener("resize", resize);
    element.addEventListener("pointerenter", onEnter);
    element.addEventListener("pointerleave", onLeave);
    element.addEventListener("pointerdown", onDown);
    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerup", onUp);
    element.addEventListener("pointercancel", onUp);

    return () => {
      cancelEntrance();
      ticker.remove(draw);
      watcher.disconnect();
      window.removeEventListener("resize", resize);
      element.removeEventListener("pointerenter", onEnter);
      element.removeEventListener("pointerleave", onLeave);
      element.removeEventListener("pointerdown", onDown);
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerup", onUp);
      element.removeEventListener("pointercancel", onUp);
      element.style.translate = "";
    };
  }, [size, entrance]);

  return (
    <div ref={root} className={`${styles.globe} font-regular`}>
      <canvas
        ref={canvas}
        className={styles.canvas}
        style={{ width: size, height: size }}
        data-cursor="stick"
        aria-hidden="true"
      />
      <p className={styles.text}>
        <span className={`${styles.city} font-semibold`}>
          {site.home.city} <span className={styles.time}>{time}</span>
        </span>
        <span className={styles.gap}>{gap}</span>
      </p>
    </div>
  );
}
