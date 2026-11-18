"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, type ReactNode } from "react";
import { STORY_ENABLED } from "@/content/site";
import { watchMotionPreference } from "@/lib/device";
import { markLoaded, presetVersion, setVersion, version, type Version } from "@/lib/experience";
import { initMotion } from "@/lib/motion";
import { resetScroll, startScroll, stopScroll } from "@/lib/scroll";
import { useStore } from "@/lib/store";
import { CustomCursor } from "./CustomCursor";
import { EntryGate } from "./EntryGate";
import { ExperienceDock } from "./ExperienceDock";
import { VersionTransition } from "./VersionTransition";

const StoryView = dynamic(() => import("@/components/story/StoryView").then((m) => m.StoryView), { ssr: false });

/** Loaded while the entry screen counts up, so whichever way in is chosen is ready. */
function preload(): Promise<unknown>[] {
  const idle = (run: () => void) =>
    "requestIdleCallback" in window ? requestIdleCallback(run) : setTimeout(run, 1);
  idle(() => {
    void import("@/components/fx/ParticleMorph");
    if (STORY_ENABLED) void import("@/components/story/StoryView");
  });
  const portrait = new Image();
  portrait.src = "/portrait/cutout.webp";
  return [
    document.fonts.load("300 16px Geist"),
    document.fonts.load("400 16px Geist"),
    document.fonts.load("700 16px Geist"),
    portrait.decode().catch(() => {}),
  ];
}

/**
 * The shell around both ways of seeing the site. It starts smooth scrolling and the shared
 * motion, shows the entry screen when no choice has been made yet, and swaps the server-rendered
 * site for the 3D story when that is the version on screen.
 */
export function App({ site }: { site: ReactNode }) {
  const current = useStore(version, null);
  const [gate, setGate] = useState(false);

  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    startScroll();
    const stopMotion = initMotion();
    const stopWatching = watchMotionPreference();

    const preset = presetVersion();
    if (preset) {
      setVersion(preset);
      markLoaded();
    } else {
      // No choice yet: the entry screen asks (its first frame is already on screen, in the HTML).
      // eslint-disable-next-line react-hooks/set-state-in-effect -- decided from storage, which only exists on the client
      setGate(true);
    }

    return () => {
      stopMotion();
      stopWatching();
      stopScroll();
    };
  }, []);

  // A new version always starts from the top, in the dark theme.
  useEffect(() => {
    if (!current) return;
    resetScroll();
    document.documentElement.dataset.theme = "dark";
  }, [current]);

  const choose = (id: Version) => {
    setVersion(id);
    markLoaded();
  };

  return (
    <>
      {/* The site stays mounted under the entry screen (hidden by CSS), and leaves for the story. */}
      {current !== "story" ? site : null}
      {current === "story" ? <StoryView /> : null}

      {STORY_ENABLED ? <EntryGate active={gate} load={preload} onChoose={choose} onDone={() => setGate(false)} /> : null}
      {current ? <ExperienceDock /> : null}
      <VersionTransition />
      <CustomCursor />
      <div className="grain" aria-hidden="true" />
    </>
  );
}
