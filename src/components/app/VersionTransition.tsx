"use client";

import { useEffect, useRef, useState } from "react";
import { gate } from "@/content/sections";
import { setSoundAllowed } from "@/lib/audio";
import { prefersReducedMotion } from "@/lib/device";
import { registerSwitcher, setVersion, type Version } from "@/lib/experience";
import { ticker } from "@/lib/ticker";
import {
  dotCount,
  fitCanvas,
  gridPoint,
  seedDot,
  spiralPoint,
  type DotSeed,
  type Field,
  type Point,
} from "./dot-shapes";
import styles from "./VersionTransition.module.css";

type Dot = DotSeed & {
  origin: Point;
  x: number;
  y: number;
  delay: number;
  size: number;
  accent: boolean;
  vx: number;
  vy: number;
};

const ORDER: Version[] = ["site", "story"];
const COVER_MS = 750;
const BACKDROP_MS = 450;
/** The label stays up at least this long, so it can be read even when the view is already loaded. */
const HOLD_MS = 650;
const REVEAL_MS = 800;
const SAND = "#ece8df";
const ACCENT = "#ff4f00";

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3);

/**
 * Going from the site to the story (or back) once inside: dots burst out of the dock button that
 * was pressed and settle into the destination's formation over a dark cover, its name is shown
 * while the view underneath is swapped, then the dots fly off and the cover lifts.
 */
export function VersionTransition() {
  const backdropRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [target, setTarget] = useState<Version | null>(null);
  const [labelShown, setLabelShown] = useState(false);

  useEffect(() => {
    let running = false;
    let disposed = false;
    let ctx: CanvasRenderingContext2D | null = null;
    let field: Field = { width: 0, height: 0 };
    let dots: Dot[] = [];
    let stage: "idle" | "cover" | "hold" | "reveal" = "idle";
    let destination: Version = "site";
    let coverAt = 0;
    let revealAt = 0;
    let time = 0;

    const fade = (opacity: number, duration: number, delay = 0) => {
      const backdrop = backdropRef.current;
      if (!backdrop) return;
      backdrop.style.transition = `opacity ${duration}ms ease ${delay}ms`;
      backdrop.style.opacity = String(opacity);
    };

    const scatter = (from?: DOMRect) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      ({ ctx, field } = fitCanvas(canvas));
      // Without a button to start from (keyboard shortcut, code), start where the dock is.
      const startX = from ? from.left + from.width / 2 : field.width / 2;
      const startY = from ? from.top + from.height / 2 : field.height - 40;
      dots = Array.from({ length: dotCount(field) }, (_, index) => {
        const angle = Math.random() * Math.PI * 2;
        const spread = Math.random() * 14;
        const x = startX + Math.cos(angle) * spread;
        const y = startY + Math.sin(angle) * spread;
        return {
          ...seedDot(index),
          origin: [x, y],
          x,
          y,
          delay: Math.random() * 0.3,
          size: 0.8 + Math.random() * 1.4,
          accent: Math.random() < 0.03,
          vx: 0,
          vy: 0,
        };
      });
    };

    const formation = (dot: Dot, index: number): Point =>
      destination === "site"
        ? gridPoint(index, dots.length, field, field.width < 648 ? 20 : 40, field.height * 0.7)
        : spiralPoint(dot, field, Math.min(field.width, field.height) * 0.36, time);

    const draw = (frameTime: number) => {
      const pen = ctx;
      if (!pen) return;
      time += 1 / 60;
      pen.clearRect(0, 0, field.width, field.height);
      const sinceCover = (frameTime - coverAt) / 1000;
      const revealed = stage === "reveal" ? (frameTime - revealAt) / REVEAL_MS : 0;

      dots.forEach((dot, index) => {
        if (stage === "reveal") {
          if (!dot.vx && !dot.vy) {
            const dx = dot.x - field.width / 2;
            const dy = dot.y - field.height / 2;
            const distance = Math.hypot(dx, dy) || 1;
            const speed = 4 + Math.random() * 10;
            dot.vx = (dx / distance) * speed;
            dot.vy = (dy / distance) * speed;
          }
          dot.x += dot.vx;
          dot.y += dot.vy;
          dot.vx *= 1.05;
          dot.vy *= 1.05;
        } else {
          const [tx, ty] = formation(dot, index);
          const travelled = easeOutCubic((sinceCover - dot.delay) / ((COVER_MS / 1000) * 0.75));
          const x = dot.origin[0] + (tx - dot.origin[0]) * travelled;
          const y = dot.origin[1] + (ty - dot.origin[1]) * travelled;
          // On the way it follows the path exactly; once there it trails the turning formation.
          const follow = travelled < 1 ? 1 : 0.2;
          dot.x += (x - dot.x) * follow;
          dot.y += (y - dot.y) * follow;
        }
        pen.fillStyle = dot.accent ? ACCENT : SAND;
        pen.globalAlpha = 0.85 * (stage === "reveal" ? Math.max(0, 1 - revealed * 1.3) : 1);
        pen.beginPath();
        pen.arc(dot.x, dot.y, dot.size, 0, Math.PI * 2);
        pen.fill();
      });
      pen.globalAlpha = 1;
    };

    const cover = async (id: Version, from: DOMRect | undefined, calm: boolean) => {
      destination = id;
      setTarget(id);
      if (calm) {
        setLabelShown(true);
        fade(1, 200);
        await wait(200);
        return;
      }
      scatter(from);
      stage = "cover";
      coverAt = performance.now();
      ticker.add(draw);
      fade(1, BACKDROP_MS);
      window.setTimeout(() => !disposed && setLabelShown(true), COVER_MS * 0.4);
      await wait(COVER_MS);
      stage = "hold";
    };

    const reveal = async (heldSince: number, calm: boolean) => {
      await wait(Math.max(0, HOLD_MS - (performance.now() - heldSince)));
      if (disposed) return;
      setLabelShown(false);
      if (calm) {
        fade(0, 250);
        await wait(250);
      } else {
        stage = "reveal";
        revealAt = performance.now();
        fade(0, REVEAL_MS * 0.65, REVEAL_MS * 0.3);
        await wait(REVEAL_MS);
        ticker.remove(draw);
        ctx?.clearRect(0, 0, field.width, field.height);
        stage = "idle";
      }
      if (!disposed) setTarget(null);
    };

    registerSwitcher(async (id, from) => {
      if (running) return;
      running = true;
      const calm = prefersReducedMotion();
      // Straight away, while this still counts as the visitor's click: browsers only start
      // sound from a gesture, and leaving the story should fade its music under the cover.
      setSoundAllowed(id === "story");
      try {
        await Promise.all([
          cover(id, from, calm),
          id === "story" ? import("@/components/story/StoryView").catch(() => null) : null,
        ]);
        if (disposed) return;
        const heldSince = performance.now();
        setVersion(id);
        // Two frames for the new view to mount and paint under the cover.
        await nextFrame();
        await nextFrame();
        await reveal(heldSince, calm);
      } finally {
        running = false;
      }
    });

    return () => {
      disposed = true;
      registerSwitcher(null);
      ticker.remove(draw);
    };
  }, []);

  return (
    <div className={styles.switch} data-active={target ? "" : undefined} aria-hidden={!target}>
      <div ref={backdropRef} className={styles.backdrop} />
      <canvas ref={canvasRef} className={styles.dots} />
      <div className={styles.label} data-shown={labelShown || undefined} role="status">
        {target ? (
          <>
            <span className={`${styles.index} font-regular`}>0{ORDER.indexOf(target) + 1}</span>
            <span className={`${styles.title} font-bold`}>{gate.versions[target].title}</span>
            <span className={`${styles.desc} font-regular`}>{gate.versions[target].desc}</span>
          </>
        ) : null}
      </div>
    </div>
  );
}
