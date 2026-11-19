"use client";

import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "@/lib/device";
import { now, ticker } from "@/lib/ticker";
import styles from "./ScrollProgress.module.css";

type Grain = { slot: number; y: number; vy: number; state: "fall" | "rest" | "rise"; alpha: number };

const COLUMNS = 2;
const GRAVITY = 0.45;
/** Grains added or released per frame, so a long jump pours instead of appearing. */
const PER_FRAME = 4;

/**
 * Scroll progress as an hourglass on the right edge: grains fall and pile up as the page is
 * read, and lift away again on the way back. Small ticks mark where each chapter starts.
 */
export function ScrollProgress() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const calm = prefersReducedMotion();
    let width = 0;
    let height = 0;
    let pitch = 5;
    let rows = 0;
    let capacity = 0;
    let scrollable = 0;
    let grains: Grain[] = [];
    let marks: number[] = [];
    let colour = "";
    let accent = "";
    let frame = 0;
    let nameZone: HTMLElement | null = null;
    let opacity = "1";

    const columnX = (slot: number) => width / 2 + ((slot % COLUMNS) - (COLUMNS - 1) / 2) * pitch;
    const restY = (slot: number) => height - pitch / 2 - Math.floor(slot / COLUMNS) * pitch - 2;

    const measurePage = () => {
      scrollable = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return;
      marks = Array.from(document.querySelectorAll<HTMLElement>("[data-chapter]"), (section) => {
        const middle = section.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.5;
        return Math.min(1, Math.max(0, middle / scrollable));
      });
    };

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      pitch = window.innerWidth < 648 ? 4 : 5;
      rows = Math.floor((height - 8) / pitch);
      capacity = rows * COLUMNS;
      // The pile is re-seated for the new height rather than poured again.
      grains = grains
        .filter((grain) => grain.slot < capacity)
        .map((grain) => ({ ...grain, y: restY(grain.slot), vy: 0, state: "rest", alpha: 1 }));
      measurePage();
    };

    const draw = () => {
      // The footer's name takes over the right edge as it arrives: fade out of its way.
      nameZone ??= document.querySelector<HTMLElement>('[data-fx="name-zone"]');
      const arrived = (nameZone && parseFloat(nameZone.style.getPropertyValue("--arrived"))) || 0;
      const nextOpacity = (1 - arrived).toFixed(3);
      if (nextOpacity !== opacity) canvas.style.opacity = opacity = nextOpacity;

      if (frame % 10 === 0) {
        const root = getComputedStyle(document.documentElement);
        colour = root.getPropertyValue("--fg").trim() || colour;
        accent = root.getPropertyValue("--accent").trim() || accent;
      }
      // Sections change height as stages mount and images load.
      if (frame % 60 === 0) measurePage();
      frame++;

      const progress = scrollable > 0 ? Math.min(1, Math.max(0, now.scrollY / scrollable)) : 0;
      const wanted = Math.round(progress * capacity);
      const pile = grains.filter((grain) => grain.state !== "rise");

      for (let added = 0; pile.length < wanted && added < PER_FRAME; added++) {
        const slot = pile.length;
        const grain: Grain = calm
          ? { slot, y: restY(slot), vy: 0, state: "rest", alpha: 1 }
          : { slot, y: -4 - Math.random() * 30, vy: Math.random() * 2, state: "fall", alpha: 1 };
        grains.push(grain);
        pile.push(grain);
      }

      if (pile.length > wanted) {
        const released = pile.sort((a, b) => b.slot - a.slot).slice(0, Math.min(PER_FRAME, pile.length - wanted));
        if (calm) grains = grains.filter((grain) => !released.includes(grain));
        else released.forEach((grain) => (grain.state = "rise"));
      }

      for (const grain of grains) {
        if (grain.state === "fall") {
          grain.vy += GRAVITY;
          grain.y += grain.vy;
          const floor = restY(grain.slot);
          if (grain.y >= floor) {
            grain.y = floor;
            // A fast grain bounces once before it settles.
            if (grain.vy > 3) grain.vy *= -0.25;
            else grain.state = "rest";
          }
        } else if (grain.state === "rise") {
          grain.vy = Math.min(grain.vy, 0) - 0.35;
          grain.y += grain.vy;
          grain.alpha -= 0.04;
        }
      }
      grains = grains.filter((grain) => grain.alpha > 0);

      ctx.clearRect(0, 0, width, height);
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = colour;
      for (const mark of marks) {
        ctx.fillRect(width / 2 - pitch * 1.6, restY(Math.floor(mark * rows) * COLUMNS), pitch * 3.2, 1);
      }

      let top = -1;
      for (const grain of grains) if (grain.state === "rest" && grain.slot > top) top = grain.slot;
      for (const grain of grains) {
        const leading = grain.slot === top;
        ctx.globalAlpha = grain.state === "fall" ? 0.7 : grain.alpha * 0.9;
        ctx.fillStyle = leading ? accent : colour;
        ctx.beginPath();
        ctx.arc(columnX(grain.slot), grain.y, leading ? 2.1 : 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    resize();
    window.addEventListener("resize", resize);
    ticker.add(draw);
    return () => {
      ticker.remove(draw);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className={styles.hourglass} aria-hidden="true" />;
}
