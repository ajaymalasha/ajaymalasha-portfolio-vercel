"use client";

import { useEffect, useMemo, useState } from "react";
import manifest from "@/content/source-panel.json";
import { setSource } from "@/lib/experience";
import { fx } from "@/lib/particle-kit";
import { stagesOn } from "@/lib/stage";
import { useStore } from "@/lib/store";
import { now, ticker } from "@/lib/ticker";
import "./SourceLayer.global.css";
import styles from "./SourceLayer.module.css";

/*
 * "Show the code": the page drawn the way its author sees it. The 12-column grid appears, every
 * section is labelled with its tag, height and element count, and a panel shows two things that
 * cannot be faked: this visit's own performance numbers, measured here and now, and the source
 * of the effect on screen, cut from the files this site is built from
 * (scripts/make-snippets.mjs writes the excerpts to /code at build time).
 */

type Entry = { id: string; el?: string; file: string; note: string };
type Mark = { tag: string; top: number; height: string; nodes: string };

const { labels } = manifest;
const STAGED = manifest.stages as Record<string, Entry>;

/** The entries in page order; on the pinned stages, three sections point at stage code instead. */
function entriesFor(staged: boolean): (Entry & { el: string })[] {
  return manifest.sections.map((section) => {
    const stage = staged ? STAGED[section.id] : undefined;
    return stage ? { ...stage, el: section.el } : section;
  });
}

const format = (value: number) => value.toLocaleString("en");

function describe(element: Element): string {
  const tag = element.tagName.toLowerCase();
  return element.id ? `<${tag} id="${element.id}">` : `<${tag}>`;
}

function observe(type: string, each: (entry: PerformanceEntry) => void): PerformanceObserver | null {
  try {
    const observer = new PerformanceObserver((list) => list.getEntries().forEach(each));
    observer.observe({ type, buffered: true });
    return observer;
  } catch {
    return null; // this browser does not report that kind of entry
  }
}

export function SourceLayer() {
  const staged = useStore(stagesOn, false);
  const entries = useMemo(() => entriesFor(staged), [staged]);
  const [index, setIndex] = useState(0);
  const [code, setCode] = useState<{ id: string; text: string } | null>(null);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [stats, setStats] = useState({ lcp: 0, shift: 0, weight: 0, fps: 0, dots: 0, nodes: 0 });
  const entry = entries[Math.min(index, entries.length - 1)];

  // The excerpt for the section on screen.
  useEffect(() => {
    let current = true;
    fetch(`/code/${entry.id}.txt`)
      .then((response) => (response.ok ? response.text() : ""))
      .then((text) => current && setCode({ id: entry.id, text: text.trimEnd() }))
      .catch(() => current && setCode({ id: entry.id, text: "" }));
    return () => {
      current = false;
    };
  }, [entry.id]);

  useEffect(() => {
    let tops: number[] = [];
    let lcp = 0;
    let shift = 0;

    const measure = () => {
      const sections = entries.map((item) => document.querySelector(item.el));
      tops = sections.map((section) => (section ? section.getBoundingClientRect().top + now.scrollY : Infinity));
      setMarks(
        sections.flatMap((section) =>
          section instanceof HTMLElement
            ? [
                {
                  tag: describe(section),
                  top: Math.round(section.getBoundingClientRect().top + window.scrollY),
                  height: format(Math.round(section.offsetHeight)),
                  nodes: format(section.querySelectorAll("*").length),
                },
              ]
            : [],
        ),
      );
    };

    const readPage = () => {
      const transferred = [
        ...performance.getEntriesByType("navigation"),
        ...performance.getEntriesByType("resource"),
      ].reduce((sum, item) => {
        const timing = item as PerformanceResourceTiming;
        return sum + (timing.transferSize || timing.encodedBodySize || 0);
      }, 0);
      return { weight: Math.round(transferred / 1024), nodes: document.querySelectorAll("*").length, dots: fx.dots };
    };

    const observers = [
      observe("largest-contentful-paint", (item) => (lcp = item.startTime)),
      observe("layout-shift", (item) => {
        const layoutShift = item as PerformanceEntry & { hadRecentInput: boolean; value: number };
        if (!layoutShift.hadRecentInput) shift += layoutShift.value;
      }),
    ];

    let frames = 0;
    let since = performance.now();
    let shown = -1;
    const tick = () => {
      frames++;
      const time = performance.now();
      if (time - since < 500) return;
      const fps = Math.round((frames * 1000) / (time - since));
      frames = 0;
      since = time;
      // Twice a second: which section is on screen, and the numbers.
      const middle = now.scrollY + window.innerHeight / 2;
      let at = 0;
      tops.forEach((top, i) => {
        if (top <= middle) at = i;
      });
      if (at !== shown) {
        shown = at;
        setIndex(at);
      }
      setStats({ lcp, shift, fps, ...readPage() });
    };

    measure();
    const resized = new ResizeObserver(measure);
    resized.observe(document.body);
    ticker.add(tick);
    return () => {
      ticker.remove(tick);
      resized.disconnect();
      observers.forEach((observer) => observer?.disconnect());
    };
  }, [entries]);

  const figures: [string, string][] = [
    [labels.stats.lcp, stats.lcp ? `${(stats.lcp / 1000).toFixed(2)}s` : "–"],
    [labels.stats.shift, stats.shift.toFixed(3)],
    [labels.stats.weight, stats.weight ? `${format(stats.weight)} KB` : "–"],
    [labels.stats.fps, stats.fps ? String(stats.fps) : "–"],
    [labels.stats.dots, stats.dots ? format(stats.dots) : "–"],
    [labels.stats.nodes, format(stats.nodes)],
  ];
  const lines = code?.id === entry.id && code.text ? code.text.split("\n") : null;

  return (
    <>
      <div className={styles.grid} aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => (
          <i key={i} />
        ))}
      </div>
      <div className={styles.sweep} aria-hidden="true" />
      <div className={styles.marks} aria-hidden="true">
        {marks.map((mark) => (
          <span key={mark.tag} className={styles.mark} style={{ top: mark.top }}>
            {mark.tag} · {mark.height}px · {mark.nodes} {labels.elements}
          </span>
        ))}
      </div>

      <aside className={`${styles.panel} font-regular`} aria-label={labels.panel} data-dialog="">
        <header className={styles.head}>
          <p className="font-semibold">{labels.live}</p>
          <button type="button" className={styles.close} aria-label={labels.close} onClick={() => setSource(false)}>
            ×
          </button>
        </header>
        <dl className={styles.stats}>
          {figures.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd className="font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
        <p className={styles.file}>{entry.file}</p>
        <p className={styles.note}>{entry.note}</p>
        {/* data-lenis-prevent: the wheel scrolls the code, not the page behind it. */}
        <pre className={styles.code} tabIndex={0} data-lenis-prevent="" aria-label={entry.file}>
          <code>
            {lines ? (
              lines.map((line, i) => (
                <span key={i} className={/^\s*(\/\/|\/\*|\*|<!--|\{\/\*)/.test(line) ? styles.comment : styles.line}>
                  {line}
                </span>
              ))
            ) : (
              <span className={styles.comment}>{labels.loading}</span>
            )}
          </code>
        </pre>
      </aside>
    </>
  );
}
