"use client";

import type { CSSProperties } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Split } from "@/components/ui/Split";
import { chapters, offClock } from "@/content/sections";
import { useClock } from "@/lib/clock";
import styles from "./OffClock.module.css";

type Clock = (typeof offClock.clocks)[number];

/** One city and the time there. The time is empty until the page is live (see useClock). */
function ClockRow({ clock }: { clock: Clock }) {
  const time = useClock(clock.timeZone);
  return (
    <li className={styles.clock}>
      <span className={styles.place}>
        <span className={`${styles.city} font-semibold`}>
          <span className={styles.live} aria-hidden="true" />
          {clock.city}
        </span>
        <span className={`${styles.clockNote} font-regular`}>{clock.note}</span>
      </span>
      <span className={`${styles.time} font-semibold`}>{time || "\u00a0"}</span>
    </li>
  );
}

/**
 * (07) Off the clock: the two time zones he works across, and what he does away from the desk.
 * A client component only because the clocks tick; everything else is plain text.
 */
export function OffClock() {
  return (
    <section id="off-clock" className={styles.section} data-theme="light" data-chapter={chapters.off}>
      <header>
        <SectionHeader index="07" label={offClock.label}>
          {offClock.aside}
        </SectionHeader>
        <div className={`${styles.lead} grid-12`}>
          <Split parts={offClock.heading} lines={false} as="h2" className={`${styles.heading} font-bold`} proximity />
          <div className={styles.slot} data-slot="form" aria-hidden="true" />
        </div>
      </header>

      <div className={`${styles.columns} grid-12`}>
        <div data-reveal="" style={{ "--reveal-delay": "80ms" } as CSSProperties}>
          <p className={`section-label ${styles.label}`}>{offClock.clocksLabel}</p>
          <ul className={styles.clocks}>
            {offClock.clocks.map((clock) => (
              <ClockRow key={clock.timeZone} clock={clock} />
            ))}
          </ul>
          <p className={`${styles.clocksNote} font-regular`}>{offClock.clocksNote}</p>
        </div>

        <div data-reveal="" style={{ "--reveal-delay": "160ms" } as CSSProperties}>
          <p className={`section-label ${styles.label}`}>{offClock.listLabel}</p>
          <ul className={styles.pursuits}>
            {offClock.pursuits.map((pursuit) => (
              <li key={pursuit.title} className={styles.pursuit}>
                <span className={`${styles.title} font-semibold`}>{pursuit.title}</span>
                {"tag" in pursuit ? <em className={`${styles.tag} font-bold`}>{pursuit.tag}</em> : null}
                <span className={`${styles.note} font-regular`}>{pursuit.note}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
