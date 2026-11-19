import type { Ref } from "react";
import { ArrowIcon } from "@/components/ui/ArrowIcon";
import { storyUi } from "@/content/story";
import type { RingMode, RingText } from "./engine";
import styles from "./StoryRing.module.css";

type Props = {
  /** The engine moves this element with the pointer. */
  ref: Ref<HTMLDivElement>;
  mode: RingMode;
  text: RingText;
};

/** The ring cursor, with a word beside it saying what a click would do. */
export function StoryRing({ ref, mode, text }: Props) {
  return (
    <div ref={ref} className={`${styles.ring} font-regular`} data-mode={mode} aria-hidden="true">
      <span className={styles.text}>
        {text ? storyUi.ring[text] : ""}
        {text === "visit" ? <ArrowIcon /> : null}
      </span>
    </div>
  );
}
