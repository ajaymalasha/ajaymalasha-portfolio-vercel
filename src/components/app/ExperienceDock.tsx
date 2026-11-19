"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { dock, gate } from "@/content/sections";
import { STORY_ENABLED } from "@/content/site";
import { setSoundEnabled, soundPlaying } from "@/lib/audio";
import { canHover, prefersReducedMotion } from "@/lib/device";
import { setSource, sourceOn, switchVersion, version, type Version } from "@/lib/experience";
import { onScroll } from "@/lib/scroll";
import { useStore } from "@/lib/store";
import { ticker } from "@/lib/ticker";
import styles from "./ExperienceDock.module.css";
import { SoundBars } from "./SoundBars";
import { TrackSwitch } from "./TrackSwitch";

const VERSIONS: Version[] = ["site", "story"];
/** How far down (in screens) before the code switch introduces itself, once. */
const HINT_AFTER_SCREENS = 1.2;
const HINT_MS = 3500;

type Edge = "l" | "r" | "t" | "b";
const EDGES: Edge[] = ["l", "r", "t", "b"];
type Box = Record<Edge, number>;
/** The side of the blob facing where it is going moves first; the far side is dragged behind. */
const LEAD = 0.2;
const TRAIL = 0.07;
const DAMPING = 0.68;
/** The blob is drawn this much larger than the control, to make up for what the filter eats. */
const PAD = 1.5;

/**
 * The pill at the bottom of the screen: the code layer switch (site) or the sound controls
 * (story), and the choice between the two versions. A soft blob follows the pointer from one
 * control to the next, stretching as it goes.
 */
export function ExperienceDock() {
  const navRef = useRef<HTMLElement>(null);
  const blobRef = useRef<SVGRectElement>(null);
  const dropRef = useRef<SVGRectElement>(null);
  const goo = useRef<{ aim: (target: Element | null) => void } | null>(null);

  const current = useStore(version, null);
  const source = useStore(sourceOn, false);
  const playing = useStore(soundPlaying, false);
  const [tucked, setTucked] = useState(false);
  const [hinting, setHinting] = useState(false);
  const story = current === "story";

  // Out of the way while reading down the page, back as soon as the visitor scrolls up.
  useEffect(() => {
    const narrow = window.matchMedia("(max-width: 1023px)");
    let hinted = false;
    let timer = 0;
    const stop = onScroll(({ scroll, limit, direction }) => {
      const inStory = version.get() === "story";
      const hide = (narrow.matches || !inStory) && direction === 1 && scroll > 120 && scroll < limit - 120;
      setTucked(hide);
      if (hinted || hide || inStory || sourceOn.get() || scroll < window.innerHeight * HINT_AFTER_SCREENS) return;
      hinted = true;
      setHinting(true);
      timer = window.setTimeout(() => setHinting(false), HINT_MS);
    });
    return () => {
      stop();
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav || !canHover() || prefersReducedMotion()) return;
    nav.dataset.goo = "on";

    const blob: Box & { vl: number; vr: number; vt: number; vb: number; on: boolean } = {
      l: 0,
      r: 0,
      t: 0,
      b: 0,
      vl: 0,
      vr: 0,
      vt: 0,
      vb: 0,
      on: false,
    };
    // What the blob leaves behind on the control it came from: a drop that shrinks away.
    const drop = { x: 0, y: 0, w: 0, h: 0, scale: 0 };
    let target: Element | null = null;
    let running = false;

    const boxOf = (element: Element): Box => {
      const frame = nav.getBoundingClientRect();
      const box = element.getBoundingClientRect();
      const left = frame.left + nav.clientLeft;
      const top = frame.top + nav.clientTop;
      return { l: box.left - left, r: box.right - left, t: box.top - top, b: box.bottom - top };
    };

    const place = (rect: SVGRectElement | null, x: number, y: number, w: number, h: number) => {
      if (!rect) return;
      const visible = w > 0.5 && h > 0.5;
      rect.setAttribute("x", (x - PAD).toFixed(1));
      rect.setAttribute("y", (y - PAD).toFixed(1));
      rect.setAttribute("width", visible ? (w + PAD * 2).toFixed(1) : "0");
      rect.setAttribute("height", visible ? (h + PAD * 2).toFixed(1) : "0");
      rect.setAttribute("rx", visible ? (h / 2 + PAD).toFixed(1) : "0");
    };

    const paint = () => {
      if (blob.on) place(blobRef.current, blob.l, blob.t, blob.r - blob.l, blob.b - blob.t);
      else place(blobRef.current, 0, 0, 0, 0);
      const w = drop.w * drop.scale;
      const h = drop.h * drop.scale;
      place(dropRef.current, drop.x - w / 2, drop.y - h / 2, w, h);
    };

    const step = () => {
      // The control can disappear or become the selected one under the pointer.
      if (target && (!target.isConnected || target.hasAttribute("data-active"))) aim(null);
      if (blob.on && target) {
        const goal = boxOf(target);
        const movingRight = goal.l + goal.r > blob.l + blob.r;
        for (const edge of EDGES) {
          const leads = edge === "l" ? !movingRight : edge === "r" ? movingRight : true;
          const key = `v${edge}` as const;
          blob[key] = (blob[key] + (goal[edge] - blob[edge]) * (leads ? LEAD : TRAIL)) * DAMPING;
          blob[edge] += blob[key];
        }
      }
      drop.scale += (0 - drop.scale) * 0.1;
      if (!blob.on && drop.scale < 0.02) {
        drop.scale = 0;
        running = false;
        ticker.remove(step);
      }
      paint();
    };

    function aim(next: Element | null) {
      if (next === target) return;
      if (blob.on) {
        Object.assign(drop, {
          x: (blob.l + blob.r) / 2,
          y: (blob.t + blob.b) / 2,
          w: blob.r - blob.l,
          h: blob.b - blob.t,
          scale: 1,
        });
      }
      target = next;
      if (next && !blob.on) {
        // Coming from nowhere: grow out of the middle of the control.
        const box = boxOf(next);
        const x = (box.l + box.r) / 2;
        const y = (box.t + box.b) / 2;
        Object.assign(blob, { l: x - 4, r: x + 4, t: y - 4, b: y + 4, vl: 0, vr: 0, vt: 0, vb: 0 });
      }
      blob.on = Boolean(next);
      if (!running) {
        running = true;
        ticker.add(step);
      }
    }

    goo.current = { aim };
    return () => {
      goo.current = null;
      ticker.remove(step);
      delete nav.dataset.goo;
    };
  }, []);

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType !== "mouse" || !(event.target instanceof Element)) return;
    goo.current?.aim(event.target.closest("[data-goo]:not([data-active])"));
  };

  const sourceLabel = source ? dock.sourceOff : dock.sourceOn;

  return (
    <nav
      ref={navRef}
      className={`${styles.dock} font-regular`}
      aria-label={dock.label}
      data-dock=""
      data-story={story || undefined}
      data-tucked={tucked || undefined}
      onPointerMove={onPointerMove}
      onPointerLeave={() => goo.current?.aim(null)}
    >
      <svg className={styles.goo} aria-hidden="true" focusable="false">
        <defs>
          <filter id="dock-goo" x="-20%" y="-60%" width="140%" height="220%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
            <feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" />
          </filter>
        </defs>
        <g filter="url(#dock-goo)">
          <rect ref={dropRef} />
          <rect ref={blobRef} />
        </g>
      </svg>

      {story ? (
        <>
          <button
            type="button"
            className={`${styles.sound} btn-icon`}
            role="switch"
            aria-checked={playing}
            aria-label={playing ? dock.soundOff : dock.soundOn}
            data-goo=""
            data-sound-control=""
            onClick={() => setSoundEnabled(!playing)}
          >
            <SoundBars on={playing} />
          </button>
          <TrackSwitch className={styles.track} goo />
        </>
      ) : (
        <button
          type="button"
          className={`${styles.source} btn-icon`}
          role="switch"
          aria-checked={source}
          aria-label={sourceLabel}
          data-goo=""
          data-hinting={hinting || undefined}
          onClick={() => setSource(!source)}
        >
          <span aria-hidden="true">{"</>"}</span>
          <span className={`${styles.tip} font-regular`} aria-hidden="true">
            {sourceLabel}
          </span>
        </button>
      )}

      {STORY_ENABLED ? (
        <>
          <span className={styles.divider} aria-hidden="true" />
          <div className={styles.versions} role="radiogroup" aria-label={dock.experience}>
            {VERSIONS.map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                className={styles.option}
                aria-checked={current === id}
                data-goo=""
                data-active={current === id ? "" : undefined}
                onClick={(event) => switchVersion(id, event.currentTarget)}
              >
                {gate.versions[id].label}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </nav>
  );
}
