"use client";

import { Fragment, useEffect, useRef } from "react";
import { about } from "@/content/sections";
import { still } from "@/lib/device";
import { seal } from "@/lib/seal";
import { stagesOn } from "@/lib/stage";
import { useStore } from "@/lib/store";
import { now, ticker } from "@/lib/ticker";
import styles from "./Seal.module.css";

/** The text sits on a circle of this radius in a 240-unit box. */
const RING = 100;
const RING_LENGTH = 2 * Math.PI * RING - 4;
/** Roughly how many characters fill one turn at the ring's type size. */
const CHARS_PER_TURN = 88;
/** Degrees the ring turns per screen of scrolling, and the extra it turns while hovered. */
const TURN_PER_SCREEN = 90;
const HOVER_TURN = 24;

const SEPARATOR = " · ";
const phraseLength = about.seal.ring.reduce((sum, entry) => sum + entry.text.length + SEPARATOR.length, 0);
const repeats = Math.max(1, Math.round(CHARS_PER_TURN / phraseLength));

/** A staggered grid of points filling a disc, as one path of zero-length strokes (round dots). */
function discOfDots(radius: number): string {
  const rowGap = 4.4;
  const colGap = 5.1;
  let path = "";
  for (let y = -radius; y <= radius; y += rowGap) {
    const shift = Math.round(y / rowGap) % 2 ? colGap / 2 : 0;
    for (let x = -radius; x <= radius; x += colGap) {
      const px = x + shift;
      if (px * px + y * y <= radius * radius) path += `M${(120 + px).toFixed(1)} ${(120 + y).toFixed(1)}h0`;
    }
  }
  return path;
}

const CENTRE_DOTS = discOfDots(84);

/**
 * The ring of text around the particle medal: where he works now, as a link. It turns with the
 * scroll and a little further under the cursor, which also swells the medal (lib/seal). Where
 * there is no particle medal to go round, the middle is filled with a disc of dots instead.
 */
export function Seal() {
  const link = useRef<HTMLAnchorElement>(null);
  const ring = useRef<SVGGElement>(null);
  const hovered = useRef(false);
  const medal = useStore(stagesOn, false);

  const setHovered = (on: boolean) => {
    hovered.current = on;
    seal.hovered = on && !still.get();
  };

  useEffect(() => {
    const element = link.current;
    if (!element) return;
    let extra = 0;
    let shown: number | null = null;
    let running = false;

    const turn = () => {
      extra += ((hovered.current ? HOVER_TURN : 0) - extra) * 0.14;
      const angle = ((now.scrollY / window.innerHeight) * TURN_PER_SCREEN + extra) % 360;
      if (!ring.current || (shown !== null && Math.abs(angle - shown) < 0.01)) return;
      shown = angle;
      ring.current.style.transform = `rotate(${angle.toFixed(2)}deg)`;
    };

    // Only turns while it is on screen or about to be, and not at all when the page is held still.
    const watcher = new IntersectionObserver(
      ([entry]) => {
        const run = entry.isIntersecting && !still.get();
        if (run === running) return;
        running = run;
        if (run) ticker.add(turn);
        else ticker.remove(turn);
      },
      { rootMargin: "100% 0px" },
    );
    watcher.observe(element);

    return () => {
      watcher.disconnect();
      ticker.remove(turn);
      seal.hovered = false;
    };
  }, []);

  return (
    <a
      ref={link}
      href={about.seal.href}
      target="_blank"
      rel="noopener"
      className={`${styles.seal} ${medal ? "" : styles.filled}`}
      onPointerEnter={(event) => event.pointerType === "mouse" && setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      <span className="visually-hidden">{about.seal.label}</span>
      <svg viewBox="0 0 240 240" aria-hidden="true">
        <defs>
          <path id="seal-ring-path" d={`M 20 120 A ${RING} ${RING} 0 1 1 220 120 A ${RING} ${RING} 0 1 1 20 120`} />
        </defs>
        <circle className={styles.dots} cx="120" cy="120" r="116" />
        {medal ? null : <circle className={styles.dots} cx="120" cy="120" r="92" />}
        <g ref={ring} className={styles.ring}>
          <text className="font-semibold" textLength={RING_LENGTH} lengthAdjust="spacing">
            <textPath href="#seal-ring-path">
              {Array.from({ length: repeats }, (_, turn) =>
                about.seal.ring.map((entry, i) => (
                  <Fragment key={`${turn}-${i}`}>
                    {"strong" in entry && entry.strong ? (
                      <tspan className={styles.strong}>{entry.text}</tspan>
                    ) : (
                      entry.text
                    )}
                    {SEPARATOR}
                  </Fragment>
                )),
              )}
            </textPath>
          </text>
        </g>
        {medal ? null : <path className={styles.centre} d={CENTRE_DOTS} />}
      </svg>
    </a>
  );
}
