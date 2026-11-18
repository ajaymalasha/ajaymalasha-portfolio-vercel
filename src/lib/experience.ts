"use client";

import { STORY_ENABLED } from "@/content/site";
import { createStore } from "./store";

/**
 * Which way the visitor is seeing the site: the scrolling "site", or the 3D "story". The choice
 * is made on the entry screen, kept for the session, and remembered for thirty days so a
 * returning visitor goes straight in. `?v=site` or `?v=story` in the address always wins.
 *
 * The same rule runs twice: here, and as a few lines of plain script in app/layout.tsx that mark
 * <html data-entry> before first paint, so the right first frame is on screen before React is.
 */

export type Version = "site" | "story";

const CHOICE_KEY = "version-choice";
const SESSION_KEY = "version";
const REMEMBER_MS = 30 * 864e5;

const isVersion = (value: unknown): value is Version => value === "site" || value === "story";

/** The version already decided for this visit, or null when the entry screen should ask. */
export function presetVersion(): Version | null {
  if (!STORY_ENABLED) return "site";
  const fromUrl = window.location.search.match(/[?&]v=(site|story)\b/)?.[1];
  if (isVersion(fromUrl)) return fromUrl;
  try {
    const session = sessionStorage.getItem(SESSION_KEY);
    if (isVersion(session)) return session;
    const choice = JSON.parse(localStorage.getItem(CHOICE_KEY) ?? "null") as { id?: unknown; at?: number } | null;
    if (choice && isVersion(choice.id) && Date.now() - (choice.at ?? 0) < REMEMBER_MS) return choice.id;
  } catch {
    // Storage can be unavailable (private mode, blocked): then every visit starts at the entry screen.
  }
  return null;
}

/** The version on screen. Null until one has been chosen. */
export const version = createStore<Version | null>(null);

export function rememberVersion(id: Version) {
  try {
    sessionStorage.setItem(SESSION_KEY, id);
    localStorage.setItem(CHOICE_KEY, JSON.stringify({ id, at: Date.now() }));
  } catch {
    // See above.
  }
}

/** Show `id`, remember it, and mark the document so CSS can hide the other view. */
export function setVersion(id: Version) {
  rememberVersion(id);
  document.documentElement.dataset.viewNow = id;
  document.documentElement.removeAttribute("data-entry");
  version.set(id);
}

/**
 * Switching between the two once inside goes through a covering transition, which the
 * transition component registers here (components/app/VersionTransition).
 */
type Switcher = (id: Version, from?: DOMRect) => Promise<void> | void;
let switcher: Switcher | null = null;

export const registerSwitcher = (fn: Switcher | null) => {
  switcher = fn;
};

export function switchVersion(id: Version, from?: Element | null) {
  if (id === version.get()) return;
  if (switcher) void switcher(id, from?.getBoundingClientRect());
  else setVersion(id);
}

/** The code layer ("Show the code"): on or off, shared by the dock and the motto section. */
export const sourceOn = createStore(false);

export function setSource(on: boolean) {
  sourceOn.set(on);
  document.documentElement.classList.toggle("is-source", on);
}

/** The full-screen menu. */
export const menuOpen = createStore(false);

/** The label of the section on screen, "(01) About me": set by SiteFx, shown by ChapterIndicator. */
export const chapter = createStore("");

/** The motto section's "Break it": idle, broken (falling apart), or fixing (springing back). */
export type BreakState = "idle" | "broken" | "fixing";
export const breakState = createStore<BreakState>("idle");

/** Marks the page as ready to be seen, once: starts entrance animations everywhere. */
export function markLoaded() {
  const root = document.documentElement;
  if (root.classList.contains("is-loaded")) return;
  root.classList.add("is-loaded");
  window.dispatchEvent(new Event("app:loaded"));
}
