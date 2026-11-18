"use client";

import { stage } from "@/content/sections";
import { scrollToTarget } from "@/lib/scroll";
import { ArrowIcon } from "./ArrowIcon";
import styles from "./StageSkip.module.css";

/**
 * "Skip to the next section", at the foot of every pinned stage: a stage holds the page for
 * several screens of scrolling, and nobody should have to scroll through one to get past it.
 */
export function StageSkip() {
  const skip = (event: React.MouseEvent<HTMLButtonElement>) => {
    const section = event.currentTarget.closest("section");
    const next = section?.nextElementSibling;
    if (next instanceof HTMLElement) scrollToTarget(next, { duration: 1.4 });
  };
  return (
    <button type="button" className={`t-link font-regular ${styles.skip}`} onClick={skip}>
      <span className="link-text">{stage.skip}</span>
      <ArrowIcon dir="se" className="link-arrow" />
    </button>
  );
}
