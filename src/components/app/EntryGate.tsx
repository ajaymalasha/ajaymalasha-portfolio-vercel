"use client";

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { ArrowIcon } from "@/components/ui/ArrowIcon";
import { gate } from "@/content/sections";
import { site } from "@/content/site";
import { audioLevel, setSoundAllowed, setSoundEnabled, soundPlaying, soundTrack } from "@/lib/audio";
import { canHover, prefersReducedMotion } from "@/lib/device";
import type { Version } from "@/lib/experience";
import { useStore } from "@/lib/store";
import { ticker } from "@/lib/ticker";
import {
  dotCount,
  fitCanvas,
  gridPoint,
  ringPoint,
  seedDot,
  spiralPoint,
  type DotSeed,
  type Field,
  type Point,
} from "./dot-shapes";
import styles from "./EntryGate.module.css";
import { SoundBars } from "./SoundBars";
import { TrackSwitch } from "./TrackSwitch";

type Props = { active: boolean; load: () => Promise<unknown>[]; onChoose: (id: Version) => void; onDone: () => void };

type Dot = DotSeed & {
  x: number;
  y: number;
  home: Point;
  /** The loading progress at which this dot leaves the cloud for the ring. */
  joinsAt: number;
  size: number;
  shimmer: number;
  phase: number;
  vx: number;
  vy: number;
};

const VERSIONS: Version[] = ["site", "story"];
/** The count never finishes faster than this, however quickly everything loads. */
const MIN_LOADING_MS = 1600;
/** ...and never waits longer than this for something that has stalled. */
const MAX_LOADING_MS = 8000;
const LEAVE_MS = 1000;
const LEAVE_CALM_MS = 300;
const POINTER_REACH = 90;
const DOT_COLOUR = "#ece8df";
const linkedin = site.socials[0];

/**
 * The entry screen: a count while the fonts and the portrait load, then the two ways in. Loose
 * dots gather into a ring as loading progresses and rehearse each choice when it is hovered.
 *
 * The server renders its first frame, so there is something on screen before React; CSS shows
 * that frame only when the boot script decided the entry screen is due. `active` turns it on.
 */
export function EntryGate({ active, load, onChoose, onDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // What the canvas reads every frame, kept out of React state so drawing never waits for a render.
  const scene = useRef({ ready: false, hovered: null as Version | null, leftAt: 0 });
  const latest = useRef({ load, onChoose, onDone });
  const timers = useRef({ cycle: 0, hint: 0, hintDelay: 0, done: 0 });

  const [count, setCount] = useState(0);
  const [ready, setReady] = useState(false);
  const [hovered, setHovered] = useState<Version | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);
  const [hint, setHint] = useState(false);
  const playing = useStore(soundPlaying, false);

  useEffect(() => {
    latest.current = { load, onChoose, onDone };
  });

  useEffect(() => {
    const pending = timers.current;
    return () => {
      window.clearInterval(pending.cycle);
      window.clearTimeout(pending.hint);
      window.clearTimeout(pending.hintDelay);
      window.clearTimeout(pending.done);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!active || !canvas) return;

    const calm = prefersReducedMotion();
    const pointer = { x: -9999, y: -9999 };
    const state = scene.current;
    const pending = timers.current;
    let ctx: CanvasRenderingContext2D | null = null;
    let field: Field = { width: 0, height: 0 };
    let dots: Dot[] = [];
    let time = 0;
    let progress = 0;
    let shownProgress = 0;
    let lastCount = 0;
    let beat = 0;

    const resize = () => {
      ({ ctx, field } = fitCanvas(canvas));
      if (dots.length) return;
      dots = Array.from({ length: dotCount(field) }, (_, index) => {
        const x = Math.random() * field.width;
        const y = Math.random() * field.height;
        return {
          ...seedDot(index),
          x,
          y,
          home: [x, y],
          joinsAt: Math.random(),
          size: 0.8 + Math.random() * 1.4,
          shimmer: Math.random() * Math.PI * 2,
          phase: Math.random() * Math.PI * 2,
          vx: 0,
          vy: 0,
        };
      });
    };

    const target = (dot: Dot, index: number): Point => {
      const phone = field.width < 648;
      const radius = phone ? field.height * 0.54 : Math.min(field.width, field.height) * 0.36;
      if (!state.ready && progress < dot.joinsAt) {
        return [dot.home[0] + Math.sin(time * 0.6 + index) * 6, dot.home[1] + Math.cos(time * 0.5 + index) * 6];
      }
      if (state.ready && state.hovered === "site") return gridPoint(index, dots.length, field, 40);
      if (state.ready && state.hovered === "story") return spiralPoint(dot, field, radius, time);
      return ringPoint(dot, field, radius, time);
    };

    // Everything the page needs is loading while the count runs; it ends when both the loading
    // and the minimum time are over.
    const startedAt = performance.now();
    const tasks = latest.current.load();
    let settled = 0;
    tasks.forEach((task) => {
      const tally = () => settled++;
      Promise.resolve(task).then(tally, tally);
    });

    const becomeReady = () => {
      state.ready = true;
      setReady(true);
      // No hover on touch screens: show each formation in turn instead.
      if (canHover() || calm) return;
      let step = 0;
      pending.cycle = window.setInterval(() => {
        const next = step % 3 === 2 ? null : VERSIONS[step % 3];
        state.hovered = next;
        setHovered(next);
        step++;
      }, 2200);
    };

    const draw = () => {
      const pen = ctx;
      if (!pen) return;
      time += 1 / 60;

      if (!state.ready) {
        const waited = performance.now() - startedAt;
        const elapsed = Math.min(1, waited / MIN_LOADING_MS);
        progress = Math.min(elapsed, (settled + elapsed) / (tasks.length + 1));
        // A font or a photo that never arrives must not keep anyone here: after a while, go on without it.
        if ((settled === tasks.length || waited > MAX_LOADING_MS) && elapsed >= 1) {
          progress = 1;
          becomeReady();
        }
      }
      shownProgress += (progress - shownProgress) * 0.08;
      const nextCount = Math.round(shownProgress * 100);
      if (nextCount !== lastCount) setCount((lastCount = nextCount));

      // With the "pulse" track playing, the dots jump on each beat.
      const level = !calm && soundPlaying.get() && soundTrack.get() === "pulse" ? audioLevel() : 0;
      beat = level > beat ? level : beat * 0.9;

      const flying = state.leftAt > 0;
      const fade = flying ? Math.max(0, 1 - (performance.now() - state.leftAt) / 900) : 1;
      pen.clearRect(0, 0, field.width, field.height);
      pen.fillStyle = DOT_COLOUR;

      dots.forEach((dot, index) => {
        if (flying) {
          if (!dot.vx && !dot.vy) {
            const dx = dot.x - field.width / 2;
            const dy = dot.y - field.height / 2;
            const distance = Math.hypot(dx, dy) || 1;
            const speed = 6 + Math.random() * 14;
            dot.vx = (dx / distance) * speed;
            dot.vy = (dy / distance) * speed;
          }
          dot.x += dot.vx;
          dot.y += dot.vy;
          dot.vx *= 1.04;
          dot.vy *= 1.04;
        } else {
          const [tx, ty] = target(dot, index);
          const ease = calm ? 1 : 0.07;
          dot.x += (tx - dot.x) * ease;
          dot.y += (ty - dot.y) * ease;
          const dx = dot.x - pointer.x;
          const dy = dot.y - pointer.y;
          const distance = Math.hypot(dx, dy);
          if (distance < POINTER_REACH && distance > 0) {
            dot.x += (dx / distance) * (POINTER_REACH - distance) * 0.12;
            dot.y += (dy / distance) * (POINTER_REACH - distance) * 0.12;
          }
        }
        const gathered = state.ready || progress >= dot.joinsAt;
        pen.globalAlpha = (gathered ? 0.85 : 0.35) * fade;
        const jump = beat * 28 * Math.sin(time * 9 + dot.phase);
        pen.beginPath();
        pen.arc(dot.x + Math.cos(dot.shimmer) * jump, dot.y + Math.sin(dot.shimmer) * jump, dot.size, 0, Math.PI * 2);
        pen.fill();
      });
      pen.globalAlpha = 1;
    };

    const onPointerMove = (event: PointerEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
    };

    // Browsers only let sound start from a gesture: the first tap or key press anywhere on the
    // entry screen (other than its own controls, which do it themselves) is that gesture.
    const stopListening = () => {
      window.removeEventListener("pointerup", onGesture);
      window.removeEventListener("keydown", onGesture);
    };
    function onGesture(event: Event) {
      stopListening();
      const control = event.target instanceof Element && event.target.closest("[data-gate-control]");
      if (!control) setSoundAllowed(true);
    }

    setSoundAllowed(true);
    resize();
    window.addEventListener("pointerup", onGesture);
    window.addEventListener("keydown", onGesture);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("resize", resize);
    ticker.add(draw);
    return () => {
      stopListening();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", resize);
      ticker.remove(draw);
      window.clearInterval(pending.cycle);
    };
  }, [active]);

  if (gone) return null;

  const hover = (id: Version | null) => {
    scene.current.hovered = id;
    setHovered(id);
  };

  const choose = (event: ReactMouseEvent<HTMLAnchorElement>, id: Version) => {
    // Modified clicks keep their meaning (new tab, new window): the link's address does the same job.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    if (leaving || !active) return;
    window.clearInterval(timers.current.cycle);
    setSoundAllowed(id === "story");
    scene.current.leftAt = performance.now();
    setLeaving(true);
    latest.current.onChoose(id);
    timers.current.done = window.setTimeout(
      () => {
        setGone(true);
        latest.current.onDone();
      },
      prefersReducedMotion() ? LEAVE_CALM_MS : LEAVE_MS,
    );
  };

  const hintAfterTrackChange = () => {
    const pending = timers.current;
    window.clearTimeout(pending.hintDelay);
    // Give the sound a moment to start before deciding the visitor cannot hear it.
    pending.hintDelay = window.setTimeout(() => {
      if (soundPlaying.get()) return;
      setHint(true);
      window.clearTimeout(pending.hint);
      pending.hint = window.setTimeout(() => setHint(false), 4000);
    }, 250);
  };

  return (
    <div
      className={styles.gate}
      data-view="gate-shell"
      data-live={active ? "" : undefined}
      data-ready={ready || undefined}
      data-leaving={leaving || undefined}
      inert={leaving}
    >
      <canvas ref={canvasRef} className={styles.dots} aria-hidden="true" />

      <section className={styles.content} aria-label={gate.welcome}>
        <p className={`${styles.kicker} font-regular`}>{gate.kicker}</p>
        <h2 className={`${styles.title} font-bold`}>
          {gate.title[0]}
          <br />
          {gate.title[1]}
        </h2>

        <div className={styles.stage}>
          <p className={`${styles.loading} font-regular`} role="status">
            <span className={`${styles.count} font-bold`}>{String(count).padStart(3, "0")}</span> {gate.loading}
          </p>

          <div className={styles.ready} inert={!ready}>
            <nav className={styles.choices} aria-label={gate.choose}>
              {VERSIONS.map((id, index) => (
                <a
                  key={id}
                  href={`?v=${id}`}
                  className={styles.choice}
                  data-hovered={hovered === id || undefined}
                  data-gate-control=""
                  onMouseEnter={() => hover(id)}
                  onMouseLeave={() => hover(null)}
                  onFocus={() => hover(id)}
                  onBlur={() => hover(null)}
                  onClick={(event) => choose(event, id)}
                >
                  <span className={`${styles.choiceIndex} font-regular`}>0{index + 1}</span>
                  <span className={`${styles.choiceTitle} font-bold`}>{gate.versions[id].title}</span>
                  <span className={`${styles.choiceDesc} font-regular`}>{gate.versions[id].desc}</span>
                  <ArrowIcon className={styles.choiceArrow} dir="e" />
                </a>
              ))}
            </nav>

            <div className={styles.sound}>
              <button
                type="button"
                className={`${styles.pill} fill font-regular`}
                role="switch"
                aria-checked={playing}
                data-gate-control=""
                data-sound-control=""
                onClick={() => setSoundEnabled(!playing)}
              >
                <SoundBars on={playing} /> {playing ? gate.soundOn : gate.soundOff}
              </button>
              <TrackSwitch className={`${styles.pill} fill font-regular`} onSwitch={hintAfterTrackChange} />
              <p className={`${styles.hint} font-regular`} role="status" data-shown={(hint && !playing) || undefined}>
                {hint && !playing ? gate.soundHint : null}
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className={`${styles.foot} font-regular`}>
        <a className="t-link" href={`mailto:${site.email}`}>
          <span className="link-text">{site.email}</span>
        </a>
        <span aria-hidden="true">·</span>
        <a className="t-link" href={linkedin.url} target="_blank" rel="noopener">
          <span className="link-text">{linkedin.label}</span>
        </a>
      </footer>
    </div>
  );
}
