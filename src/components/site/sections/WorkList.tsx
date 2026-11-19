"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowIcon } from "@/components/ui/ArrowIcon";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Split } from "@/components/ui/Split";
import { chapters, work } from "@/content/sections";
import { useTicker } from "@/lib/ticker";
import styles from "./WorkList.module.css";

/** Every storefront listed is on the same platform; the content file has no field for it. */
const PLATFORM = "Shopify";

const pad = (n: number) => String(n).padStart(2, "0");
const delay = (ms: number) => ({ "--reveal-delay": `${ms}ms` }) as CSSProperties;

/**
 * Selected work as a list of rows, each a link to the live storefront. With a mouse, a capture
 * of the storefront trails the cursor while a row is hovered.
 */
export function WorkList() {
  const [hovered, setHovered] = useState(-1);
  // The capture on show stays the last one hovered, so it does not blank while the frame fades out.
  const [shown, setShown] = useState(0);
  const preview = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0, cx: 0, cy: 0, tilt: 0, seen: false });

  useEffect(() => {
    const move = (event: MouseEvent) => {
      const p = pointer.current;
      p.x = event.clientX;
      p.y = event.clientY;
      if (!p.seen) {
        p.cx = p.x;
        p.cy = p.y;
        p.seen = true;
      }
    };
    window.addEventListener("mousemove", move, { passive: true });
    return () => window.removeEventListener("mousemove", move);
  }, []);

  useTicker(() => {
    const p = pointer.current;
    const frame = preview.current;
    if (!frame || !p.seen) return;
    const dx = p.x - p.cx;
    const dy = p.y - p.cy;
    // Hidden and caught up with the cursor: nothing to draw.
    if (hovered === -1 && Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1 && Math.abs(p.tilt) < 0.01) return;
    p.cx += dx * 0.14;
    p.cy += dy * 0.14;
    // It leans into the direction of travel, like a card being dragged.
    p.tilt += (Math.max(-12, Math.min(12, dx * 0.08)) - p.tilt) * 0.12;
    frame.style.transform = `translate3d(${p.cx.toFixed(1)}px, ${p.cy.toFixed(1)}px, 0) translate(-50%, -50%) rotate(${p.tilt.toFixed(2)}deg)`;
  });

  return (
    <section id="work" className={styles.work} data-theme="dark" data-chapter={chapters.work}>
      <header>
        <SectionHeader index="03" label={work.label}>
          {work.aside}
        </SectionHeader>
        <div className={styles.lead}>
          <div>
            <Split parts={work.heading} as="h2" className={`${styles.heading} font-bold`} proximity />
            <p className={`${styles.intro} font-regular`} data-reveal="" style={delay(150)}>
              {work.intro}
            </p>
          </div>
          <div data-slot="form" aria-hidden="true" />
        </div>
      </header>

      <ol className={styles.index} data-hover={hovered !== -1 ? "" : undefined} onMouseLeave={() => setHovered(-1)}>
        {work.projects.map((project, i) => (
          <li
            key={project.slug}
            className={styles.row}
            data-hovered={hovered === i ? "" : undefined}
            data-reveal=""
            style={delay(i * 70)}
          >
            <a
              href={project.url}
              target="_blank"
              rel="noopener"
              className={styles.rowLink}
              data-cursor-label={work.visit}
              onMouseEnter={() => {
                setHovered(i);
                setShown(i);
              }}
            >
              <span className={`${styles.rowIndex} font-regular`}>{pad(i + 1)}</span>
              <span className={styles.rowTitle}>
                <span className={`${styles.rowName} font-bold`}>{project.name}</span>
                <span className={`${styles.rowBrief} font-regular`}>{project.brief}</span>
              </span>
              <span className={`${styles.rowInfo} font-regular`}>
                <span className={styles.rowMeta}>
                  {project.sector} · {PLATFORM}
                </span>
                <span className={styles.rowCredit}>
                  <span className={styles.rowDot} />
                  {work.with.replace("{studio}", project.team.studio)}
                </span>
              </span>
              <ArrowIcon className={styles.rowArrow} />
            </a>
          </li>
        ))}
      </ol>

      <div className={`${styles.notes} font-regular`} data-reveal="">
        <p className={styles.also}>{work.also}</p>
        <p className={styles.small}>
          {work.disclaimer} {work.captureNote}
        </p>
      </div>

      <div ref={preview} className={styles.preview} data-visible={hovered !== -1 ? "" : undefined} aria-hidden="true">
        {work.projects.map((project, i) => (
          <div
            key={project.slug}
            className={styles.frame}
            data-active={shown === i ? "" : undefined}
            style={{ "--tint": project.tint } as CSSProperties}
          >
            <img src={`/work/${project.slug}.webp`} width={960} height={600} alt="" loading="lazy" />
            <span className={`${styles.domain} font-regular`}>{project.domain}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
