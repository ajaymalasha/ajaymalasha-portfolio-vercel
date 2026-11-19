import styles from "./SoundBars.module.css";

/** Four small level bars: flat when the sound is off, bouncing when it is on. */
export function SoundBars({ on }: { on: boolean }) {
  return (
    <span className={styles.bars} data-on={on || undefined} aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}
