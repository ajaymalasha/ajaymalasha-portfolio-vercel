"use client";

import { useEffect, useRef, useState, type CSSProperties, type FocusEvent, type KeyboardEvent } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { chapters, method } from "@/content/sections";
import { prefersReducedMotion } from "@/lib/device";
import styles from "./Method.module.css";

/** How long the principle on show takes to leave before the next one comes in (matches the CSS). */
const LEAVE_MS = 250;

const tabId = (i: number) => `method-tab-${i}`;

/**
 * (06) How I work: one principle at a time, chosen from the round tabs on the left. It moves on
 * by itself when the line under it fills, and waits while it is hovered, focused, off screen or
 * when the visitor prefers reduced motion (the line is a CSS animation, paused in those cases).
 */
export function Method() {
  const items = method.items;
  /** The selected tab: changes at once, so the tabs and the line respond immediately. */
  const [active, setActive] = useState(0);
  /** The principle in the panel: follows `active` once the previous one has left. */
  const [shown, setShown] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [seen, setSeen] = useState(false);
  const section = useRef<HTMLElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const swap = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const element = section.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setSeen(entry.isIntersecting), { threshold: 0.3 });
    observer.observe(element);
    return () => {
      observer.disconnect();
      clearTimeout(swap.current);
    };
  }, []);

  const select = (index: number) => {
    if (index === active) return;
    setActive(index);
    clearTimeout(swap.current);
    if (prefersReducedMotion()) {
      setShown(index);
      setLeaving(false);
      return;
    }
    setLeaving(true);
    swap.current = setTimeout(() => {
      setShown(index);
      setLeaving(false);
    }, LEAVE_MS);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const last = items.length - 1;
    const next =
      event.key === "ArrowDown" || event.key === "ArrowRight"
        ? (active + 1) % items.length
        : event.key === "ArrowUp" || event.key === "ArrowLeft"
          ? (active + last) % items.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : -1;
    if (next < 0) return;
    event.preventDefault();
    select(next);
    tabs.current[next]?.focus();
  };

  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
  };

  const item = items[shown];

  return (
    <section ref={section} id="method" className={styles.section} data-theme="light" data-chapter={chapters.method}>
      <SectionHeader index="06" label={method.label}>
        {method.aside}
      </SectionHeader>

      <div
        className={styles.grid}
        onPointerEnter={(event) => event.pointerType === "mouse" && setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onFocus={(event) => setFocused(event.target.matches(":focus-visible"))}
        onBlur={onBlur}
      >
        <div
          className={styles.thumbs}
          role="tablist"
          aria-label={method.label}
          onKeyDown={onKeyDown}
          data-reveal=""
          style={{ "--reveal-delay": "80ms", "--index": active } as CSSProperties}
        >
          <span className={styles.pointer} aria-hidden="true" />
          {items.map((entry, i) => (
            <button
              key={entry.tab}
              ref={(node) => {
                tabs.current[i] = node;
              }}
              type="button"
              id={tabId(i)}
              className={`${styles.thumb} fill font-semibold`}
              role="tab"
              aria-selected={i === active}
              aria-controls="method-panel"
              tabIndex={i === active ? 0 : -1}
              onClick={() => select(i)}
            >
              <span aria-hidden="true">{entry.tab}</span>
              <span className="visually-hidden">{entry.pull}</span>
            </button>
          ))}
        </div>

        <div className={styles.body} data-reveal="" style={{ "--reveal-delay": "160ms" } as CSSProperties}>
          <div
            key={shown}
            id="method-panel"
            className={styles.panel}
            role="tabpanel"
            aria-labelledby={tabId(shown)}
            data-leaving={leaving}
          >
            <p className={`${styles.pull} font-bold`}>
              <span className="visually-hidden">{item.pull}</span>
              {item.pull.split(" ").map((word, w) => (
                <span key={w} className={styles.pullWord} style={{ "--w": w } as CSSProperties} aria-hidden="true">
                  {word}
                </span>
              ))}
            </p>
            <p className={`${styles.text} font-regular`}>
              <span className="visually-hidden">{item.body}</span>
              {item.body.split(" ").map((word, w) => (
                <span key={w} aria-hidden="true">
                  <span className={styles.word} style={{ "--w": w } as CSSProperties}>
                    {word}
                  </span>{" "}
                </span>
              ))}
            </p>
            <p className={styles.caption}>
              <span className={`${styles.captionTitle} font-semibold`}>{item.caption}</span>
              <span className={`${styles.captionNote} font-regular`}>{item.note}</span>
            </p>
          </div>

          <div className={styles.progress} aria-hidden="true">
            <span
              key={active}
              className={styles.bar}
              data-paused={hovered || focused || !seen}
              onAnimationEnd={() => select((active + 1) % items.length)}
            />
          </div>
        </div>

        <div className={styles.slot} data-slot="form" aria-hidden="true" />
      </div>
    </section>
  );
}
