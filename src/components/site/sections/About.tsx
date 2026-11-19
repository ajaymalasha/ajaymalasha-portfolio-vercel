"use client";

import { useRef, useState, type PointerEvent } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { about, chapters } from "@/content/sections";
import { publishLens } from "@/lib/lens";
import { useTicker } from "@/lib/ticker";
import { DotFigures } from "./DotFigures";
import { Seal } from "./Seal";
import styles from "./About.module.css";

/** How far the lens may hang over the edge of the statement, in px. Matches the CSS. */
const OVERHANG = 300;
const LENS_RADIUS = 200;

/** Words start faint and reach full strength as the section scrolls up the screen. */
const FAINT = 0.45;
/** The last word starts darkening this far through the scroll; each word takes `RAMP` to finish. */
const SPREAD = 0.65;
const RAMP = 0.3;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** The statement as single words, so each can darken on its own. */
const words = about.text.flatMap((run) =>
  run.text
    .split(" ")
    .filter(Boolean)
    .map((text) => ({ text, strong: "strong" in run && run.strong })),
);

/**
 * (01) About: one statement that darkens word by word as it is scrolled into view, with a second
 * line behind it that a lens around the cursor uncovers; the ring of text around the particle
 * medal; and four figures drawn in dots.
 */
export function About() {
  const section = useRef<HTMLElement>(null);
  const statement = useRef<HTMLParagraphElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const hidden = useRef<HTMLParagraphElement>(null);
  const [hovering, setHovering] = useState(false);
  const lens = useRef({ tx: 0, ty: 0, x: 0, y: 0, tr: 0, r: 0, open: false, progress: -1, owner: {} });

  useTicker(() => {
    const state = lens.current;

    if (section.current && statement.current) {
      const progress = clamp01(1 - section.current.getBoundingClientRect().top / window.innerHeight);
      if (Math.abs(progress - state.progress) > 0.004) {
        state.progress = progress;
        const spans = statement.current.children;
        for (let i = 0; i < spans.length; i++) {
          const strength = FAINT + clamp01((progress - (i / spans.length) * SPREAD) / RAMP) * (1 - FAINT);
          (spans[i] as HTMLElement).style.color =
            `color-mix(in srgb, var(--fg) ${Math.round(strength * 100)}%, transparent)`;
        }
      }
    }

    if (!body.current || (!state.open && state.r === 0)) return;
    state.x += (state.tx - state.x) * 0.12;
    state.y += (state.ty - state.y) * 0.12;
    // Opens a touch slower than it closes.
    state.r += (state.tr - state.r) * (state.r < state.tr ? 0.06 : 0.07);
    if (!state.open && state.r < 0.5) state.r = 0;
    if (hidden.current) {
      hidden.current.style.clipPath = `circle(${state.r.toFixed(2)}px at ${state.x.toFixed(2)}px ${state.y.toFixed(2)}px)`;
    }
    publishLens(state.owner, body.current, OVERHANG, state.x, state.y, state.r, LENS_RADIUS);
  });

  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse") return;
    const state = lens.current;
    const box = event.currentTarget.getBoundingClientRect();
    state.tx = event.clientX - box.left + OVERHANG;
    state.ty = event.clientY - box.top + OVERHANG;
    if (!state.open) {
      // Open where the cursor is, rather than sliding in from where it last closed.
      state.x = state.tx;
      state.y = state.ty;
      state.open = true;
      setHovering(true);
    }
    state.tr = LENS_RADIUS;
  };

  const onLeave = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse") return;
    lens.current.tr = 0;
    lens.current.open = false;
    setHovering(false);
  };

  return (
    <section ref={section} id="about" className={styles.about} data-theme="light" data-chapter={chapters.about}>
      <SectionHeader index="01" label={about.label}>
        {about.aside}
      </SectionHeader>

      <div className={`${styles.layout} grid-12`}>
        <div ref={body} className={styles.body} onPointerMove={onMove} onPointerLeave={onLeave}>
          <p ref={statement} className={`${styles.text} ${styles.visible}`}>
            {words.map((word, i) => (
              <span className={word.strong ? "font-bold" : undefined} key={i}>
                {word.text}
                {i < words.length - 1 ? " " : ""}
              </span>
            ))}
          </p>
          <p ref={hidden} className={`${styles.text} ${styles.hidden} ${hovering ? styles.revealed : ""}`}>
            {about.hidden}
          </p>
        </div>
        <div className={styles.slot} data-slot="form" aria-hidden="true" />
        <Seal />
      </div>

      <div className={styles.statsWrap}>
        <ul className={styles.stats} data-dot-figures="">
          {about.stats.map((stat) => (
            <li className={styles.stat} key={stat.label}>
              <p className={`${styles.figure} font-bold`}>
                <span className={styles.num} data-dot-figure="">
                  {stat.num}
                </span>
                {stat.unit ? <span className={`${styles.unit} font-regular`}> {stat.unit}</span> : null}
              </p>
              <p className={`${styles.label} font-regular`}>{stat.label}</p>
            </li>
          ))}
        </ul>
        <DotFigures />
      </div>
    </section>
  );
}
