import type { ReactNode } from "react";
import { Scramble } from "./Scramble";
import styles from "./SectionHeader.module.css";

/**
 * The rule across the top of a section: its number, its name, and a remark on the right.
 * The number and name settle out of scrambled glyphs the first time they are seen.
 */
export function SectionHeader({ index, label, children }: { index: string; label: string; children?: ReactNode }) {
  return (
    <header className={styles.header} data-reveal="" data-section-header="">
      <span className={`${styles.index} font-regular`}>
        <Scramble text={`(${index})`} />
      </span>
      <p className={`section-label ${styles.label}`}>
        <Scramble text={label} />
      </p>
      {children ? <p className={`${styles.aside} font-regular`}>{children}</p> : null}
    </header>
  );
}
