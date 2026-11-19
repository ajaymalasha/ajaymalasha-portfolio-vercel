"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { LensReveal } from "@/components/ui/LensReveal";
import { Split } from "@/components/ui/Split";
import { chapters, motto } from "@/content/sections";
import { still } from "@/lib/device";
import { breakState, setSource, sourceOn } from "@/lib/experience";
import { useStore } from "@/lib/store";
import styles from "./Motto.module.css";

const delay = (ms: number) => ({ "--reveal-delay": `${ms}ms` }) as CSSProperties;

/**
 * The standard, in two halves: the line everyone sees, and the other half read through the
 * lens (printed underneath where there is no cursor to hover with). Below it, the two ways
 * to see behind the page: take it apart, or read its code.
 */
export function Motto() {
  const source = useStore(sourceOn, false);
  const breaking = useStore(breakState, "idle");
  const calm = useStore(still, false);
  const [reading, setReading] = useState(false);
  const [inView, setInView] = useState(false);
  const breaker = useRef<HTMLDivElement>(null);

  // The button only fidgets for attention while it can actually be seen.
  useEffect(() => {
    const element = breaker.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
        // Fetch the layer that does the breaking now, so the press is answered at once.
        if (entry.isIntersecting) void import("@/components/fx/BreakLayer");
      },
      { threshold: 0.6 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [calm]);

  return (
    <section
      id="motto"
      className={styles.motto}
      data-theme="dark"
      data-chapter={chapters.motto}
      data-reading={reading ? "" : undefined}
    >
      <p className={`section-label ${styles.label}`} data-reveal="" data-over-dots="">
        {motto.label}
      </p>

      {/* While the lens is open, the label and the hint step back so only the two halves read. */}
      <div
        onPointerEnter={(event) => event.pointerType === "mouse" && setReading(true)}
        onPointerLeave={() => setReading(false)}
      >
        <LensReveal
          radius={220}
          hidden={
            <p className={`${styles.text} font-bold`}>
              {motto.hidden[0]}
              <br />
              {motto.hidden[1]}
            </p>
          }
        >
          <Split
            parts={[motto.line1, { br: true }, { accent: motto.accent }]}
            as="h2"
            className={`${styles.text} font-bold`}
          />
        </LensReveal>
      </div>

      <p className={`${styles.honest} font-regular`} data-reveal="" style={delay(200)}>
        {motto.honest}
      </p>
      <p
        className={`${styles.hint} font-regular`}
        data-reveal=""
        data-over-dots=""
        style={delay(200)}
        aria-hidden="true"
      >
        {motto.hint}
      </p>

      {/* Taking the page apart is all motion, so it is not offered where motion is unwanted. */}
      {calm ? null : (
        <div ref={breaker}>
          <button
            type="button"
            className={`${styles.pill} ${styles.break} font-regular`}
            data-nudging={inView && breaking === "idle" ? "" : undefined}
            disabled={breaking !== "idle"}
            onClick={() => breakState.set("broken")}
          >
            {motto.breakIt}
          </button>
        </div>
      )}

      <button
        type="button"
        className={`${styles.pill} font-regular`}
        aria-pressed={source}
        onClick={() => setSource(!source)}
        data-reveal=""
        style={delay(280)}
      >
        <span className={styles.glyph} aria-hidden="true">
          {"</>"}
        </span>
        {source ? motto.hideCode : motto.showCode}
      </button>
    </section>
  );
}
