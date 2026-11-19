"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StageSkip } from "@/components/ui/StageSkip";
import { chapters, services } from "@/content/sections";
import { scrollToTarget } from "@/lib/scroll";
import { stageIndex } from "@/lib/stage";
import { useStore } from "@/lib/store";
import { useTicker } from "@/lib/ticker";
import styles from "./ServicesStage.module.css";

const items = services.items;
/** How long the outgoing title takes to leave before the next one comes in. Matches the CSS. */
const LEAVE_MS = 180;

/**
 * (02) What I do, pinned: the page holds still while scrolling steps through the services, one
 * big title at a time, with that service's dot drawing beside it (drawn by the dot stage into
 * the empty slot). The rail along the bottom shows where you are and jumps to any step.
 */
export function ServicesStage() {
  const section = useRef<HTMLElement>(null);
  const index = useStore(stageIndex.services, 0);
  // The copy on show trails the index: the old title leaves first, then the new one enters.
  const [shown, setShown] = useState(index);
  const leaving = shown !== index;

  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => setShown(index), LEAVE_MS);
    return () => clearTimeout(timer);
  }, [index, leaving]);

  // The dot stage works the index out the same way; whichever runs first, they agree.
  useTicker(() => {
    const element = section.current;
    if (!element) return;
    const box = element.getBoundingClientRect();
    const travel = box.height - window.innerHeight;
    if (travel <= 0) return;
    const progress = Math.min(0.999, Math.max(0, -box.top / travel));
    const next = Math.floor(progress * items.length);
    if (next !== stageIndex.services.get()) stageIndex.services.set(next);
  });

  const goTo = (step: number) => {
    const element = section.current;
    if (!element) return;
    const top = element.getBoundingClientRect().top + window.scrollY;
    const travel = element.offsetHeight - window.innerHeight;
    scrollToTarget(top + ((step + 0.5) / items.length) * travel, { duration: 1 });
  };

  const item = items[Math.min(shown, items.length - 1)];

  return (
    <section
      ref={section}
      id="services"
      className={styles.section}
      style={{ "--count": items.length } as CSSProperties}
      data-theme="light"
      data-chapter={chapters.services}
    >
      <div className={styles.stage}>
        <SectionHeader index="02" label={services.label}>
          {services.aside}
        </SectionHeader>

        <div className={`${styles.main} grid-12`}>
          <div className={styles.copy}>
            <h2 className={`${styles.intro} font-regular`}>{services.intro}</h2>
            <div className={`${styles.active} ${leaving ? styles.leaving : ""}`} key={item.id}>
              <h3 className={`${styles.title} font-bold`}>{item.title}</h3>
              <p className={`${styles.desc} font-regular`}>{item.desc}</p>
            </div>
          </div>
          <div className={styles.slot} data-slot="services" aria-hidden="true" />
        </div>

        <ol className={`${styles.rail} grid-12 font-regular`}>
          {items.map((entry, i) => (
            <li className={i === index ? styles.isActive : i < index ? styles.isPast : undefined} key={entry.id}>
              <button
                type="button"
                className={styles.step}
                aria-current={i === index ? "step" : undefined}
                onClick={() => goTo(i)}
              >
                <span className={styles.num}>{String(i + 1).padStart(2, "0")}</span> {entry.title}
              </button>
            </li>
          ))}
        </ol>

        <StageSkip />
      </div>
    </section>
  );
}
