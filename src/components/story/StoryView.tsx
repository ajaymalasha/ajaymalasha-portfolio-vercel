"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowIcon } from "@/components/ui/ArrowIcon";
import { briefHref, site } from "@/content/site";
import { chapters, storyUi } from "@/content/story";
import { setSoundAllowed } from "@/lib/audio";
import { hasFinePointer } from "@/lib/device";
import { switchVersion } from "@/lib/experience";
import { PORTRAIT_URL } from "@/lib/particle-kit";
import { createStore, useStore } from "@/lib/store";
import { createStory, INITIAL_UI, type Story, type StoryUi } from "./engine";
import { StoryCard } from "./StoryCard";
import { StoryRail } from "./StoryRail";
import { StoryRing } from "./StoryRing";
import { TRACK_VH } from "./staging";
import styles from "./StoryView.module.css";

const two = (n: number) => String(n).padStart(2, "0");

/**
 * The 3D story: one cloud of dots that takes a new shape for each chapter as the page scrolls,
 * with the chapter's text bottom left. This component is the markup; the scene, the scroll
 * maths and the pointer are in ./engine. Loaded in the browser only (see components/app/App).
 */
export function StoryView() {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const reveal = useRef<HTMLDivElement>(null);
  const story = useRef<Story | null>(null);

  const [store] = useState(() => createStore<StoryUi>(INITIAL_UI));
  const [fine] = useState(hasFinePointer);
  const ui = useStore(store);

  useEffect(() => {
    if (!root.current || !canvas.current || !labels.current || !card.current || !ring.current || !reveal.current)
      return;
    const running = createStory(
      {
        root: root.current,
        canvas: canvas.current,
        labels: labels.current,
        card: card.current,
        ring: ring.current,
        reveal: reveal.current,
      },
      store,
    );
    story.current = running;
    // The soundtrack belongs to the story: it may play while this is on screen, and not after.
    setSoundAllowed(true);
    return () => {
      story.current = null;
      running.dispose();
      setSoundAllowed(false);
    };
  }, [store]);

  return (
    <div ref={root} className={`${styles.story} ${ui.dragging ? styles.dragging : ""}`}>
      <canvas ref={canvas} className={styles.canvas} aria-hidden="true" />

      <div ref={reveal} className={styles.reveal} aria-hidden="true">
        {/* A plain img: it is resized every frame to sit exactly under the dots. */}
        {ui.live ? <img src={PORTRAIT_URL} alt="" draggable={false} /> : null}
      </div>

      <div ref={labels} className={styles.labels} aria-hidden="true">
        {ui.labels.map((label, index) => (
          <span
            key={`${ui.chapter}-${index}`}
            className={`${styles.label} ${label === ui.hot ? styles.labelHot : ""} font-regular`}
          >
            {label.text}
          </span>
        ))}
      </div>

      <StoryCard ref={card} card={ui.card} visible={!!ui.hot} finePointer={fine} />
      <StoryRing ref={ring} mode={ui.ring} text={ui.ringText} />

      <header className={`${styles.top} font-regular`}>
        <h1 className={styles.brand}>
          {site.name} <em>· {storyUi.brand}</em>
        </h1>
        <button
          type="button"
          className={`${styles.skip} t-link font-regular`}
          data-ring="text"
          data-magnet="off"
          onClick={(event) => switchVersion("site", event.currentTarget)}
        >
          <span className="link-text">{storyUi.skip}</span>
          <ArrowIcon className="link-arrow" dir="e" />
        </button>
      </header>

      <main id="main" className={styles.chapters}>
        {chapters.map((chapter, index) => {
          const current = ui.chapter === index;
          return (
            <article
              key={chapter.id}
              className={`${styles.chapter} ${current && ui.settled ? styles.active : ""}`}
              aria-current={current ? "step" : undefined}
            >
              <span className={`${styles.ghost} font-bold`} aria-hidden="true">
                {two(index)}
              </span>
              <p className={`${styles.kicker} font-regular`}>
                <span className={styles.index}>{two(index)}</span> {chapter.kicker}
              </p>
              <h2 className={`${styles.title} font-bold`} aria-label={chapter.title}>
                {chapter.title.split(" ").map((word, w) => (
                  <span key={w} className={styles.wordMask} aria-hidden="true">
                    <span className={styles.word} style={{ "--w": w } as CSSProperties}>
                      {word}
                    </span>
                  </span>
                ))}
              </h2>
              <p className={`${styles.body} font-regular`}>{chapter.body}</p>
              {chapter.hint ? (
                <p className={`${styles.hint} font-regular`}>
                  <span className={styles.hintDot} aria-hidden="true" />
                  {fine ? chapter.hint.hover : chapter.hint.tap}
                </p>
              ) : null}
              {index === chapters.length - 1 ? (
                <div className={styles.actions}>
                  <a href={briefHref} className={`${styles.cta} btn-primary font-regular`} data-magnetic="0.35">
                    <span>{storyUi.cta}</span>
                    <ArrowIcon className="btn-arrow" />
                  </a>
                  <button
                    type="button"
                    className={`${styles.secondary} t-link font-regular`}
                    data-ring="text"
                    data-magnet="off"
                    onClick={(event) => switchVersion("site", event.currentTarget)}
                  >
                    <span className="link-text">{storyUi.explore}</span>
                    <ArrowIcon className="link-arrow" dir="e" />
                  </button>
                </div>
              ) : null}
            </article>
          );
        })}
      </main>

      <StoryRail chapters={chapters} active={ui.chapter} onGo={(index) => story.current?.goTo(index)} />

      <p className={`${styles.scrollHint} ${ui.begun ? styles.scrollHintGone : ""} font-regular`} aria-hidden="true">
        {storyUi.scroll}
        <span className={styles.scrollLine} />
      </p>

      <div className={styles.track} style={{ height: `${TRACK_VH}vh` }} />
    </div>
  );
}
