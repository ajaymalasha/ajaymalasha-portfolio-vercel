import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Euler,
  LinearSRGBColorSpace,
  MathUtils,
  Matrix4,
  PerspectiveCamera,
  Plane,
  Points,
  Raycaster,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderer,
} from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { chapters } from "@/content/story";
import { audioLevel, ping, setMood, whoosh } from "@/lib/audio";
import { deviceTier, hasFinePointer, hasWebGL, prefersReducedMotion } from "@/lib/device";
import { COLORS, createIntro, loadPortrait, seeds } from "@/lib/particle-kit";
import { getLenis } from "@/lib/scroll";
import type { Store } from "@/lib/store";
import { ticker } from "@/lib/ticker";
import { fragmentShader, vertexShader } from "./shaders";
import { buildShape, PORTRAIT_HEIGHT, PORTRAIT_RELIEF, type Shape, type StoryLabel, type Vec3 } from "./shapes";
import { HOLD, placeAt, spanPx, STAGING, type Place } from "./staging";

/**
 * Everything in the story that is not markup: where the scroll position puts us, the three.js
 * scene, the pointer, and the few elements that are moved every frame (labels, card, ring,
 * photo). The component renders from `ui` and hands over its elements.
 *
 * Without WebGL (or on a software renderer) only the first part runs: the text still changes
 * with the scroll, over a plain background.
 */

export type RingMode = "idle" | "drag" | "hot" | "open" | "reveal" | "snap-pill" | "snap-text" | "snap-tick";
/** Which of the ring's words to show (the words themselves are in content/story). */
export type RingText = "drag" | "visit" | "reveal" | "";

export type StoryUi = {
  chapter: number;
  /** False while one shape is turning into the next: the text is hidden then. */
  settled: boolean;
  /** The visitor has started scrolling: the scroll hint can go. */
  begun: boolean;
  labels: readonly StoryLabel[];
  hot: StoryLabel | null;
  /** The last thing hovered: the card keeps its text while it fades out. */
  card: StoryLabel | null;
  ring: RingMode;
  ringText: RingText;
  dragging: boolean;
  /** The scene is running: the ring cursor replaces the pointer. */
  live: boolean;
};

export type StoryElements = {
  root: HTMLElement;
  canvas: HTMLCanvasElement;
  labels: HTMLElement;
  card: HTMLElement;
  ring: HTMLElement;
  reveal: HTMLElement;
};

const DOTS = { low: 9000, mid: 16000, high: 24000 } as const;
/** How near the pointer has to be to a labelled thing, in pixels. */
const REACH = 80;
const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
/** One note per chapter, climbing a scale the soundtrack is also in. */
const CHAPTER_NOTES = [64, 66, 67, 69, 71, 73, 74, 76, 78, 79, 81, 83].map(hz);
const HOVER_NOTES = [76, 78, 81, 83, 86, 88, 90].map(hz);

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

export const INITIAL_UI: StoryUi = {
  chapter: 0,
  settled: true,
  begun: false,
  labels: [],
  hot: null,
  card: null,
  ring: "idle",
  ringText: "drag",
  dragging: false,
  live: false,
};

/** Starts the story on the component's elements; `ui` is the store the component renders from. */
export function createStory(el: StoryElements, ui: Store<StoryUi>) {
  const staging = chapters.map((chapter) => STAGING[chapter.id]);
  const reduced = prefersReducedMotion();
  const fine = hasFinePointer();
  const lenis = getLenis();
  let disposed = false;

  ui.set(INITIAL_UI);
  const patch = (next: Partial<StoryUi>) => {
    const current = ui.get();
    const changed = (Object.keys(next) as (keyof StoryUi)[]).some((key) => !Object.is(current[key], next[key]));
    if (changed) ui.set({ ...current, ...next });
  };

  let scrollY = window.scrollY;
  let shapes: Shape[] = [];
  let hot: StoryLabel | null = null;
  let hotGroup: { value: number } | null = null;
  /** The link or button the ring has snapped around. */
  let snapped: Element | null = null;

  function setHot(label: StoryLabel | null) {
    if (hot === label) return;
    hot = label;
    if (label) {
      if (hotGroup) hotGroup.value = label.group;
      ping(HOVER_NOTES[label.group % HOVER_NOTES.length], 0.07);
      patch({ hot: label, card: label });
    } else {
      patch({ hot: null });
    }
    if (snapped && !label) return;
    patch({
      ring: label ? (label.href ? "open" : "hot") : "idle",
      ringText: label?.href ? "visit" : label ? "" : "drag",
    });
  }

  function show(place: Place) {
    const { chapter } = ui.get();
    if (place.current !== chapter) {
      setMood(staging[place.current].mood);
      whoosh();
      ping(CHAPTER_NOTES[place.current % CHAPTER_NOTES.length], 0.05);
      setHot(null);
    }
    patch({
      chapter: place.current,
      settled: place.mix < 0.25 || place.mix > 0.75,
      begun: place.progress > 0.05,
      labels: shapes[place.current]?.labels ?? [],
    });
  }

  /** Where the last tap was made, in scroll terms: scrolling on lets go of what it selected. */
  let tapScroll = 0;
  const pointer = { x: -9999, y: -9999, inside: false, overUi: false };

  const onScroll = ({ scroll }: { scroll: number }) => {
    scrollY = scroll;
    if (!fine && Math.abs(scroll - tapScroll) > 40) pointer.inside = false;
    show(placeAt(scroll));
  };
  lenis.on("scroll", onScroll);
  show(placeAt(scrollY));
  setMood(staging[ui.get().chapter].mood);

  let stopScene: (() => void) | null = null;
  void startScene().catch(() => {
    // The text works without the scene.
  });

  async function startScene() {
    if (!hasWebGL()) return;
    const image = await loadPortrait().catch(() => null);
    if (disposed) return;

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ canvas: el.canvas, alpha: false, antialias: false });
    } catch {
      return;
    }
    const tier = deviceTier();
    const count = DOTS[tier];
    // The colours are already the ones we want on screen: skip three's colour management.
    const raw = (hex: string) => new Color().setStyle(hex, LinearSRGBColorSpace);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, tier === "high" ? 2 : 1.5));
    renderer.outputColorSpace = LinearSRGBColorSpace;
    renderer.setClearColor(raw(COLORS.ink), 1);

    // Building eleven shapes takes a moment: let a frame through between each.
    const built: Shape[] = [];
    for (const chapter of chapters) {
      built.push(await buildShape(chapter.id, count, image));
      await new Promise((resolve) => setTimeout(resolve));
      if (disposed) return renderer.dispose();
    }
    shapes = built;

    const scene = new Scene();
    const camera = new PerspectiveCamera(42, 1, 0.1, 200);
    const geometry = new BufferGeometry();
    const attribute = (name: string, size: number, data: Float32Array = new Float32Array(count * size)) => {
      const buffer = new BufferAttribute(data, size);
      geometry.setAttribute(name, buffer);
      return buffer;
    };
    attribute("position", 3);
    const pair = {
      aFrom: attribute("aFrom", 3),
      aTo: attribute("aTo", 3),
      aParamFrom: attribute("aParamFrom", 1),
      aParamTo: attribute("aParamTo", 1),
      aGroupFrom: attribute("aGroupFrom", 1),
      aGroupTo: attribute("aGroupTo", 1),
      aTurnFrom: attribute("aTurnFrom", 3),
      aTurnTo: attribute("aTurnTo", 3),
    };
    attribute("aSeed", 3, seeds(count));

    const bloom = tier !== "low";
    const uniforms = {
      uMix: { value: 0 },
      uTime: { value: 0 },
      uTurn: { value: 0 },
      uIntro: { value: 0 },
      uSpinFrom: { value: 0 },
      uSpinTo: { value: 0 },
      uWaveFrom: { value: new Vector4() },
      uWaveTo: { value: new Vector4() },
      uLumFrom: { value: 0 },
      uLumTo: { value: 0 },
      uSize: { value: 30 },
      uPixelRatio: { value: renderer.getPixelRatio() },
      uCursor: { value: new Vector3(999, 999, 999) },
      uCursorVel: { value: new Vector3() },
      uCursorAmt: { value: 0 },
      uHotGroup: { value: -9 },
      uHotAmt: { value: 0 },
      uStreak: { value: 0 },
      uAudio: { value: 0 },
      uFocus: { value: 14 },
      uReveal: { value: 0 },
      uReach: { value: 1 },
      uBloom: { value: bloom ? 1 : 0 },
      uColor: { value: raw(COLORS.sand) },
      uAccent: { value: raw(COLORS.accent) },
    };
    hotGroup = uniforms.uHotGroup;
    const material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      transparent: true,
      depthWrite: false,
    });
    const cloud = new Points(geometry, material);
    cloud.frustumCulled = false;
    cloud.matrixAutoUpdate = false;
    scene.add(cloud);

    let composer: EffectComposer | null = null;
    if (bloom) {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      composer.addPass(new UnrealBloomPass(new Vector2(window.innerWidth, window.innerHeight), 0.7, 0.45, 0.85));
      composer.addPass(new OutputPass());
    }

    const intro = createIntro(2.2);
    const startedAt = performance.now();
    /** The story's own clock: it nearly stops while something is hovered, so the thing holds still. */
    let clock = 0;
    let lastTime = 0;
    let baseFov = 42;
    let speed = 0;
    let revealUntil = 0;
    let loaded = { from: -1, to: -1 };
    const enteredAt = chapters.map(() => 0);
    const orbit = { yaw: 0, pitch: 0, vYaw: 0, vPitch: 0 };
    let press: { x: number; y: number; hot: StoryLabel | null } | null = null;
    let dragging = false;
    const ringAt = { x: -9999, y: -9999 };
    const photo = {
      rect: null as null | { left: number; right: number; top: number; bottom: number },
      inside: false,
      x: 0,
      y: 0,
      r: 0,
    };
    const photoAspect = image ? image.width / image.height : 1;

    const cursor = new Vector3(999, 999, 999);
    const cursorVel = new Vector3();
    const raycaster = new Raycaster();
    const ndc = new Vector2();
    const plane = new Plane();
    const hit = new Vector3();
    const step = new Vector3();
    const forward = new Vector3();
    const focus = new Vector3();
    const point = new Vector3();
    const toCamera = new Vector3();
    const turned = new Matrix4();
    const euler = new Euler();

    const facingAngle = (shape: Shape) => (shape.facing ? Math.atan2(-shape.facing[0], shape.facing[2]) : 0);
    function spinOf(index: number) {
      const shape = shapes[index];
      if (reduced) return facingAngle(shape);
      const { spin } = staging[index];
      return shape.facing ? facingAngle(shape) + Math.sin(clock * spin * 4) * 0.35 : spin * (clock - enteredAt[index]);
    }

    /** A point of a shape, as it is on screen now: after the shape's spin and the visitor's drag. */
    function toWorld([x, y, z]: Vec3, spin: number, out: Vector3) {
      const c = Math.cos(spin);
      const s = Math.sin(spin);
      return out.set(x * c + z * s, y, z * c - x * s).applyMatrix4(cloud.matrixWorld);
    }
    /** `out` in pixels (z above 1 means behind the camera). */
    function toScreen(out: Vector3) {
      out.project(camera);
      out.x = ((out.x + 1) / 2) * window.innerWidth;
      out.y = ((1 - out.y) / 2) * window.innerHeight;
      return out;
    }
    /** For shapes with a facing side: how squarely a world point faces the camera (below 0.1 is the far side). */
    function facingCamera(world: Vector3) {
      toCamera.copy(camera.position).sub(world).normalize();
      return point.copy(world).normalize().dot(toCamera);
    }

    function load(from: number, to: number) {
      if (from === loaded.from && to === loaded.to) return;
      // A shape that was not on show starts its spin from zero when it comes in.
      if (to !== loaded.to) enteredAt[to] = clock;
      if (from !== loaded.from && from !== loaded.to) enteredAt[from] = clock;
      loaded = { from, to };
      const write = (buffer: BufferAttribute, data: Float32Array) => {
        (buffer.array as Float32Array).set(data);
        buffer.needsUpdate = true;
      };
      write(pair.aFrom, shapes[from].pos);
      write(pair.aTo, shapes[to].pos);
      write(pair.aParamFrom, shapes[from].param);
      write(pair.aParamTo, shapes[to].param);
      write(pair.aGroupFrom, shapes[from].group);
      write(pair.aGroupTo, shapes[to].group);
      write(pair.aTurnFrom, shapes[from].turn);
      write(pair.aTurnTo, shapes[to].turn);
    }

    function stand(index: number, travelled: number): { pos: Vec3; target: Vec3 } {
      const { pos, target, dolly, pan = dolly } = staging[index].camera;
      // On a tall screen the camera still travels sideways, but keeps looking at the middle.
      const tall = camera.aspect < 1;
      return {
        pos: [pos[0] + dolly[0] * travelled, pos[1] + dolly[1] * travelled, pos[2] + dolly[2] * travelled],
        target: [
          target[0] + (tall ? 0 : pan[0] * travelled),
          target[1] + pan[1] * travelled,
          target[2] + pan[2] * travelled,
        ],
      };
    }

    /** The labelled thing nearest the pointer, if any is within reach. */
    function pick(index: number, spin: number): StoryLabel | null {
      if (!pointer.inside || pointer.overUi || dragging || !ui.get().settled) return null;
      const facing = !!shapes[index].facing;
      const distance = (at: Vec3) => {
        toWorld(at, spin, hit);
        if (facing && facingCamera(hit) < 0.1) return Infinity;
        toScreen(hit);
        return hit.z > 1 ? Infinity : Math.hypot(hit.x - pointer.x, hit.y - pointer.y);
      };
      let best: StoryLabel | null = null;
      let nearest = fine ? REACH : REACH * 1.3;
      for (const label of shapes[index].labels) {
        // The one already lit is easier to stay on than the others are to reach.
        const d = Math.min(distance(label.anchor), distance(label.pos)) / (label === hot ? 1.5 : 1);
        if (d < nearest) {
          nearest = d;
          best = label;
        }
      }
      return best;
    }

    /** The photo's rectangle on screen: the picture plane's corners, projected. */
    function photoRect() {
      const h = PORTRAIT_HEIGHT;
      const w = h * photoAspect;
      const rect = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
      for (const [x, y] of [
        [-w / 2, -h / 2],
        [w / 2, -h / 2],
        [-w / 2, h / 2],
        [w / 2, h / 2],
      ]) {
        toScreen(toWorld([x, y, PORTRAIT_RELIEF / 2], 0, hit));
        rect.left = Math.min(rect.left, hit.x);
        rect.right = Math.max(rect.right, hit.x);
        rect.top = Math.min(rect.top, hit.y);
        rect.bottom = Math.max(rect.bottom, hit.y);
      }
      return rect;
    }

    const frame = () => {
      const time = (performance.now() - startedAt) / 1000;
      const place = placeAt(scrollY);
      const { from, to, mix, current } = place;
      clock += Math.min(time - lastTime, 0.1) * (hot ? 0.06 : 1);
      lastTime = time;
      load(from, to);
      show(place);

      // Camera: drifts through the chapter's hold, then eases to where the next chapter starts.
      const here = stand(from, Math.min(place.within / HOLD, 1));
      const next = stand(to, 0);
      const eased = easeInOut(mix);
      const target = lerp3(here.target, next.target, eased);
      // A narrow screen sees less of the shape: stand further back.
      const back = MathUtils.clamp(0.8 / camera.aspect, 1, 1.8);
      uniforms.uReach.value = back;
      // ...and further back the dots would thin out to nothing: let them grow a little.
      uniforms.uSize.value = 30 * Math.sqrt(back);
      const eye = lerp3(here.pos, next.pos, eased);
      camera.position.set(
        target[0] + (eye[0] - target[0]) * back,
        target[1] + (eye[1] - target[1]) * back,
        target[2] + (eye[2] - target[2]) * back,
      );
      camera.lookAt(target[0], target[1], target[2]);
      focus.set(target[0], target[1], target[2]);

      // Dragging turns the cloud about what the camera is looking at; let go and it coasts, then springs back.
      if (!dragging) {
        orbit.yaw += orbit.vYaw;
        orbit.pitch += orbit.vPitch;
        orbit.vYaw *= 0.94;
        orbit.vPitch *= 0.94;
        orbit.yaw *= 0.985;
        orbit.pitch *= 0.97;
      }
      turned.makeRotationFromEuler(euler.set(orbit.pitch, orbit.yaw, 0));
      point.copy(focus).applyMatrix4(turned);
      turned.setPosition(focus.x - point.x, focus.y - point.y, focus.z - point.z);
      cloud.matrix.copy(turned);
      cloud.updateMatrixWorld(true);

      // Fast scrolling widens the lens and streaks the dots.
      speed += ((lenis.velocity || 0) - speed) * 0.15;
      const streak = reduced ? 0 : MathUtils.clamp(speed / 40, -1.5, 1.5);
      const fov = baseFov + Math.abs(streak) * 5;
      if (Math.abs(camera.fov - fov) > 0.01) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }

      const spinFrom = spinOf(from);
      const spinTo = spinOf(to);
      const spinNow = current === from ? spinFrom : spinTo;

      // The cursor's place in the cloud: where its ray meets the plane through the target.
      const touching = !fine && time < revealUntil;
      let field = 0;
      if ((pointer.inside && fine && !pointer.overUi) || touching) {
        ndc.set((pointer.x / window.innerWidth) * 2 - 1, -(pointer.y / window.innerHeight) * 2 + 1);
        raycaster.setFromCamera(ndc, camera);
        plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(forward), focus);
        if (raycaster.ray.intersectPlane(plane, hit)) {
          cloud.worldToLocal(hit);
          if (cursor.x === 999) cursor.copy(hit);
          step.copy(hit).sub(cursor);
          cursor.addScaledVector(step, 0.25);
          cursorVel.lerp(step.clampLength(0, 1.2), 0.2);
          field = 1;
        }
      }
      cursorVel.multiplyScalar(0.92);
      uniforms.uCursor.value.copy(cursor);
      uniforms.uCursorVel.value.copy(cursorVel);
      uniforms.uCursorAmt.value += (field * (reduced ? 0.5 : 1) - uniforms.uCursorAmt.value) * 0.08;

      setHot(pick(current, spinNow));

      const settled = ui.get().settled;
      const onPortrait = chapters[current].id === "portrait" && !!image && settled && !dragging;
      photo.rect = onPortrait ? photoRect() : null;
      photo.inside =
        !!photo.rect &&
        (touching || (fine && pointer.inside && !pointer.overUi)) &&
        pointer.x > photo.rect.left &&
        pointer.x < photo.rect.right &&
        pointer.y > photo.rect.top &&
        pointer.y < photo.rect.bottom;
      uniforms.uReveal.value += ((onPortrait ? 1 : 0) - uniforms.uReveal.value) * 0.1;
      if (!hot && !dragging && !snapped) {
        patch({ ring: photo.inside ? "reveal" : "idle", ringText: photo.inside ? "reveal" : "drag" });
      }
      uniforms.uHotAmt.value += ((hot ? 1 : 0) - uniforms.uHotAmt.value) * 0.12;

      uniforms.uMix.value = mix;
      uniforms.uTime.value = reduced ? 0 : time;
      uniforms.uTurn.value = reduced ? 0 : clock;
      uniforms.uIntro.value = 1 - Math.pow(1 - intro.progress(time), 3);
      uniforms.uSpinFrom.value = spinFrom;
      uniforms.uSpinTo.value = spinTo;
      uniforms.uWaveFrom.value.fromArray(staging[from].wave);
      uniforms.uWaveTo.value.fromArray(staging[to].wave);
      uniforms.uLumFrom.value = staging[from].sizeByLum ? 1 : 0;
      uniforms.uLumTo.value = staging[to].sizeByLum ? 1 : 0;
      uniforms.uStreak.value = streak;
      uniforms.uAudio.value += (audioLevel() - uniforms.uAudio.value) * 0.2;
      uniforms.uFocus.value = camera.position.distanceTo(focus);

      if (composer) composer.render();
      else renderer.render(scene, camera);

      placeLabels(current, spinNow, mix);
      placeCard(spinNow);
      placeRing();
      placePhoto();
    };

    function placeLabels(index: number, spin: number, mix: number) {
      const { labels } = ui.get();
      const nodes = el.labels.children;
      if (nodes.length !== labels.length) return; // React has not caught up with the chapter yet
      // Labels fade out as the shape starts to come apart.
      const whole = 1 - MathUtils.smoothstep(Math.min(mix, 1 - mix), 0.1, 0.3);
      const facing = !!shapes[index].facing;
      labels.forEach((label, i) => {
        const node = nodes[i] as HTMLElement;
        toWorld(label.pos, spin, hit);
        const front = !facing || facingCamera(hit) > 0.1;
        const nearness = MathUtils.clamp((40 - hit.distanceTo(camera.position)) / 14, 0, 1);
        toScreen(hit);
        node.style.transform = `translate3d(${hit.x.toFixed(1)}px, ${hit.y.toFixed(1)}px, 0) translate(-50%, -50%)`;
        node.style.opacity = hit.z < 1 && front ? (whole * nearness).toFixed(3) : "0";
      });
    }

    function placeCard(spin: number) {
      if (!hot) return;
      toScreen(toWorld(hot.anchor, spin, hit));
      const w = el.card.offsetWidth;
      const h = el.card.offsetHeight;
      // Beside the thing, on whichever side has room.
      const x = hit.x > window.innerWidth - w - 72 ? hit.x - 56 - w : hit.x + 56;
      const left = MathUtils.clamp(x, 12, Math.max(12, window.innerWidth - w - 12));
      const top = MathUtils.clamp(hit.y - h / 2, 72, Math.max(72, window.innerHeight - h - 12));
      el.card.style.transform = `translate3d(${left.toFixed(1)}px, ${top.toFixed(1)}px, 0)`;
    }

    function placeRing() {
      const rect = snapped?.getBoundingClientRect();
      const x = rect ? rect.left + rect.width / 2 : pointer.x;
      const y = rect ? rect.top + rect.height / 2 : pointer.y;
      const pull = rect ? 0.3 : 0.2;
      ringAt.x += (x - ringAt.x) * pull;
      ringAt.y += (y - ringAt.y) * pull;
      const style = el.ring.style;
      style.transform = `translate3d(${ringAt.x.toFixed(1)}px, ${ringAt.y.toFixed(1)}px, 0)`;
      if (rect && snapped) {
        // Wrapped around the control: a circle for the rail's ticks, a box for text links, a pill for buttons.
        const kind = ringKind(snapped);
        const pad = kind === "tick" ? 4 : kind === "text" ? 10 : 6;
        style.setProperty("--rw", `${rect.width + pad * 2}px`);
        style.setProperty("--rh", `${(kind === "tick" ? rect.width : rect.height) + pad * 2}px`);
        style.setProperty("--rr", kind === "text" ? "10px" : "999px");
      } else {
        style.removeProperty("--rw");
        style.removeProperty("--rh");
        style.removeProperty("--rr");
      }
      style.opacity = fine && pointer.inside && (rect || !pointer.overUi) ? "1" : "0";
    }

    function placePhoto() {
      const style = el.reveal.style;
      const { rect } = photo;
      photo.r += ((photo.inside ? 160 : 0) - photo.r) * 0.12;
      if (rect) {
        photo.x += (pointer.x - rect.left - photo.x) * 0.25;
        photo.y += (pointer.y - rect.top - photo.y) * 0.25;
        style.transform = `translate3d(${rect.left.toFixed(1)}px, ${rect.top.toFixed(1)}px, 0)`;
        style.width = `${(rect.right - rect.left).toFixed(1)}px`;
        style.height = `${(rect.bottom - rect.top).toFixed(1)}px`;
        style.setProperty("--mx", `${photo.x.toFixed(1)}px`);
        style.setProperty("--my", `${photo.y.toFixed(1)}px`);
      }
      style.setProperty("--r", `${photo.r.toFixed(1)}px`);
      style.opacity = rect && photo.r > 1 ? "1" : "0";
    }

    /* ── The pointer ─────────────────────────────────────────────────────────────────────── */

    /** Anything other than the empty background: text, the rail, the dock. The scene ignores the pointer there. */
    const isUi = (target: EventTarget | null) =>
      target instanceof Element &&
      target !== el.root &&
      target !== document.body &&
      target !== document.documentElement;
    const ringKind = (control: Element) => {
      const kind = control.closest("[data-ring]")?.getAttribute("data-ring");
      return kind === "tick" || kind === "text" ? kind : "pill";
    };
    const restRing = () =>
      patch({ ring: hot ? (hot.href ? "open" : "hot") : "idle", ringText: hot?.href ? "visit" : hot ? "" : "drag" });

    const onMove = (event: PointerEvent) => {
      if (ringAt.x === -9999) {
        ringAt.x = event.clientX;
        ringAt.y = event.clientY;
      }
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.inside = true;
      pointer.overUi = isUi(event.target);

      const control = event.target instanceof Element ? event.target.closest("a, button") : null;
      if (control !== snapped) {
        snapped = control;
        if (control) patch({ ring: `snap-${ringKind(control)}`, ringText: "" });
        else if (!hot) patch({ ring: "idle", ringText: "drag" });
      }

      if (
        press &&
        !dragging &&
        event.pointerType === "mouse" &&
        Math.hypot(event.clientX - press.x, event.clientY - press.y) > 5
      ) {
        dragging = true;
        patch({ dragging: true, ring: "drag", ringText: "" });
      }
      if (dragging) {
        orbit.vYaw = (event.movementX || 0) * 0.004;
        orbit.vPitch = (event.movementY || 0) * 0.003;
        orbit.yaw += orbit.vYaw;
        orbit.pitch = MathUtils.clamp(orbit.pitch + orbit.vPitch, -0.6, 0.6);
      }
    };

    const onDown = (event: PointerEvent) => {
      if (isUi(event.target) || event.button !== 0) return;
      press = { x: event.clientX, y: event.clientY, hot };
    };

    const onUp = (event: PointerEvent) => {
      const wasDragging = dragging;
      dragging = false;
      patch({ dragging: false });
      if (!press) return;
      const moved = Math.hypot(event.clientX - press.x, event.clientY - press.y);
      const pressed = press.hot;
      press = null;
      if (!wasDragging && moved < 6) {
        let open = pressed;
        if (event.pointerType !== "mouse") {
          // A finger has no hover: the first tap selects, a second tap on the same thing opens it.
          pointer.x = event.clientX;
          pointer.y = event.clientY;
          pointer.inside = true;
          pointer.overUi = false;
          tapScroll = scrollY;
          const before = hot;
          const index = ui.get().chapter;
          open = pick(index, spinOf(index));
          setHot(open);
          if (open !== before) open = null;
          if (chapters[index].id === "portrait") revealUntil = (performance.now() - startedAt) / 1000 + 3;
        }
        if (open?.href) window.open(open.href, "_blank", "noopener");
      }
      restRing();
    };

    const onCancel = () => {
      press = null;
      dragging = false;
      patch({ dragging: false });
    };

    const onLeave = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      pointer.inside = false;
      onCancel();
    };

    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      renderer.setSize(w, h, false);
      composer?.setSize(w, h);
      camera.aspect = w / h;
      baseFov = camera.aspect < 1 ? 62 : 42;
      camera.fov = baseFov;
      // Push the scene off-centre to leave the text its corner: right on wide screens, up on tall ones.
      if (camera.aspect >= 1) camera.setViewOffset(w, h, -w * 0.14, 0, w, h);
      else camera.setViewOffset(w, h, 0, h * 0.14, w, h);
      camera.updateProjectionMatrix();
    };

    onResize();
    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    document.documentElement.addEventListener("pointerleave", onLeave);
    document.documentElement.classList.add("has-ring-cursor");
    patch({ live: true });
    ticker.add(frame);

    stopScene = () => {
      ticker.remove(frame);
      intro.dispose();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      document.documentElement.classList.remove("has-ring-cursor");
      composer?.dispose();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }

  return {
    /** Scroll to a chapter (the rail). */
    goTo(index: number) {
      lenis.scrollTo(index * spanPx(), { duration: 2.2, immediate: reduced, force: true });
    },
    dispose() {
      disposed = true;
      lenis.off("scroll", onScroll);
      stopScene?.();
      setMood(0.5);
    },
  };
}

export type Story = ReturnType<typeof createStory>;
