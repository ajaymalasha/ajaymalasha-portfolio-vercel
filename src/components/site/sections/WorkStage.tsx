"use client";

import { useRef, type CSSProperties } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StageSkip } from "@/components/ui/StageSkip";
import { chapters, work } from "@/content/sections";
import { stageIndex } from "@/lib/stage";
import { useStore } from "@/lib/store";
import { useTicker } from "@/lib/ticker";
import styles from "./WorkStage.module.css";

/** Every storefront listed is on the same platform; the content file has no field for it. */
const PLATFORM = "Shopify";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Selected work on laptops and up: the page holds still while the storefronts go by one at a
 * time. The dot layer draws the current one's capture across the whole screen (in the slot);
 * this component is the copy over it.
 */
export function WorkStage() {
  const section = useRef<HTMLElement>(null);
  const active = useStore(stageIndex.work, 0);
  const count = work.projects.length;
  const current = work.projects[Math.min(active, count - 1)];

  // The dot layer writes the same value from the same sum. Doing it here too means the copy
  // still follows the scroll if that layer is late to load, or never does.
  useTicker(() => {
    const element = section.current;
    if (!element) return;
    const box = element.getBoundingClientRect();
    const travel = box.height - window.innerHeight;
    if (travel <= 0) return;
    const progress = Math.min(0.999, Math.max(0, -box.top / travel));
    const index = Math.floor(progress * count);
    if (index !== stageIndex.work.get()) stageIndex.work.set(index);
  });

  return (
    <section
      ref={section}
      id="work"
      className={styles.section}
      data-theme="dark"
      data-chapter={chapters.work}
      style={{ "--count": count } as CSSProperties}
    >
      <div className={styles.stage}>
        {/* The whole picture is a way to the storefront for the mouse; the name below is the
            same link for the keyboard and for assistive technology. */}
        <a
          href={current.url}
          target="_blank"
          rel="noopener"
          className={styles.slot}
          data-slot="work"
          data-cursor-label={work.visit}
          tabIndex={-1}
          aria-hidden="true"
        />
        <div className={styles.scrim} aria-hidden="true" />

        <div className={styles.top}>
          <SectionHeader index="03" label={work.label}>
            {work.aside}
          </SectionHeader>
        </div>

        <div className={`${styles.foot} grid-12`}>
          <div className={styles.names}>
            <h2 className={`${styles.heading} font-regular`}>
              {work.headingPlain} {/* The count is for the eye: the list below already says where in it we are. */}
              <span className={styles.count} aria-hidden="true">
                {pad(active + 1)} / {pad(count)}
              </span>
            </h2>
            <ol className={styles.list}>
              {work.projects.map((project, i) => (
                <li key={project.slug} className={styles.item} data-active={active === i ? "" : undefined}>
                  <a
                    href={project.url}
                    target="_blank"
                    rel="noopener"
                    className={`${styles.name} font-bold`}
                    tabIndex={active === i ? 0 : -1}
                  >
                    {project.name}
                  </a>
                </li>
              ))}
            </ol>
          </div>

          <div className={styles.side} data-over-dots="">
            <div className={`${styles.details} font-regular`}>
              {work.projects.map((project, i) => (
                <div
                  key={project.slug}
                  className={styles.detail}
                  data-active={active === i ? "" : undefined}
                  aria-hidden={active !== i}
                >
                  <p className={styles.meta}>
                    {project.sector} · {PLATFORM} · {work.with.replace("{studio}", project.team.studio)}
                  </p>
                  <p className={styles.brief}>{project.brief}</p>
                </div>
              ))}
            </div>
            <p className={`${styles.also} font-regular`}>{work.also}</p>
            <p className={`${styles.small} font-regular`}>
              {work.disclaimer} {work.captureNote}
            </p>
          </div>
        </div>

        <StageSkip />
      </div>
    </section>
  );
}
