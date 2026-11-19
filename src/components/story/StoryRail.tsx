import { storyUi, type Chapter } from "@/content/story";
import styles from "./StoryRail.module.css";

type Props = { chapters: Chapter[]; active: number; onGo: (index: number) => void };

/** The ticks down the right edge: one per chapter, click to go there. */
export function StoryRail({ chapters, active, onGo }: Props) {
  return (
    <nav className={styles.rail} aria-label={storyUi.chapters}>
      {chapters.map((chapter, index) => (
        <button
          key={chapter.id}
          type="button"
          className={[styles.tick, index === active ? styles.current : "", index < active ? styles.past : ""].join(" ")}
          aria-label={storyUi.chapter.replace("{n}", String(index)).replace("{title}", chapter.title)}
          aria-current={index === active ? "step" : undefined}
          data-ring="tick"
          data-magnet="off"
          onClick={() => onGo(index)}
        >
          <span className={styles.mark} />
          <span className={`${styles.name} font-regular`}>{chapter.kicker}</span>
        </button>
      ))}
    </nav>
  );
}
