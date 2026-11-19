"use client";

import { useState, type CSSProperties } from "react";
import { ArrowIcon } from "@/components/ui/ArrowIcon";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Split } from "@/components/ui/Split";
import { building, chapters } from "@/content/sections";
import styles from "./BuildingList.module.css";

const pad = (n: number) => String(n).padStart(2, "0");
const delay = (ms: number) => ({ "--reveal-delay": `${ms}ms` }) as CSSProperties;

/**
 * The features shipped at Kinect AI, as a plain list: three columns on a laptop without the
 * dot stage, one column on tablets and phones. The features live inside one product, so the
 * rows are not links: the one link, to the company, sits under the heading.
 */
export function BuildingList() {
  const [hovered, setHovered] = useState(-1);

  return (
    <section id="building" className={styles.building} data-theme="dark" data-chapter={chapters.building}>
      <header>
        <SectionHeader index="04" label={building.label}>
          {building.aside}
        </SectionHeader>
        <div className={styles.lead}>
          <div>
            <Split parts={building.heading} as="h2" className={`${styles.heading} font-bold`} proximity />
            <a
              href={building.url}
              target="_blank"
              rel="noopener"
              className={`t-link font-regular ${styles.visit}`}
              data-reveal=""
              style={delay(150)}
            >
              <span className="link-text">{building.visit}</span>
              <ArrowIcon className="link-arrow link-arrow--out" />
            </a>
          </div>
          <div data-slot="form" aria-hidden="true" />
        </div>
      </header>

      <ol className={styles.index} data-hover={hovered !== -1 ? "" : undefined} onMouseLeave={() => setHovered(-1)}>
        {building.items.map((item, i) => (
          <li
            key={item.id}
            className={styles.item}
            data-hovered={hovered === i ? "" : undefined}
            data-reveal=""
            style={delay(i * 70)}
          >
            <div className={styles.row} onMouseEnter={() => setHovered(i)}>
              <span className={`${styles.rowIndex} font-regular`}>{pad(i + 1)}</span>
              <div className={styles.rowTitle}>
                <h3 className={`${styles.rowName} font-bold`}>{item.name}</h3>
                <p className={`${styles.rowPitch} font-regular`}>{item.pitch}</p>
                <ul className={`${styles.parts} font-regular`} aria-label={building.partsLabel}>
                  {item.parts.map((part) => (
                    <li key={part} className={styles.part}>
                      {part}
                    </li>
                  ))}
                </ul>
              </div>
              <p className={`${styles.rowInfo} font-regular`}>
                <span className={styles.rowKind}>{item.kind}</span>
                <span className={styles.rowStatus}>
                  <span className={styles.rowDot} aria-hidden="true" />
                  {item.status}
                </span>
              </p>
            </div>
          </li>
        ))}
      </ol>

      <div className={`${styles.notes} font-regular`} data-reveal="">
        <p>{building.also}</p>
        <p>{building.stackLine}</p>
        <p className={styles.small}>{building.disclaimer}</p>
      </div>
    </section>
  );
}
