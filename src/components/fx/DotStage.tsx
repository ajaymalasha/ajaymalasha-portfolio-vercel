"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { building, process, services, work } from "@/content/sections";
import { COLORS } from "@/lib/particle-kit";
import { stageIndex } from "@/lib/stage";
import { ticker } from "@/lib/ticker";
import { drawFeature, drawService, drawStep, type Palette, type Picture } from "@/morph/drawings";
import { FORMS, flatten, type FormName } from "@/morph/forms";
import { stageFragment, stageVertex } from "@/morph/shaders";
import styles from "./DotStage.module.css";

/*
 * The dot stage: one flat swarm of 64,000 dots that redraws pictures. On laptops and up, the
 * pinned sections (Services, Process, Work, Now building) each give it a place on the page and
 * it draws whatever that section is showing: a diagram, a storefront capture as a dot matrix,
 * or, for the Kinect AI features, what goes in and then what comes out.
 *
 * It takes over from the site's particle cloud and hands back to it. Entering the first stage,
 * the dots lift off from the medal in About (where the cloud was last seen); leaving the last
 * one, they settle into the wave in Experience (where the cloud is about to be).
 */

const COLS = 320;
const ROWS = 200;
const COUNT = COLS * ROWS;
/** Every picture is 16:10: the drawings' canvas and the captures' grid. */
const ASPECT = COLS / ROWS;

/** Seconds for the swarm to settle into a new picture. */
const SETTLE = 0.8;
/** Dot size for drawings, CSS px (captures use the size of one cell of their grid). */
const DOT = 1.5;
/** Highlights of a capture are held down, so the names set over it stay readable. */
const KNEE = 0.42;
const SHOULDER = 0.22;
/** The Kinect AI features alternate between "in" and "out" this often, ms. */
const TURN = 3200;
/** Scrolling fast through a stage still shows every picture: at most one step per this many ms. */
const STEP_EVERY = 300;

type Scene = Picture & {
  /** Selector of the element whose box the picture fills. */
  slot: string;
  /** Captures: one dot per cell of a grid (drawings scatter their dots instead). */
  grid?: boolean;
  /** Draw above the page's content rather than behind it. */
  over?: boolean;
  /** Fit a square of this many slot-sizes, centred, instead of filling the slot. */
  scale?: number;
};

type Act = {
  /** The section that owns this act. */
  section: string;
  index: (typeof stageIndex)[keyof typeof stageIndex];
  scenes?: Scene[];
  /** For the features: [in, out] per item, alternating in time. */
  pairs?: [Scene, Scene][];
};

const yieldToPage = () => new Promise<void>((resolve) => setTimeout(resolve));

function shuffledIndices(count: number): number[] {
  const order = Array.from({ length: count }, (_, i) => i);
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/** A storefront capture as a dot matrix: one dot per cell, in its colour, highlights held down. */
async function capture(url: string, slot: string): Promise<Scene> {
  const image = new Image();
  image.src = url;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = COLS;
  canvas.height = ROWS;
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(image, 0, 0, COLS, ROWS);
  const { data } = context.getImageData(0, 0, COLS, ROWS);
  const to = new Float32Array(COUNT * 2);
  const color = new Float32Array(COUNT * 3);
  // Dots are dealt to cells at random, so going from one capture to the next every dot travels.
  shuffledIndices(COUNT).forEach((cell, dot) => {
    to[dot * 2] = ((cell % COLS) + 0.5) / COLS;
    to[dot * 2 + 1] = (Math.floor(cell / COLS) + 0.5) / ROWS;
    const [r, g, b] = [data[cell * 4], data[cell * 4 + 1], data[cell * 4 + 2]].map((v) => (v / 255) * 1.3);
    const lum = Math.min(1, 0.3 * r + 0.59 * g + 0.11 * b);
    const hold = lum > KNEE ? (KNEE + (lum - KNEE) * SHOULDER) / lum : 1;
    color.set([Math.min(1, r) * hold, Math.min(1, g) * hold, Math.min(1, b) * hold], dot * 3);
  });
  return { to, color, slot, grid: true };
}

/** One of the cloud's shapes, flat, in one colour: where the swarm starts from and returns to. */
function shape(name: FormName, slot: string, rgb: [number, number, number]): Scene {
  const color = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) color.set(rgb, i * 3);
  return { to: flatten(name, COUNT), color, slot, scale: FORMS[name].slotScale };
}

export function DotStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
        return;
      }
      const ratio = Math.min(window.devicePixelRatio, 2);
      renderer.setPixelRatio(ratio);
      const scene = new THREE.Scene();
      const camera = new THREE.Camera();

      /* ── The pictures ───────────────────────────────────────────────────────────── */

      const onSand: Palette = { fg: COLORS.ink, accent: COLORS.accent };
      const onInk: Palette = { fg: COLORS.sand, accent: COLORS.accent };
      const onAccent: Palette = { fg: COLORS.sand, accent: COLORS.ink };

      const captures = await Promise.all(
        work.projects.map((project) => capture(`/work/${project.slug}.webp`, '[data-slot="work"]')),
      );
      const medal = shape("medal", '#about [data-slot="form"]', [0.49, 0.48, 0.46]);
      const wave: Scene = { ...shape("wave", '#experience [data-slot="form"]', [0.6, 0.59, 0.57]), over: true };

      const acts: Act[] = [];
      const serviceScenes: Scene[] = [];
      for (const item of services.items) {
        await yieldToPage();
        serviceScenes.push({ ...drawService(item.id, onSand, COUNT), slot: '[data-slot="services"]' });
      }
      acts.push({ section: "#services", index: stageIndex.services, scenes: serviceScenes });

      const stepScenes: Scene[] = [];
      for (const step of process.steps) {
        await yieldToPage();
        stepScenes.push({ ...drawStep(step.id, onInk, COUNT), slot: '[data-slot="process"]' });
      }
      acts.push({ section: "#process", index: stageIndex.process, scenes: stepScenes });
      acts.push({ section: "#work", index: stageIndex.work, scenes: captures });

      const featurePairs: [Scene, Scene][] = [];
      for (const item of building.items) {
        await yieldToPage();
        const slot = '[data-panel][data-open="true"] [data-slot="apps"]';
        const [input, output] = drawFeature(item.id, onAccent, COUNT);
        featurePairs.push([
          { ...input, slot, over: true },
          { ...output, slot, over: true },
        ]);
      }
      acts.push({ section: "#building", index: stageIndex.building, pairs: featurePairs });
      if (disposed) return renderer.dispose();

      /* ── The swarm ──────────────────────────────────────────────────────────────── */

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
      const scattered = new Float32Array(COUNT * 2);
      for (let i = 0; i < COUNT; i++) {
        scattered[i * 2] = Math.random() * window.innerWidth;
        scattered[i * 2 + 1] = Math.random() * window.innerHeight;
      }
      const first = serviceScenes[0];
      geometry.setAttribute("aFrom", new THREE.BufferAttribute(scattered, 2));
      geometry.setAttribute("aTo", new THREE.BufferAttribute(new Float32Array(first.to), 2));
      geometry.setAttribute("aFromColor", new THREE.BufferAttribute(new Float32Array(first.color), 3));
      geometry.setAttribute("aToColor", new THREE.BufferAttribute(new Float32Array(first.color), 3));
      const seed = new Float32Array(COUNT * 3);
      for (let i = 0; i < seed.length; i++) seed[i] = Math.random();
      geometry.setAttribute("aSeed", new THREE.BufferAttribute(seed, 3));

      const uniforms = {
        uRect: { value: new THREE.Vector4(0, 0, 1, 1) },
        uViewport: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        uPointer: { value: new THREE.Vector2(-999, -999) },
        uMix: { value: 0 },
        uTime: { value: 0 },
        uSize: { value: 2 },
        uRatio: { value: ratio },
        uAlpha: { value: 0 },
      };
      const material = new THREE.ShaderMaterial({
        vertexShader: stageVertex,
        fragmentShader: stageFragment,
        transparent: true,
        depthWrite: false,
        uniforms,
      });
      const swarm = new THREE.Points(geometry, material);
      swarm.frustumCulled = false;
      scene.add(swarm);

      const attribute = (name: string) => geometry.attributes[name].array as Float32Array;
      const touch = () => {
        for (const name of ["aFrom", "aTo", "aFromColor", "aToColor"]) geometry.attributes[name].needsUpdate = true;
      };

      /* ── Changing picture ───────────────────────────────────────────────────────── */

      let mix = 1; // 0..1 into the current picture
      let current: string | null = null; // which picture the swarm is in, or heading home, or null when off

      /**
       * A scene's box on screen: [x, y, width, height], or null if its slot is not on the page.
       * Pictures keep their 16:10 shape whatever the slot's: a drawing is fitted inside its slot,
       * a capture covers its slot (and is clipped to it when drawn).
       */
      function boxOf(target: Scene): [number, number, number, number] | null {
        const box = document.querySelector(target.slot)?.getBoundingClientRect();
        if (!box) return null;
        const cx = box.left + box.width / 2;
        const cy = box.top + box.height / 2;
        if (target.scale) {
          const side = Math.min(box.width, box.height) * target.scale;
          return [cx - side / 2, cy - side / 2, side, side];
        }
        const fit = target.grid ? Math.max : Math.min;
        const width = fit(box.width, box.height * ASPECT);
        return [cx - width / 2, cy - width / ASPECT / 2, width, width / ASPECT];
      }

      // Everything takes off from where it is now: the positions and colours the shader is
      // showing this frame are written back as the starting point, then the target is swapped.
      function retarget(next: Scene) {
        const from = attribute("aFrom");
        const to = attribute("aTo");
        const seeds = attribute("aSeed");
        const fromColor = attribute("aFromColor");
        const toColor = attribute("aToColor");
        const { x, y, z: width, w: height } = uniforms.uRect.value;
        for (let i = 0; i < COUNT; i++) {
          const raw = Math.min(1, Math.max(0, mix * 1.5 - seeds[i * 3 + 2] * 0.5));
          const t = raw * raw * (3 - 2 * raw);
          const arc = Math.sin(t * Math.PI) * 420;
          from[i * 2] += (x + to[i * 2] * width - from[i * 2]) * t + (seeds[i * 3] - 0.5) * arc;
          from[i * 2 + 1] += (y + to[i * 2 + 1] * height - from[i * 2 + 1]) * t + (seeds[i * 3 + 1] - 0.5) * arc;
          for (let c = 0; c < 3; c++) fromColor[i * 3 + c] += (toColor[i * 3 + c] - fromColor[i * 3 + c]) * t;
        }
        to.set(next.to);
        toColor.set(next.color);
        touch();
        mix = 0;
      }

      /** Start from `home` (where the cloud left its shape) and fly to `next`. */
      function liftOff(home: Scene, next: Scene) {
        const box = boxOf(home);
        if (!box) return retarget(next);
        const from = attribute("aFrom");
        for (let i = 0; i < COUNT; i++) {
          from[i * 2] = box[0] + home.to[i * 2] * box[2];
          from[i * 2 + 1] = box[1] + home.to[i * 2 + 1] * box[3];
        }
        attribute("aFromColor").set(home.color);
        attribute("aTo").set(next.to);
        attribute("aToColor").set(next.color);
        touch();
        uniforms.uAlpha.value = 1;
        mix = 0;
      }

      /** Above the first stage the cloud is the medal; below the last it becomes the wave. */
      const home = () => ((document.querySelector("#services")?.getBoundingClientRect().top ?? 0) > 0 ? medal : wave);

      /* ── Which picture is due ───────────────────────────────────────────────────── */

      let shownIndex = -1;
      let shownSince = 0;
      let lastAct: Act | null = null;
      let steppedAt = 0;

      function due(): { key: string; scene: Scene } | null {
        const vh = window.innerHeight;
        for (const act of acts) {
          const box = document.querySelector(act.section)?.getBoundingClientRect();
          if (!box || box.top > vh * 0.5 || box.bottom < vh * 0.5) continue;

          if (act.pairs) {
            // The section says which feature is open; this layer alternates its two pictures.
            const index = Math.min(act.index.get(), act.pairs.length - 1);
            const time = performance.now();
            if (index !== shownIndex) {
              shownIndex = index;
              shownSince = time;
            }
            const side = Math.floor((time - shownSince) / TURN) % 2;
            return { key: `${act.section}-${index}-${side}`, scene: act.pairs[index][side] };
          }

          const scenes = act.scenes ?? [];
          const progress = Math.min(0.999, Math.max(0, -box.top / Math.max(1, box.height - vh)));
          const target = Math.floor(progress * scenes.length);
          const time = performance.now();
          if (act !== lastAct) {
            lastAct = act;
            act.index.set(target);
            steppedAt = time;
          } else if (act.index.get() !== target && time - steppedAt > STEP_EVERY) {
            act.index.set(act.index.get() + Math.sign(target - act.index.get()));
            steppedAt = time;
          }
          const index = Math.min(Math.max(act.index.get(), 0), scenes.length - 1);
          return { key: `${act.section}-${index}`, scene: scenes[index] };
        }
        lastAct = null;
        return null;
      }

      /* ── Every frame ────────────────────────────────────────────────────────────── */

      const pointer = { x: -999, y: -999 };
      const onMove = (event: PointerEvent) => {
        pointer.x = event.clientX;
        pointer.y = event.clientY;
      };
      const resize = () => {
        renderer.setSize(window.innerWidth, window.innerHeight, false);
        uniforms.uViewport.value.set(window.innerWidth, window.innerHeight);
      };
      let lastMs = 0;

      const tick = (ms: number) => {
        const dt = Math.min(0.1, (ms - lastMs) / 1000);
        lastMs = ms;
        let next = due();

        if (next && !current) {
          liftOff(home(), next.scene);
          current = next.key;
        }
        if (!next && current) {
          // No stage on screen: go home, then switch off and let the cloud take over.
          const target = home();
          const key = target === medal ? "home-above" : "home-below";
          if (current !== key) {
            retarget(target);
            current = key;
          }
          if (mix >= 1) {
            current = null;
            uniforms.uAlpha.value = 0;
            renderer.clear();
          } else {
            next = { key, scene: target };
          }
        }

        root.classList.toggle("dots-active", !!current);
        root.classList.toggle("dots-over", !!current && !!next?.scene.over);
        if (!current || !next) return;

        if (next.key !== current) {
          retarget(next.scene);
          current = next.key;
        }
        mix = Math.min(1, mix + dt / SETTLE);

        const box = boxOf(next.scene);
        if (box) uniforms.uRect.value.set(...box);
        uniforms.uSize.value = next.scene.grid ? (uniforms.uRect.value.z / COLS) * 1.14 : DOT;
        uniforms.uMix.value = mix;
        uniforms.uTime.value = ms / 1000;
        uniforms.uPointer.value.set(pointer.x, pointer.y);

        // A capture stays inside its stage even while its dots are in flight.
        renderer.setScissorTest(false);
        renderer.clear();
        const clip = next.scene.grid ? document.querySelector(next.scene.slot)?.getBoundingClientRect() : null;
        if (clip) {
          renderer.setScissorTest(true);
          renderer.setScissor(clip.left, window.innerHeight - clip.bottom, clip.width, clip.height);
        }
        renderer.render(scene, camera);
      };

      resize();
      window.addEventListener("resize", resize);
      window.addEventListener("pointermove", onMove, { passive: true });
      ticker.add(tick);

      teardown = () => {
        ticker.remove(tick);
        window.removeEventListener("resize", resize);
        window.removeEventListener("pointermove", onMove);
        root.classList.remove("dots-active", "dots-over");
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

  return <canvas ref={canvasRef} className={styles.stage} data-fx="stage" aria-hidden="true" />;
}
