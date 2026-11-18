"use client";

import { createStore } from "./store";

/**
 * What the device can do, asked once. These are read at call time (never during server
 * rendering), so each is a function.
 */

const query = (media: string) => typeof window !== "undefined" && window.matchMedia(media).matches;

export const prefersReducedMotion = () => query("(prefers-reduced-motion: reduce)");
export const canHover = () => query("(hover: hover)");
export const hasFinePointer = () => query("(hover: hover) and (pointer: fine)");
export const isDesktop = () => query("(min-width: 1024px)");
export const isPhone = () => typeof window !== "undefined" && window.innerWidth < 648;

/** True while the page is held still: the visitor asked for reduced motion. Mirrored on <html> as `is-still`. */
export const still = createStore(false);

export function watchMotionPreference() {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  const apply = () => {
    still.set(media.matches);
    document.documentElement.classList.toggle("is-still", media.matches);
  };
  apply();
  media.addEventListener("change", apply);
  return () => media.removeEventListener("change", apply);
}

export type Tier = "low" | "mid" | "high";

/** A rough class of device, used to choose how many dots to draw and at what pixel ratio. */
export function deviceTier(): Tier {
  const cores = navigator.hardwareConcurrency || 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 4;
  if (isPhone() || cores <= 4 || memory <= 2) return "low";
  return cores < 8 || memory < 4 ? "mid" : "high";
}

const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software|basic render/i;
let webgl: boolean | null = null;

/**
 * Whether there is a GPU worth drawing 40,000 dots on. A software renderer counts as no:
 * the page then uses its still fallbacks (the photo, plain drawings) instead.
 * `?gl=force` in the address skips the test, for checking the scenes on such a machine.
 */
export function hasWebGL(): boolean {
  if (webgl !== null) return webgl;
  if (/[?&]gl=force\b/.test(window.location.search)) return (webgl = true);
  try {
    const gl = document.createElement("canvas").getContext("webgl2", { failIfMajorPerformanceCaveat: true });
    if (!gl) return (webgl = false);
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return (webgl = !SOFTWARE_RENDERER.test(renderer));
  } catch {
    return (webgl = false);
  }
}

/**
 * The pinned, particle-drawn versions of Services, Work and Now building: laptops and up, with
 * motion allowed and a real GPU. Everything else gets the plain list versions of those sections.
 */
export function stagesAvailable(): boolean {
  return isDesktop() && !prefersReducedMotion() && hasWebGL();
}
