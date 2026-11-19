"use client";

import { useEffect, useRef } from "react";
import { ArrowIcon } from "@/components/ui/ArrowIcon";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Split } from "@/components/ui/Split";
import { building, chapters } from "@/content/sections";
import { still } from "@/lib/device";
import { stageIndex } from "@/lib/stage";
import { useStore } from "@/lib/store";
import styles from "./BuildingStage.module.css";

/** How long each panel stays open when nobody is touching them: time for its drawing to play. */
const CYCLE_MS = 7500;

/**
 * The features shipped at Kinect AI, on laptops and up: three columns, one open and flooded
 * with the accent, the others slim with their names on end. The dot layer flies to the open
 * one and draws how that feature works. A panel opens on hover, focus or click, and the open
 * one moves along by itself while the section is on screen and left alone.
 */
export function BuildingStage() {
  const section = useRef<HTMLElement>(null);
  const held = useRef(false);
  const open = useStore(stageIndex.building, 0);
  const show = (i: number) => stageIndex.building.set(i);

  useEffect(() => {
    const element = section.current;
    if (!element) return;
    let inView = false;
    let openedAt = performance.now();

    const observer = new IntersectionObserver(([entry]) => (inView = entry.isIntersecting), { threshold: 0.5 });
    observer.observe(element);
    // Any change, by hand or by the cycle, gives the new panel its full time.
    const unsubscribe = stageIndex.building.subscribe(() => (openedAt = performance.now()));
    const timer = window.setInterval(() => {
      const time = performance.now();
      if (!inView) openedAt = time;
      else if (!held.current && !still.get() && time - openedAt > CYCLE_MS) {
        stageIndex.building.set((i) => (i + 1) % building.items.length);
      }
    }, 250);

    return () => {
      observer.disconnect();
      unsubscribe();
      window.clearInterval(timer);
    };
  }, []);

  return (
    <section ref={section} id="building" className={styles.section} data-theme="dark" data-chapter={chapters.building}>
      <header className={styles.head}>
        <SectionHeader index="04" label={building.label}>
          {building.aside}
        </SectionHeader>
        <Split parts={building.heading} as="h2" className={`${styles.title} font-bold`} proximity />
      </header>

      <ul
        className={styles.panels}
        onMouseEnter={() => (held.current = true)}
        onMouseLeave={() => (held.current = false)}
      >
        {building.items.map((item, i) => {
          const isOpen = open === i;
          return (
            <li
              key={item.id}
              className={styles.panel}
              data-panel=""
              data-open={isOpen ? "true" : "false"}
              onMouseEnter={() => show(i)}
              onFocus={() => show(i)}
            >
              {/* Shut: the name on end. */}
              <button type="button" className={styles.shut} aria-expanded={isOpen} onClick={() => show(i)}>
                <span className={`${styles.num} font-regular`} aria-hidden="true">
                  0{i + 1}
                </span>
                <span className={`${styles.spine} font-bold`}>{item.name}</span>
                <span className={styles.dot} aria-hidden="true" />
              </button>

              {/* Open: laid out at the open width from the start, so nothing reflows as the column grows. */}
              <div className={styles.open} aria-hidden={!isOpen}>
                <div className={styles.top}>
                  <h3 className={`${styles.name} font-bold`}>{item.name}</h3>
                  <span className={`${styles.num} font-regular`}>0{i + 1}</span>
                </div>
                <div className={styles.body}>
                  <div className={`${styles.copy} font-regular`}>
                    <p className={styles.pitch}>{item.pitch}</p>
                    <ul className={styles.parts} aria-label={building.partsLabel}>
                      {item.parts.map((part) => (
                        <li key={part}>{part}</li>
                      ))}
                    </ul>
                    <p className={styles.status}>
                      <span className={styles.state}>
                        <span className={styles.live} aria-hidden="true" />
                        {item.kind} · {item.status}
                      </span>
                      <a
                        href={building.url}
                        target="_blank"
                        rel="noopener"
                        className={styles.visit}
                        tabIndex={isOpen ? 0 : -1}
                      >
                        {building.visit} <ArrowIcon className={styles.arrow} />
                      </a>
                    </p>
                  </div>
                  <div className={styles.slot} data-slot="apps" aria-hidden="true" />
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className={`${styles.notes} font-regular`}>
        <p>{building.also}</p>
        <p>{building.stackLine}</p>
        <p className={styles.small}>{building.disclaimer}</p>
      </div>
    </section>
  );
}
