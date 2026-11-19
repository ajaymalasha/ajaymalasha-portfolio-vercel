import type { CSSProperties } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Split } from "@/components/ui/Split";
import { chapters, process, services, type HeadingPart } from "@/content/sections";
import styles from "./ServicesList.module.css";

const delay = (ms: number) => ({ "--reveal-delay": `${ms}ms` }) as CSSProperties;
const number = (i: number) => String(i + 1).padStart(2, "0");

/** The process heading on one line: here it runs the width of the page, so its break is dropped. */
const processTitle: HeadingPart[] = process.title.map((part) =>
  typeof part === "object" && "br" in part ? " " : part,
);

/**
 * The plain version of (02): the services as a grid of cards (an accent panel wipes over the
 * card under the cursor), then the process as a row of steps.
 */
export function ServicesList() {
  return (
    <section id="services" className={styles.services} data-theme="light" data-chapter={chapters.services}>
      <div className={styles.head}>
        <SectionHeader index="02" label={services.label}>
          {services.aside}
        </SectionHeader>
        <div className={styles.lead}>
          <Split as="h2" className={`${styles.intro} font-regular`} parts={services.intro} />
          <div className={styles.slot} data-slot="form" aria-hidden="true" />
        </div>
      </div>

      <ul className={styles.list}>
        {services.items.map((item, i) => (
          <li className={styles.service} data-cursor="hide" data-reveal="" style={delay(i * 80)} key={item.id}>
            <div className={styles.row}>
              <span className={`${styles.index} font-regular`}>{number(i)}</span>
              <h3 className={`${styles.title} font-bold`}>{item.title}</h3>
              <p className={`${styles.desc} ${styles.descBase} font-regular`}>{item.desc}</p>
            </div>
            {/* The same card in the accent colour, uncovered on hover. A copy for the eye only. */}
            <div className={`${styles.row} ${styles.mask}`} aria-hidden="true">
              <span className={`${styles.index} font-regular`}>{number(i)}</span>
              <p className={`${styles.title} font-bold`}>
                <span className={styles.roll}>{item.title}</span>
              </p>
              <p className={`${styles.desc} font-regular`}>{item.desc}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className={styles.how}>
        <Split as="h3" className={`${styles.howTitle} font-bold`} parts={processTitle} proximity />
        <ol className={styles.steps}>
          {process.steps.map((step, i) => (
            <li className={styles.step} data-reveal="" style={delay(i * 70)} key={step.id}>
              <span className={`${styles.stepIndex} font-regular`}>{number(i)}</span>
              <span className={`${styles.stepName} font-semibold`}>{step.title}</span>
              <span className={`${styles.stepDesc} font-regular`}>{step.desc}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
