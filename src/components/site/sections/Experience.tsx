"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { ArrowIcon } from "@/components/ui/ArrowIcon";
import { LensReveal } from "@/components/ui/LensReveal";
import { RichText } from "@/components/ui/RichText";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { chapters, experience } from "@/content/sections";
import { site } from "@/content/site";
import { still } from "@/lib/device";
import { getLenis } from "@/lib/scroll";
import { now, useTicker } from "@/lib/ticker";
import styles from "./Experience.module.css";

const roles = experience.roles;
const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/** Marquee speed in px per frame at rest; scrolling adds to it. */
const BASE_SPEED = 0.6;

/* The calendar year is the visitor's, not the build's. Until the page is live in a browser it
   stands at the year of the current role, which is the latest year the content knows of. */
const noSubscription = () => () => {};
const yearInBrowser = () => new Date().getFullYear();
const yearInContent = () => Number(roles[roles.length - 1].year);

/**
 * Experience: a statement with a second reading under the lens, the roles as a timeline with
 * one giant year that rolls over like an odometer as each role crosses the middle of the
 * screen, and the toolkit as a line of text that runs faster the faster the page is scrolled.
 */
export function Experience() {
  const years = useSyncExternalStore(noSubscription, yearInBrowser, yearInContent) - site.since;
  const [active, setActive] = useState(0);
  const role = roles[active];

  const section = useRef<HTMLElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const fill = useRef<HTMLSpanElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const frame = useRef({ near: false, count: 0, centres: [] as number[], along: -1, offset: 0, skew: 0 });

  // Neither the timeline nor the marquee needs working out while the section is far off screen.
  useEffect(() => {
    const element = section.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => (frame.current.near = entry.isIntersecting), {
      rootMargin: "50% 0px",
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useTicker(() => {
    const f = frame.current;
    if (!f.near) return;

    // Which role is across the middle of the screen, and how far down the line that is.
    const items = list.current;
    if (items) {
      // Sections above change height as they load, so the positions are measured again now and then.
      if (f.count++ % 30 === 0) {
        f.centres = [...items.children].map((item) => {
          const box = item.getBoundingClientRect();
          return box.top + now.scrollY + box.height / 2;
        });
      }
      const middle = now.scrollY + window.innerHeight / 2;
      let nearest = 0;
      f.centres.forEach((centre, i) => {
        if (Math.abs(centre - middle) < Math.abs(f.centres[nearest] - middle)) nearest = i;
      });
      if (nearest !== active) setActive(nearest);

      const first = f.centres[0];
      const last = f.centres[f.centres.length - 1];
      const along = last > first ? Math.min(1, Math.max(0, (middle - first) / (last - first))) : 0;
      if (fill.current && Math.abs(along - f.along) > 0.0005) {
        f.along = along;
        fill.current.style.transform = `scaleY(${along.toFixed(4)})`;
      }
    }

    // The toolkit line: it runs the way the page is scrolled, faster and more slanted with speed.
    const line = track.current;
    if (line && !still.get()) {
      const velocity = getLenis().velocity || 0;
      const half = line.scrollWidth / 2;
      f.offset -= (BASE_SPEED + Math.abs(velocity) * 0.35) * (velocity < 0 ? -1 : 1);
      if (f.offset <= -half) f.offset += half;
      else if (f.offset > 0) f.offset -= half;
      f.skew += (Math.max(-12, Math.min(12, -velocity * 0.4)) - f.skew) * 0.1;
      line.style.transform = `translate3d(${f.offset.toFixed(2)}px, 0, 0) skewX(${f.skew.toFixed(2)}deg)`;
    }
  });

  return (
    <section
      ref={section}
      id="experience"
      className={styles.experience}
      data-theme="dark"
      data-chapter={chapters.experience}
    >
      <div className={styles.head}>
        <SectionHeader index="05" label={experience.label}>
          {experience.aside}
        </SectionHeader>
      </div>

      <div className={`${styles.grid} grid-12`}>
        <div className={styles.intro}>
          <div data-reveal="" style={{ "--reveal-delay": "80ms" } as CSSProperties}>
            <LensReveal
              hidden={
                <p className={`${styles.statement} font-regular`}>
                  {experience.hidden.replace("{years}", String(years))}
                </p>
              }
            >
              <p className={`${styles.statement} font-regular`}>
                <RichText text={experience.statement} />
              </p>
            </LensReveal>
          </div>
          <a href={experience.cvUrl} target="_blank" rel="noopener" className={`t-link font-regular ${styles.link}`}>
            <span className="link-text">{experience.cv}</span>
            <ArrowIcon className="link-arrow link-arrow--out" />
          </a>
        </div>
        <div data-slot="form" aria-hidden="true" />
      </div>

      {/* Laptops and up: the giant year stays on screen while the roles go by. Each role also
          says its own year, which is all that smaller screens (and screen readers) need. */}
      <div className={`${styles.journey} grid-12`}>
        <div className={styles.pin} aria-hidden="true">
          <div className={`${styles.year} font-bold`}>
            {[...role.year].map((digit, d) => (
              <span key={d} className={styles.digit}>
                <span className={styles.strip} style={{ "--digit": digit } as CSSProperties}>
                  {DIGITS.map((n) => (
                    <span key={n}>{n}</span>
                  ))}
                </span>
              </span>
            ))}
          </div>
          <p className={`${styles.into} font-regular`}>
            {experience.yearN.replace("{n}", String(Number(role.year) - site.since + 1))}
            <em className={`${styles.now} font-bold`} data-shown={role.current ? "" : undefined}>
              {experience.now}
            </em>
          </p>
        </div>

        <div className={styles.history}>
          <p className="section-label" data-reveal="">
            {experience.history}
          </p>
          <div className={styles.timeline}>
            <span className={styles.line} aria-hidden="true">
              <span ref={fill} className={styles.fill} />
            </span>
            <ol ref={list}>
              {roles.map((item, i) => (
                <li
                  key={item.year}
                  className={styles.item}
                  data-state={i === active ? "active" : i < active ? "past" : undefined}
                >
                  <span className={`${styles.itemYear} font-regular`}>
                    {item.year}
                    {item.current ? <em className={`${styles.now} font-bold`}>{experience.now}</em> : null}
                  </span>
                  <p className={`${styles.role} font-bold`}>{item.role}</p>
                  <p className={`${styles.company} font-regular`}>
                    {item.company} <span>· {item.place}</span>
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      <div className={styles.toolkit} role="group" aria-label={experience.toolkitLabel}>
        <div ref={track} className={styles.track}>
          {[0, 1].map((copy) => (
            <span key={copy} className={styles.set} aria-hidden={copy === 1 ? true : undefined}>
              {experience.toolkit.map((tool) => (
                <span key={tool} className={`${styles.tool} font-regular`}>
                  {tool}
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
