"use client";

import { useRef, type CSSProperties } from "react";
import { Split } from "@/components/ui/Split";
import { StageSkip } from "@/components/ui/StageSkip";
import { chapters, process } from "@/content/sections";
import { stageIndex } from "@/lib/stage";
import { useStore } from "@/lib/store";
import { useTicker } from "@/lib/ticker";
import styles from "./ProcessStage.module.css";

const steps = process.steps;

/**
 * How the work goes, pinned: scrolling walks through the steps along the bottom while the dot
 * stage draws each one into the slot on the left.
 */
export function ProcessStage() {
  const section = useRef<HTMLElement>(null);
  const index = useStore(stageIndex.process, 0);

  // The dot stage works the index out the same way; whichever runs first, they agree.
  useTicker(() => {
    const element = section.current;
    if (!element) return;
    const box = element.getBoundingClientRect();
    const travel = box.height - window.innerHeight;
    if (travel <= 0) return;
    const progress = Math.min(0.999, Math.max(0, -box.top / travel));
    const next = Math.floor(progress * steps.length);
    if (next !== stageIndex.process.get()) stageIndex.process.set(next);
  });

  return (
    <section
      ref={section}
      id="process"
      className={styles.section}
      style={{ "--count": steps.length } as CSSProperties}
      data-theme="dark"
      data-chapter={chapters.services}
    >
      <div className={styles.stage}>
        <div className={`${styles.top} grid-12`}>
          <Split as="h2" className={`${styles.title} font-bold`} parts={process.title} proximity />
          <div className={styles.slot} data-slot="process" aria-hidden="true" />
        </div>

        <ol className={`${styles.steps} grid-12 font-regular`}>
          {steps.map((step, i) => (
            <li
              className={`${styles.step} ${i === index ? styles.isActive : i < index ? styles.isPast : ""}`}
              aria-current={i === index ? "step" : undefined}
              key={step.id}
            >
              <span className={styles.num}>{String(i + 1).padStart(2, "0")}</span>
              <span className={`${styles.name} font-semibold`}>{step.title}</span>
              <span className={styles.desc}>{step.desc}</span>
            </li>
          ))}
        </ol>

        <StageSkip />
      </div>
    </section>
  );
}
