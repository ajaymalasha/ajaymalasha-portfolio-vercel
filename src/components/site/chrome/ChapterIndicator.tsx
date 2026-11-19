"use client";

import { useEffect, useState } from "react";
import { chapter } from "@/lib/experience";
import { useStore } from "@/lib/store";
import styles from "./ChapterIndicator.module.css";

const SWAP_OUT_MS = 200;
const FADE_OUT_MS = 400;

/**
 * The name of the section on screen, written up the bottom-left corner. The label on show trails
 * the real one by the length of its leaving animation, so the old text can slide away before the
 * new one slides in (and the whole thing can fade when there is no label at all).
 */
export function ChapterIndicator() {
  const current = useStore(chapter, "");
  const [shown, setShown] = useState("");

  useEffect(() => {
    if (current === shown) return;
    const wait = !shown ? 0 : current ? SWAP_OUT_MS : FADE_OUT_MS;
    const timer = window.setTimeout(() => setShown(current), wait);
    return () => window.clearTimeout(timer);
  }, [current, shown]);

  const visible = Boolean(current && shown);
  const swapping = visible && current !== shown;

  return (
    <div className={`${styles.chapter} font-regular`} data-visible={visible || undefined} aria-hidden="true">
      <span className={styles.dot} />
      <span key={shown} className={styles.text} data-leaving={swapping || undefined}>
        {shown}
      </span>
    </div>
  );
}
