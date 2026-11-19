import type { Ref } from "react";
import { ArrowIcon } from "@/components/ui/ArrowIcon";
import { site } from "@/content/site";
import { storyUi } from "@/content/story";
import { useClock } from "@/lib/clock";
import styles from "./StoryCard.module.css";
import type { StoryLabel } from "./shapes";

function LocalTime({ timeZone }: { timeZone: string }) {
  const time = useClock(timeZone, undefined, site.home.locale);
  return (
    <p className={styles.meta}>
      <i className={styles.live} />
      {time} {storyUi.localTime}
    </p>
  );
}

type Props = {
  /** The engine moves this element next to the thing it describes. */
  ref: Ref<HTMLDivElement>;
  card: StoryLabel | null;
  visible: boolean;
  finePointer: boolean;
};

/** What the hovered (or tapped) thing is: name, a line of detail, and its clock or link if it has one. */
export function StoryCard({ ref, card, visible, finePointer }: Props) {
  return (
    <div ref={ref} className={`${styles.card} ${visible ? styles.visible : ""} font-regular`} aria-live="polite">
      {card ? (
        <>
          <p className={`${styles.title} font-semibold`}>{card.text}</p>
          <p className={styles.detail}>{card.detail}</p>
          {card.timeZone ? <LocalTime timeZone={card.timeZone} /> : null}
          {card.href ? (
            <p className={`${styles.meta} ${styles.open}`}>
              {finePointer ? storyUi.clickVisit : storyUi.tapVisit}
              <ArrowIcon />
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
