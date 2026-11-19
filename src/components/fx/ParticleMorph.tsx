"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { site } from "@/content/site";
import { canHover, deviceTier, prefersReducedMotion, still } from "@/lib/device";
import { lens } from "@/lib/lens";
import {
  COLORS,
  PORTRAIT_URL,
  createIntro,
  fitCount,
  fx,
  liftShadows,
  loadPortrait,
  samplePoints,
  seeds,
  textPoints,
} from "@/lib/particle-kit";
import { seal } from "@/lib/seal";
import { stagesOn } from "@/lib/stage";
import { now, ticker } from "@/lib/ticker";
import { FORMS, SECTIONS, SHAPES, STAGED, type FormName } from "@/morph/forms";
import { cloudVertex, dotFragment } from "@/morph/shaders";
import styles from "./ParticleMorph.module.css";

/*
 * The site's one cloud of dots. It starts as the portrait in the hero and stays with the reader:
 * as each section arrives it swirls into that section's shape, and at the footer it writes the
 * name. Scroll position alone decides which two shapes it is between and how far, so scrolling
 * back up undoes every morph, all the way to the portrait.
 *
 * Leaving the hero, the figure sinks into the line of names sliding along the bottom, lands on
 * the letters, and streams on from there. Over the hero, the cursor clears the dots around it
 * and the photograph behind shows through. While a hover lens is open anywhere on the page, the
 * dots pack into its circle and become its fill (see lib/lens).
 *
 * Once running it adds `has-particles` to <html>, which is how the page knows to stand its
 * still fallbacks down.
 */

type Form = {
  name: FormName;
  points: Float32Array;
  /** The section this shape belongs to (none for the portrait and the name line). */
  section: HTMLElement | null;
  /** Its place in that section's layout, if the section has one: page coordinates. */
  slot?: { x: number; y: number; size: number } | null;
};

type Frame = [x: number, y: number, size: number, kind: number];

/** The portrait is sampled at this height, so the dot count does not depend on the screen. */
const SOURCE_HEIGHT = 1024;
/** Sampling step by device tier: fewer, larger dots on slower devices. */
const STEP = { high: 3, mid: 4, low: 5 } as const;

/* The morphs follow an eased scroll at a limited speed: a hard flick would otherwise skip
   through them and the dots would jump. Only a real leap (the menu, a restored position)
   goes straight there. */
const FOLLOW = 0.2;
const TOP_SPEED = 0.03; // of the screen's height, per frame
const LEAP = 6; // screens

/* The figure sinks into the name line while the first screen scrolls from EXHALE[0] to
   EXHALE[1] (in screen heights). The name then holds for LINGER and dissolves over DISSOLVE. */
const EXHALE: [number, number] = [0.02, 0.58];
const LINGER = 0.06;
const DISSOLVE = 0.36;

/** Seconds to write the footer name once it is half on screen (it unwrites twice as fast). */
const WRITE = 2.6;
/** How much the medal swells while the seal around it is hovered. */
const SWELL = 1.04;
/** Radius of the circle the cursor clears over the hero portrait, px. */
const REVEAL_RADIUS = 150;

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const yieldToPage = () => new Promise<void>((resolve) => setTimeout(resolve));

export function ParticleMorph() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const revealRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const root = document.documentElement;
    let disposed = false;
    let teardown = () => {};

    const start = async () => {
      let renderer: THREE.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
      } catch {
        root.classList.add("no-webgl");
        return;
      }
      const tier = deviceTier();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, tier === "high" ? 2 : 1.5));
      const scene = new THREE.Scene();
      const camera = new THREE.Camera();
      const reduced = prefersReducedMotion();
      const hover = canHover();
      const intro = createIntro();

      /* ── The shapes ─────────────────────────────────────────────────────────────── */

      const image = await loadPortrait();
      if (disposed) return renderer.dispose();
      const step = STEP[tier];
      const portrait = samplePoints(image, step, { height: SOURCE_HEIGHT, tone: liftShadows });
      const count = portrait.count;
      const portraitAspect = image.width / image.height;
      fx.dots = count;

      const forms: Form[] = [{ name: "portrait", points: portrait.positions, section: null }];
      let nameAspect = 6;

      // The hero's line of names, as the page has laid it out.
      let marquee: HTMLElement | null = null;
      let namePeriod = 1; // px from one name to the next
      let lineWidth = 1;
      let lineHeight = 1;
      const line = sampleNameLine();
      if (line)
        forms.push({
          name: "line",
          points: pairAcross(portrait.positions, line.points, count, line.jitter),
          section: null,
        });
      else if (marquee) (marquee as HTMLElement).style.opacity = "1"; // nothing will write it: let the text itself show

      for (const [selector, name] of SECTIONS) {
        if (stagesOn.get() && STAGED.includes(selector)) continue;
        const section = document.querySelector<HTMLElement>(selector);
        if (!section) continue;
        await yieldToPage(); // building 40,000 points per shape should not freeze the first seconds
        if (disposed) return renderer.dispose();
        let points: Float32Array;
        if (name === "braces") {
          points = (await textPoints("{ }", count)).points;
        } else if (name === "name") {
          const text = await textPoints(site.name, count);
          points = text.points;
          nameAspect = text.aspect;
        } else {
          points = new Float32Array(count * 3);
          SHAPES[name]?.(count, points);
        }
        forms.push({ name, points, section });
      }
      if (disposed) return renderer.dispose();

      /* ── The cloud ──────────────────────────────────────────────────────────────── */

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
      geometry.setAttribute("aFrom", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
      geometry.setAttribute("aTo", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
      geometry.setAttribute("aLum", new THREE.BufferAttribute(portrait.lums, 1));
      geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds(count), 3));

      const uniforms = {
        uFrom: { value: new THREE.Vector4() },
        uTo: { value: new THREE.Vector4() },
        uFromTurn: { value: new THREE.Vector2() },
        uToTurn: { value: new THREE.Vector2() },
        uFromAlpha: { value: 1 },
        uToAlpha: { value: 1 },
        uMix: { value: 0 },
        uTime: { value: 0 },
        uIntro: { value: 0 },
        uSpacing: { value: 1 },
        uDot: { value: 1 },
        uViewport: { value: new THREE.Vector2(1, 1) },
        uPointer: { value: new THREE.Vector2(-999, -999) },
        uHover: { value: 0 },
        uLens: { value: new THREE.Vector3() },
        uLensMax: { value: 1 },
        uLensDot: { value: 1 },
        uReveal: { value: new THREE.Vector3(-9999, -9999, 0) },
        uSwing: { value: 0.18 },
        uMist: { value: 0 },
        uColor: { value: new THREE.Color() },
        uAccent: { value: new THREE.Color(COLORS.accent) },
      };
      const material = new THREE.ShaderMaterial({
        vertexShader: cloudVertex,
        fragmentShader: dotFragment,
        transparent: true,
        depthWrite: false,
        uniforms,
      });
      const cloud = new THREE.Points(geometry, material);
      cloud.frustumCulled = false;
      scene.add(cloud);

      /* ── What it follows ────────────────────────────────────────────────────────── */

      // The dots take the page's foreground colour: sand on ink, ink on sand, and a warmer
      // tone while the code layer is on.
      const onInk = new THREE.Color(COLORS.sand);
      const onSand = new THREE.Color(COLORS.ink);
      const onSource = new THREE.Color(COLORS.accent).lerp(onInk, 0.3);
      const color = new THREE.Color();
      let colorTarget = onInk;
      const readTheme = () => {
        colorTarget = root.classList.contains("is-source") ? onSource : root.dataset.theme === "light" ? onSand : onInk;
      };
      readTheme();
      color.copy(colorTarget);
      const themeWatcher = new MutationObserver(readTheme);
      themeWatcher.observe(root, { attributes: true, attributeFilter: ["data-theme", "class"] });

      // Until the pointer moves it counts as resting at the centre, so shapes face straight ahead.
      const centre = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      const pointer = { x: centre.x, y: centre.y, tx: centre.x, ty: centre.y, over: 0, inside: false };
      const raw = { x: -9999, y: -9999, inside: false, touchUntil: 0 };
      const reveal = { x: 0, y: 0, r: 0 };
      const onMove = (event: PointerEvent) => {
        pointer.tx = event.clientX;
        pointer.ty = event.clientY;
        pointer.inside = true;
        if (event.pointerType === "mouse") {
          raw.x = event.clientX;
          raw.y = event.clientY;
          raw.inside = true;
        }
      };
      const onDown = (event: PointerEvent) => {
        // On touch screens a tap on the portrait opens the photo reveal for a few seconds.
        if (event.pointerType === "mouse") return;
        raw.x = event.clientX;
        raw.y = event.clientY;
        raw.touchUntil = performance.now() + 3000;
      };
      const onLeave = () => {
        pointer.inside = false;
        raw.inside = false;
      };
      const resize = () => renderer.setSize(window.innerWidth, window.innerHeight, false);

      /* ── Where things are on the page ───────────────────────────────────────────── */

      let frame = portraitFrame();
      let nameZone: HTMLElement | null = null;
      let tops: number[] = [];

      function measure() {
        frame = portraitFrame();
        nameZone = document.querySelector<HTMLElement>('[data-fx="name-zone"]');
        tops = forms.map((form) => (form.section ? form.section.getBoundingClientRect().top + window.scrollY : 0));
        for (const form of forms) {
          const box = form.section?.querySelector<HTMLElement>('[data-slot="form"]')?.getBoundingClientRect();
          form.slot = box?.width
            ? {
                x: box.left + box.width / 2,
                y: box.top + box.height / 2 + window.scrollY,
                size: Math.min(box.width, box.height),
              }
            : null;
        }
      }

      /** The box the hero gives the portrait, in page coordinates, and how it is aligned inside it. */
      function portraitFrame() {
        const element =
          document.querySelector<HTMLElement>('[data-fx="portrait"]') ?? document.querySelector<HTMLElement>("#top");
        if (!element)
          return { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight, alignX: 0.5, alignY: 0.5 };
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const read = (property: string, fallback: number) => {
          const value = parseFloat(style.getPropertyValue(property));
          return Number.isFinite(value) ? value : fallback;
        };
        return {
          x: box.left + window.scrollX,
          y: box.top + window.scrollY,
          width: box.width,
          height: box.height,
          alignX: read("--portrait-x", 0.5),
          alignY: read("--portrait-y", 0.5),
        };
      }

      const portraitHeight = () => Math.min(frame.height, frame.width / portraitAspect);

      /** The portrait's rectangle on screen right now. */
      function portraitBox() {
        const height = portraitHeight();
        const width = height * portraitAspect;
        const cx = frame.x + (frame.width - width) * frame.alignX + width / 2;
        const cy = frame.y + (frame.height - height) * frame.alignY + height / 2 - now.scrollY;
        return { left: cx - width / 2, top: cy - height / 2, width, height, cx, cy };
      }

      /**
       * The first three names of the hero's sliding line, painted exactly where the page has
       * them and sampled into points (in line heights, centred).
       */
      function sampleNameLine(): { points: Float32Array; jitter: number } | null {
        marquee = document.querySelector<HTMLElement>('[data-fx="marquee"]');
        const names = marquee ? [...marquee.querySelectorAll<HTMLElement>(":scope > span > span")].slice(0, 3) : [];
        if (!marquee || names.length < 3) return null;
        const box = marquee.getBoundingClientRect();
        const boxes = names.map((name) => name.getBoundingClientRect());
        namePeriod = boxes[1].left - boxes[0].left;
        if (namePeriod <= 0 || boxes[0].height <= 0) return null;

        const style = getComputedStyle(names[0]);
        const grain = Math.max(3, Math.round(parseFloat(style.fontSize) / 34));
        const paint = document.createElement("canvas");
        paint.width = lineWidth = Math.ceil(boxes[2].right - box.left);
        paint.height = lineHeight = Math.ceil(boxes[0].height);
        const context = paint.getContext("2d", { willReadFrequently: true })!;
        context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        if ("letterSpacing" in context) context.letterSpacing = style.letterSpacing;
        context.fillStyle = "#fff";
        names.forEach((name, i) => {
          const text = name.textContent ?? "";
          const metrics = context.measureText(text);
          const ascent = metrics.fontBoundingBoxAscent;
          const baseline = (boxes[i].height - (ascent + metrics.fontBoundingBoxDescent)) / 2 + ascent;
          context.fillText(text, boxes[i].left - box.left, baseline);
        });

        const { data } = context.getImageData(0, 0, paint.width, paint.height);
        const points: number[] = [];
        for (let y = 0; y < paint.height; y += grain) {
          for (let x = 0; x < paint.width; x += grain) {
            if (data[(y * paint.width + x) * 4 + 3] > 128) {
              points.push((x - paint.width / 2) / paint.height, (paint.height / 2 - y) / paint.height, 0);
            }
          }
        }
        return points.length ? { points: new Float32Array(points), jitter: grain / paint.height } : null;
      }

      /**
       * Gives every dot of `from` a place in `target` so that dots keep their left-to-right
       * order: the figure then falls more or less straight down into the letters, instead of
       * each dot crossing the screen to a random one.
       */
      function pairAcross(from: Float32Array, target: Float32Array, total: number, jitter: number): Float32Array {
        const have = target.length / 3;
        const order = Array.from({ length: have }, (_, i) => i).sort(() => Math.random() - 0.5);
        const shuffled = new Float32Array(have * 3);
        order.forEach((source, i) => shuffled.set(target.subarray(source * 3, source * 3 + 3), i * 3));
        const fitted = fitCount(shuffled, total, jitter);
        const byX = (points: Float32Array) =>
          Array.from({ length: total }, (_, i) => i).sort((a, b) => points[a * 3] - points[b * 3]);
        const targetRank = byX(fitted);
        const fromRank = byX(from);
        const out = new Float32Array(total * 3);
        for (let i = 0; i < total; i++)
          out.set(fitted.subarray(targetRank[i] * 3, targetRank[i] * 3 + 3), fromRank[i] * 3);
        return out;
      }

      /* ── Which two shapes, and how far between them ─────────────────────────────── */

      let written = 0; // the footer name, 0..1, advanced in time
      let lastTime = 0;

      /**
       * Each morph runs while the next section's top travels from just below the screen to a
       * third of the way up it. Two exceptions: the figure sinks into the name line over EXHALE,
       * and the footer name is written in time, because it is only on screen for the last
       * stretch of scroll.
       */
      function between(middle: number, vh: number): [from: number, to: number, mix: number] {
        if (forms.length < 2) return [0, 0, 0];
        const scroll = (middle - vh / 2) / vh;
        let previousEnd = -Infinity; // a morph never starts before the one before it has finished
        for (let k = 1; k < forms.length; k++) {
          if (forms[k].name === "name") return [k - 1, k, written];
          if (forms[k].name === "line") {
            if (scroll < EXHALE[1]) return [k - 1, k, clamp((scroll - EXHALE[0]) / (EXHALE[1] - EXHALE[0]))];
            continue;
          }
          let startAt = tops[k] - vh * 0.55;
          let span = vh * 0.7;
          if (forms[k - 1].name === "line") {
            startAt = Math.max(startAt, vh * (EXHALE[1] + LINGER + 0.5));
            span = vh * DISSOLVE;
          }
          startAt = Math.max(startAt, previousEnd);
          previousEnd = startAt + span;
          if (middle < previousEnd) return [k - 1, k, clamp((middle - startAt) / span)];
        }
        return [forms.length - 2, forms.length - 1, 1];
      }

      /** Below laptop width there is no room beside the copy: only the portrait and the names are drawn. */
      function alphaOf(name: FormName, width: number) {
        const { alpha, layout } = FORMS[name];
        return width < 1024 && !["portrait", "name", "line"].includes(layout) ? 0 : alpha;
      }

      let swell = 1;

      function frameOf(form: Form, width: number, height: number): Frame {
        const config = FORMS[form.name];
        const scale = config.scale ?? 1;
        if (form.slot) {
          const grow = form.name === "medal" ? swell : 1;
          return [form.slot.x, form.slot.y - now.scrollY, form.slot.size * (config.slotScale ?? 1) * grow, 1];
        }
        switch (config.layout) {
          case "portrait": {
            const box = portraitBox();
            return [box.cx, box.cy, box.height, 0];
          }
          case "side": {
            const [x, y] = width >= 1024 ? (config.at ?? [0.72, 0.5]) : [0.5, 0.5];
            return [width * x, height * y, Math.min(height * 0.62, width * 0.85) * scale, 1];
          }
          case "center":
            return [width / 2, height / 2, Math.min(height * 0.75, width * 0.9) * scale, 1];
          case "full":
            return [width / 2, height / 2, height, 1];
          case "line": {
            if (!marquee) return [width / 2, height * 0.85, lineHeight, 1];
            // The line slides; the names repeat every `namePeriod` px, so the dots can always
            // sit on the first three names that are still on screen.
            const box = marquee.getBoundingClientRect();
            const skipped = Math.max(0, Math.floor(-box.left / namePeriod));
            return [box.left + skipped * namePeriod + lineWidth / 2, box.top + lineHeight / 2, lineHeight, 1];
          }
          case "name": {
            const word = nameZone?.querySelector<HTMLElement>('[data-fx="name-word"]');
            if (!word || !nameZone) return [width / 2, height * 0.8, (width * 0.9) / nameAspect, 1];
            const wordBox = word.getBoundingClientRect();
            const zoneBox = nameZone.getBoundingClientRect();
            return [
              wordBox.left + wordBox.width / 2,
              zoneBox.top + zoneBox.height * 0.56,
              wordBox.width / 0.98 / nameAspect,
              1,
            ];
          }
        }
      }

      /* ── Every frame ────────────────────────────────────────────────────────────── */

      let frames = 0;
      let pair = "";
      let eased = now.scrollY;
      let clock = 0; // seconds of motion: it stops while the page is held still
      let lastMs = performance.now();

      const tick = (ms: number) => {
        const elapsed = Math.min(0.1, (ms - lastMs) / 1000);
        lastMs = ms;
        if (!still.get()) clock += elapsed;
        const time = reduced ? 0 : clock;
        const width = window.innerWidth;
        const height = window.innerHeight;
        const ratio = renderer.getPixelRatio();
        if (frames++ % 30 === 0) measure();

        // The footer name writes itself once its band is half on screen.
        if (nameZone) {
          const zone = nameZone.getBoundingClientRect();
          const visible = zone.top < height - zone.height * 0.5;
          const dt = Math.min(0.1, time - lastTime);
          written = clamp(written + (visible ? dt / WRITE : (-dt * 2) / WRITE));
        }
        lastTime = time;
        if (reduced && nameZone) written = nameZone.getBoundingClientRect().top < height ? 1 : 0;

        const behind = now.scrollY - eased;
        const limit = height * TOP_SPEED;
        eased += clamp(behind * FOLLOW, -limit, limit);
        if (Math.abs(behind) < 0.5 || Math.abs(behind) > height * LEAP) eased = now.scrollY;

        const [from, to, mix] = between(eased + height / 2, height);
        if (pair !== `${from}-${to}`) {
          pair = `${from}-${to}`;
          (geometry.attributes.aFrom.array as Float32Array).set(forms[from].points);
          (geometry.attributes.aTo.array as Float32Array).set(forms[to].points);
          geometry.attributes.aFrom.needsUpdate = true;
          geometry.attributes.aTo.needsUpdate = true;
        }

        pointer.x += (pointer.tx - pointer.x) * 0.08;
        pointer.y += (pointer.ty - pointer.y) * 0.08;
        pointer.over += ((pointer.inside ? 1 : 0) - pointer.over) * 0.05;
        color.lerp(colorTarget, 0.06);
        swell += ((seal.hovered ? SWELL : 1) - swell) * 0.14;

        // Shapes lean a little towards the pointer, each by its own amount.
        const lean = (0.5 - pointer.y / height) * 2 * 0.08;
        const face = (pointer.x / width - 0.5) * 2 * 0.15;
        const turnOf = (form: Form): [number, number] => {
          const config = FORMS[form.name];
          const follow = config.follow ?? 1;
          return [(config.tilt ?? 0) + lean * follow, time * (config.spin ?? 0) + face * follow];
        };

        const toName = forms[to].name === "name";
        const arrived = toName ? THREE.MathUtils.smoothstep(mix, 0.82, 1) : 0;
        nameZone?.style.setProperty("--arrived", arrived.toFixed(3));

        uniforms.uFrom.value.set(...frameOf(forms[from], width, height));
        uniforms.uTo.value.set(...frameOf(forms[to], width, height));
        uniforms.uFromTurn.value.set(...turnOf(forms[from]));
        uniforms.uToTurn.value.set(...turnOf(forms[to]));
        uniforms.uFromAlpha.value = alphaOf(forms[from].name, width);
        uniforms.uToAlpha.value = alphaOf(forms[to].name, width) * (1 - arrived);
        uniforms.uMix.value = mix;
        uniforms.uSwing.value = toName
          ? 0.1
          : (({ portrait: 0.1, line: 0.07 } as Record<string, number>)[forms[from].name] ?? 0.18);
        uniforms.uMist.value = toName ? 1 : 0;
        uniforms.uTime.value = time;
        uniforms.uIntro.value = intro.progress(time);
        uniforms.uSpacing.value = (portraitHeight() / SOURCE_HEIGHT) * step * ratio;
        uniforms.uDot.value = 1.7 * ratio;
        uniforms.uViewport.value.set(width, height);
        uniforms.uPointer.value.set(pointer.x, pointer.y);
        uniforms.uHover.value = pointer.over;
        uniforms.uLens.value.set(lens.x, lens.y, hover ? lens.r : 0);
        uniforms.uLensMax.value = lens.max;
        uniforms.uLensDot.value = 3.2 * ratio;
        uniforms.uColor.value.copy(color);

        // The photo reveal: only while the cloud is still the portrait, at the top of the page.
        const box = portraitBox();
        const atRest = from === 0 && mix < 0.05 && now.scrollY < 4;
        const pointing = hover ? raw.inside : performance.now() < raw.touchUntil;
        const over =
          pointing &&
          raw.x > box.left &&
          raw.x < box.left + box.width &&
          raw.y > box.top &&
          raw.y < box.top + box.height;
        reveal.r += ((atRest && over ? REVEAL_RADIUS : 0) - reveal.r) * 0.12;
        const catchUp = reveal.r < 1 ? 1 : 0.25; // closed: jump to the pointer, so it opens where the pointer is
        reveal.x += (raw.x - reveal.x) * catchUp;
        reveal.y += (raw.y - reveal.y) * catchUp;
        uniforms.uReveal.value.set(reveal.x, reveal.y, reveal.r);
        const photo = revealRef.current;
        if (photo) {
          photo.style.transform = `translate3d(${box.left}px, ${box.top}px, 0)`;
          photo.style.width = `${box.width}px`;
          photo.style.height = `${box.height}px`;
          photo.style.setProperty("--mx", `${(reveal.x - box.left).toFixed(1)}px`);
          photo.style.setProperty("--my", `${(reveal.y - box.top).toFixed(1)}px`);
          photo.style.setProperty("--r", `${reveal.r.toFixed(1)}px`);
          photo.style.opacity = reveal.r > 1 ? "1" : "0";
        }

        renderer.render(scene, camera);
      };

      measure();
      resize();
      window.addEventListener("resize", resize);
      window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("pointerdown", onDown, { passive: true });
      root.addEventListener("pointerleave", onLeave);
      root.classList.add("has-particles");
      ticker.add(tick);

      teardown = () => {
        ticker.remove(tick);
        intro.dispose();
        themeWatcher.disconnect();
        window.removeEventListener("resize", resize);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerdown", onDown);
        root.removeEventListener("pointerleave", onLeave);
        root.classList.remove("has-particles");
        nameZone?.style.removeProperty("--arrived");
        if (marquee) marquee.style.opacity = "";
        geometry.dispose();
        material.dispose();
        renderer.dispose();
      };
      if (disposed) teardown();
    };

    void start();
    return () => {
      disposed = true;
      teardown();
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className={styles.cloud} data-fx="cloud" aria-hidden="true" />
      {/* The real photograph, exactly behind the dotted portrait: seen through a soft circle
          where the cursor clears the dots. */}
      <div ref={revealRef} className={styles.reveal} aria-hidden="true">
        <img src={PORTRAIT_URL} alt="" />
      </div>
    </>
  );
}
