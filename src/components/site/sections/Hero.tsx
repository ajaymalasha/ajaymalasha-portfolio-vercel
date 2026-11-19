"use client";

import { useEffect, useRef, type CSSProperties, type MouseEvent } from "react";
import { ArrowIcon } from "@/components/ui/ArrowIcon";
import { Split } from "@/components/ui/Split";
import { hero } from "@/content/sections";
import { site } from "@/content/site";
import { prefersReducedMotion, still } from "@/lib/device";
import { onScroll, scrollToTarget } from "@/lib/scroll";
import { now, useTicker } from "@/lib/ticker";
import { HomeGlobe } from "./HomeGlobe";
import styles from "./Hero.module.css";

/** The hero holds still for the first few px of scrolling, then leaves over part of a screen. */
const LEAVE_AFTER = 100;
const LEAVE_OVER = { desktop: 0.55, tablet: 0.32 }; // share of the viewport height
/** Px the name line travels per frame. */
const MARQUEE_SPEED = 1;
const RUNS = 2;
const NAMES_PER_RUN = 8;
/** Characters in the headline's longer line: the stylesheet sizes the type so that line fits its column. */
const LONGEST_LINE = Math.max(...hero.title.map((line) => line.length));

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * The first screen: where he is (globe, clock) on the left, the portrait in the middle, the
 * headline and actions on the right, and his name running along the bottom. The portrait box is
 * empty: the particle cloud draws the portrait into it, and later lands on the name line.
 * As the page scrolls away, the copy leaves piece by piece.
 */
export function Hero() {
  const location = useRef<HTMLDivElement>(null);
  const right = useRef<HTMLDivElement>(null);
  const arrow = useRef<HTMLSpanElement>(null);
  const lead = useRef<HTMLParagraphElement>(null);
  const actions = useRef<HTMLDivElement>(null);
  const marquee = useRef<HTMLDivElement>(null);
  const motion = useRef({
    words: [] as HTMLElement[],
    progress: -1,
    scroll: 0,
    offset: 0,
    direction: -1,
    tablet: false,
    coarse: false,
    reduced: false,
  });

  useEffect(() => {
    const state = motion.current;
    state.tablet = window.matchMedia("(max-width: 1023px)").matches;
    state.coarse = window.matchMedia("(pointer: coarse)").matches;
    state.reduced = prefersReducedMotion();
    state.scroll = window.scrollY;
    // The name line runs against the scroll: left while scrolling down, right while scrolling up.
    return onScroll(({ direction }) => {
      if (direction) state.direction = -direction;
    });
  }, []);

  const leave = () => {
    const state = motion.current;
    const [locationEl, rightEl, arrowEl, leadEl, actionsEl] = [
      location.current,
      right.current,
      arrow.current,
      lead.current,
      actions.current,
    ];
    if (!locationEl || !rightEl || !arrowEl || !leadEl || !actionsEl) return;

    // Touch scrolling arrives in bursts, so it is smoothed here; anything else is already smooth.
    state.scroll = state.coarse ? state.scroll + (now.scrollY - state.scroll) * 0.14 : now.scrollY;
    const behind = Math.abs(now.scrollY - state.scroll);
    if (behind < 0.5 || behind > window.innerHeight) state.scroll = now.scrollY;

    const span = window.innerHeight * (state.tablet ? LEAVE_OVER.tablet : LEAVE_OVER.desktop);
    const progress = clamp01((state.scroll - LEAVE_AFTER) / span);
    if (progress === state.progress) return;
    state.progress = progress;

    // Once gone, the actions must not be reachable by keyboard or pointer.
    actionsEl.style.visibility = progress === 1 ? "hidden" : "";
    if (state.reduced) {
      rightEl.style.opacity = locationEl.style.opacity = String(1 - progress);
      return;
    }

    const eased = progress * progress * (3 - 2 * progress);
    locationEl.style.translate = `${(-eased * 64).toFixed(1)}px 0`;
    locationEl.style.opacity = String(1 - eased);
    rightEl.style.translate = `0 ${(now.scrollY * 0.3).toFixed(1)}px`;
    arrowEl.style.rotate = `${(eased * 55).toFixed(2)}deg`;
    arrowEl.style.opacity = String(1 - eased);
    leadEl.style.opacity = actionsEl.style.opacity = String(Math.max(0, 1 - eased * 1.6));
    leadEl.style.translate = actionsEl.style.translate = `0 ${(eased * 24).toFixed(1)}px`;

    // The headline falls away word by word, each tipping a little its own way.
    if (!state.words.length) state.words = [...rightEl.querySelectorAll<HTMLElement>("h1 .split-mask")];
    const stagger = state.words.length > 1 ? 0.45 / (state.words.length - 1) : 0;
    state.words.forEach((word, i) => {
      const fall = clamp01((progress - i * stagger) / 0.55);
      const tip = (i % 2 ? 1 : -1) * (4 + ((i * 7) % 6));
      word.style.translate = `0 ${(fall * fall * 140).toFixed(1)}px`;
      word.style.rotate = `${(fall * tip).toFixed(2)}deg`;
      word.style.opacity = String(1 - fall * fall);
      if (!state.tablet) word.style.filter = fall > 0.01 ? `blur(${(fall * 3).toFixed(2)}px)` : "";
    });
  };

  useTicker(() => {
    leave();
    const line = marquee.current;
    if (!line) return;
    const state = motion.current;
    const run = line.scrollWidth / RUNS;
    if (!still.get()) state.offset += MARQUEE_SPEED * state.direction;
    // The two runs are identical, so jumping by one run's width cannot be seen.
    if (state.offset < -run) state.offset = 0;
    else if (state.offset > 0) state.offset = -run;
    line.style.transform = `translateX(${state.offset}px)`;
  });

  const glide = (target: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    scrollToTarget(target);
  };

  return (
    <div id="top" data-theme="dark" className={styles.hero}>
      <div ref={location} className={styles.location}>
        <HomeGlobe entrance />
      </div>

      <div className={styles.portrait} data-fx="portrait" aria-hidden="true" />

      <div ref={right} className={styles.right} style={{ "--title-chars": LONGEST_LINE } as CSSProperties}>
        <span ref={arrow} className={styles.arrow}>
          <ArrowIcon dir="se" />
        </span>
        <Split as="h1" className={styles.title} parts={hero.title} on="load" delay={250} />
        <p ref={lead} className={`${styles.lead} font-regular`} data-over-dots="">
          {hero.lead}
        </p>
        <div ref={actions} className={`${styles.actions} font-regular`}>
          <a href={hero.primary.href} className={`${styles.cta} btn-primary`} onClick={glide(hero.primary.href)}>
            <span>{hero.primary.label}</span>
          </a>
          <a href={hero.secondary.href} className="t-link" onClick={glide(hero.secondary.href)}>
            <span className="link-text">{hero.secondary.label}</span>
            <ArrowIcon dir="se" className="link-arrow" />
          </a>
        </div>
      </div>

      <div className={styles.marqueeBand} aria-hidden="true">
        <div ref={marquee} className={`${styles.marquee} dot-text`} data-fx="marquee">
          {Array.from({ length: RUNS }, (_, run) => (
            <span className={styles.run} key={run}>
              {Array.from({ length: NAMES_PER_RUN }, (_, name) => (
                <span className={styles.name} key={name}>
                  {site.name} •
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
