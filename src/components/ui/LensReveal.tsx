"use client";

import { useRef, type PointerEvent, type ReactNode } from "react";
import { publishLens } from "@/lib/lens";
import { useTicker } from "@/lib/ticker";
import styles from "./LensReveal.module.css";

/** How far the lens may hang over the edge of the copy, in px. Matches the CSS. */
const OVERHANG = 160;

type Props = {
  /** The copy everyone sees. */
  children: ReactNode;
  /** The copy seen through the lens. Hidden from assistive technology (it is a visual aside). */
  hidden: ReactNode;
  /** Radius the lens opens to, in px. */
  radius?: number;
  className?: string;
};

/**
 * A circle follows the cursor over the copy and shows a second version of it inside. Mouse only:
 * touch screens have no hover, so sections print the hidden line some other way there.
 * When the particle cloud is running it draws the circle itself, out of dots (see lib/lens).
 */
export function LensReveal({ children, hidden, radius = 180, className }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const state = useRef({ hovering: false, tx: 0, ty: 0, x: 0, y: 0, tr: 0, r: 0, owner: {} });

  useTicker(() => {
    const s = state.current;
    const element = root.current;
    if (!element) return;
    if (!s.hovering && s.r < 0.5) {
      publishLens(s.owner, element, OVERHANG, 0, 0, 0, 0);
      return;
    }
    s.x += (s.tx - s.x) * 0.14;
    s.y += (s.ty - s.y) * 0.14;
    s.r += (s.tr - s.r) * 0.09;
    if (layer.current) {
      layer.current.style.clipPath = `circle(${s.r.toFixed(2)}px at ${s.x.toFixed(2)}px ${s.y.toFixed(2)}px)`;
    }
    publishLens(s.owner, element, OVERHANG, s.x, s.y, s.r, radius);
  });

  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || !root.current) return;
    const s = state.current;
    const box = root.current.getBoundingClientRect();
    s.tx = event.clientX - box.left + OVERHANG;
    s.ty = event.clientY - box.top + OVERHANG;
    if (!s.hovering) {
      // Open where the cursor is, rather than sliding in from where it last closed.
      s.x = s.tx;
      s.y = s.ty;
      s.hovering = true;
    }
    s.tr = radius;
  };

  const onLeave = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse") return;
    state.current.tr = 0;
    state.current.hovering = false;
  };

  return (
    <div
      ref={root}
      className={`${styles.lens} ${className ?? ""}`}
      data-lens=""
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      <div className={styles.base} data-lens-base="">
        {children}
      </div>
      <div ref={layer} className={styles.layer} data-lens-layer="" aria-hidden="true">
        {hidden}
      </div>
    </div>
  );
}
