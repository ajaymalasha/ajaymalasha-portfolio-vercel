"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { ArrowIcon } from "@/components/ui/ArrowIcon";
import { footer } from "@/content/sections";
import { briefHref, site } from "@/content/site";
import { useClock } from "@/lib/clock";
import { prefersReducedMotion, still } from "@/lib/device";
import { onScroll } from "@/lib/scroll";
import { useTicker } from "@/lib/ticker";
import { DotAvatar } from "../parts/DotAvatar";
import styles from "./Footer.module.css";

/** The share of the band's width one copy of the name takes. */
const NAME_WIDTH = 0.8;
/** Room left above the capitals, as a share of their height. */
const HEADROOM = 1.12;
/** How far the call to action leans after the cursor, as a share of the cursor's distance. */
const CTA_FOLLOW = 0.25;
/** The natural size of the dot pattern behind the name (globals.css: .dot-text), in pixels. */
const DOT_TILE = 48;
const COPIED_MS = 2000;
const NAME_COPIES = [0, 1, 2, 3];

/**
 * The footer: the invitation, how a conversation starts, the ways to reach him, and his name
 * across the bottom of the page. The name is real text (in dots) that drifts sideways; when the
 * particle cloud is running, the cloud writes the name first and this text fades in under it
 * (the cloud sets `--arrived` on the band).
 */
export function Footer() {
  const time = useClock(site.home.timeZone, { hour12: true });
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const zone = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  /** The drifting name: where a centred copy sits, the distance between copies, and where it is now. */
  const band = useRef({ centre: 0, period: 0, x: 0, direction: -1, visible: false, last: 0 });

  useEffect(() => {
    const zoneEl = zone.current;
    const trackEl = track.current;
    if (!zoneEl || !trackEl) return;
    const state = band.current;
    let fittedWidth = -1;

    /** Sizes the name so one copy spans most of the band and stands on its bottom edge. */
    const fit = () => {
      const copies = trackEl.children;
      const word = trackEl.querySelector<HTMLElement>('[data-fx="name-word"]');
      const context = document.createElement("canvas").getContext("2d");
      if (!word || !context || copies.length < 2 || !zoneEl.clientWidth) return;
      fittedWidth = zoneEl.clientWidth;

      trackEl.style.fontSize = "100px";
      const size = (100 * fittedWidth * NAME_WIDTH) / word.getBoundingClientRect().width;
      trackEl.style.fontSize = `${size}px`;
      // The dot pattern is drawn for a name this size on a laptop: on a phone it shrinks with
      // the letters, or the dots would be too coarse to read them.
      trackEl.style.backgroundSize = `${Math.min(DOT_TILE, Math.max(18, size * 0.3)).toFixed(1)}px`;

      // The line box is as tall as the font size; the canvas tells us where the ink is in it.
      const style = getComputedStyle(trackEl);
      context.font = `${style.fontWeight} ${size}px ${style.fontFamily}`;
      const ink = context.measureText(site.name);
      const baseline =
        (size - (ink.fontBoundingBoxAscent + ink.fontBoundingBoxDescent)) / 2 + ink.fontBoundingBoxAscent;
      const capsHeight = ink.actualBoundingBoxAscent * HEADROOM;
      // Descenders (the "j" and "y") get their room below the baseline instead of being cut off.
      zoneEl.style.height = `${capsHeight + ink.actualBoundingBoxDescent}px`;
      trackEl.style.top = `${capsHeight - baseline}px`;

      state.period = copies[1].getBoundingClientRect().left - copies[0].getBoundingClientRect().left;
      state.centre = (fittedWidth - word.getBoundingClientRect().width) / 2;
      state.x = state.centre;
      trackEl.style.transform = `translateX(${state.x.toFixed(1)}px)`;
    };

    const style = getComputedStyle(trackEl);
    let alive = true;
    document.fonts
      .load(`${style.fontWeight} 100px ${style.fontFamily}`, site.name)
      .catch(() => undefined)
      .then(() => alive && fit());

    // Setting the band's height fires this again: only a change of width needs a new fit.
    const resize = new ResizeObserver(() => {
      if (zoneEl.clientWidth !== fittedWidth) fit();
    });
    resize.observe(zoneEl);

    const sight = new IntersectionObserver(([entry]) => (state.visible = entry.isIntersecting), {
      rootMargin: "200px 0px",
    });
    sight.observe(zoneEl);

    // The name drifts against the direction of the last scroll.
    const offScroll = onScroll(({ direction }) => {
      if (direction) state.direction = -direction;
    });

    return () => {
      alive = false;
      resize.disconnect();
      sight.disconnect();
      offScroll();
      clearTimeout(copiedTimer.current);
    };
  }, []);

  useTicker((now) => {
    const state = band.current;
    const frames = Math.min((now - state.last) / (1000 / 60), 4);
    state.last = now;
    const zoneEl = zone.current;
    const trackEl = track.current;
    if (!state.visible || !state.period || !zoneEl || !trackEl) return;

    const arrived = document.documentElement.classList.contains("has-particles")
      ? parseFloat(zoneEl.style.getPropertyValue("--arrived")) || 0
      : 1;
    if (arrived > 0.98) {
      if (still.get()) return;
      state.x += state.direction * frames;
      if (state.x < state.centre - state.period) state.x += state.period;
      else if (state.x > state.centre) state.x -= state.period;
    } else {
      // While the cloud is writing the name, settle on the nearest centred copy for it to land on.
      const target = state.centre - Math.round((state.centre - state.x) / state.period) * state.period;
      state.x += (target - state.x) * 0.15;
    }
    trackEl.style.transform = `translateX(${state.x.toFixed(1)}px)`;
  });

  const followCursor = (event: MouseEvent<HTMLAnchorElement>) => {
    if (prefersReducedMotion()) return;
    const element = event.currentTarget;
    const box = element.getBoundingClientRect();
    element.style.setProperty("--mx", `${((event.clientX - (box.left + box.width / 2)) * CTA_FOLLOW).toFixed(1)}px`);
    element.style.setProperty("--my", `${((event.clientY - (box.top + box.height / 2)) * CTA_FOLLOW).toFixed(1)}px`);
  };

  const releaseCursor = (event: MouseEvent<HTMLAnchorElement>) => {
    event.currentTarget.style.removeProperty("--mx");
    event.currentTarget.style.removeProperty("--my");
  };

  /** Copies the address instead of opening the mail app; where that is not possible, the link works as a link. */
  const copyEmail = async (event: MouseEvent<HTMLAnchorElement>) => {
    if (!navigator.clipboard) return;
    event.preventDefault();
    try {
      await navigator.clipboard.writeText(site.email);
      setCopied(true);
      clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), COPIED_MS);
    } catch {
      window.location.href = `mailto:${site.email}`;
    }
  };

  const { bar } = footer;

  return (
    <footer id="contact" className={styles.footer} data-theme="dark">
      <div className={styles.body}>
        <p className={`${styles.availability} font-regular`}>
          <span className={styles.availabilityDot} aria-hidden="true" />
          {footer.availability}
        </p>

        <div className={styles.headingRow}>
          <h2 className={`${styles.heading} font-bold`}>
            <DotAvatar alt={site.name} className={styles.avatar} step={2.5} />
            <span>
              {footer.heading[0]}
              <br />
              {footer.heading[1]}
            </span>
          </h2>
        </div>

        <div className={styles.dividerZone}>
          <ol className={`${styles.journey} grid-12`} aria-label={footer.stepsLabel}>
            {footer.steps.map((step, i) => (
              <li key={step.title} className={styles.stop}>
                <span className={`${styles.stopIndex} font-regular`}>{String(i + 1).padStart(2, "0")}</span>
                <span className={styles.stopDot} aria-hidden="true" />
                <span className={styles.stopText}>
                  <span className={`${styles.stopTitle} font-semibold`}>{step.title}</span>
                  <span className={`${styles.stopNote} font-regular`}>{step.note}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className={styles.dividerLine}>
            <div className={styles.divider} />
            <a
              href={briefHref}
              className={`${styles.cta} btn-primary`}
              data-fx="cta"
              data-magnet="off"
              onMouseMove={followCursor}
              onMouseLeave={releaseCursor}
            >
              <span className={`${styles.ctaLabel} font-regular`}>
                {footer.cta[0]}
                <br />
                {footer.cta[1]} <ArrowIcon className={`${styles.ctaArrow} btn-arrow`} />
              </span>
            </a>
          </div>
        </div>

        <div className={styles.pills}>
          <a href={`mailto:${site.email}`} className={`${styles.pill} fill font-regular`} onClick={copyEmail}>
            {site.email}
          </a>
          <a href={`tel:${site.phone}`} className={`${styles.pill} fill font-regular`}>
            {site.phoneDisplay}
          </a>
          <span className={`${styles.copied} font-regular`} data-visible={copied} role="status">
            {copied ? footer.copied : ""}
          </span>
        </div>
      </div>

      <div className={`${styles.bar} grid-12`}>
        <div className={styles.col}>
          <span className={`${styles.barLabel} font-regular`}>{bar.version.label}</span>
          <span className={`${styles.barValue} font-regular`}>{bar.version.value}</span>
        </div>
        <div className={styles.col}>
          <span className={`${styles.barLabel} font-regular`}>{bar.time.label}</span>
          <span className={`${styles.barValue} font-regular`}>
            {time ? `${time.toUpperCase()} ${site.home.zone}` : "\u00a0"}
          </span>
        </div>
        <div className={styles.col}>
          <span className={`${styles.barLabel} font-regular`}>{bar.now.label}</span>
          <a
            href={bar.now.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`${styles.barValue} ${styles.barLink} t-link font-regular`}
          >
            <span className="link-text">{bar.now.value}</span>
          </a>
        </div>
        <div className={styles.col}>
          <span className={`${styles.barLabel} font-regular`}>{bar.privacy.label}</span>
          <span className={`${styles.barValue} font-regular`}>{bar.privacy.value}</span>
        </div>
        <div className={`${styles.col} ${styles.colEnd}`}>
          <span className={`${styles.barLabel} font-regular`}>{bar.socials.label}</span>
          <div className={styles.socials}>
            {site.socials.map((social) => (
              <a
                key={social.label}
                href={social.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`${styles.social} t-link font-regular`}
              >
                {social.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div ref={zone} className={styles.nameZone} data-fx="name-zone" aria-hidden="true">
        <div ref={track} className={`${styles.nameTrack} dot-text`}>
          {NAME_COPIES.map((copy) => (
            <span key={copy} className={styles.nameCopy}>
              <span data-fx="name-word">{site.name}</span>
              {" • "}
            </span>
          ))}
        </div>
      </div>
    </footer>
  );
}
