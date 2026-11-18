"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { hasWebGL, stagesAvailable } from "@/lib/device";
import { breakState, chapter, sourceOn, version } from "@/lib/experience";
import { stagesOn } from "@/lib/stage";
import { useStore } from "@/lib/store";
import { now, ticker } from "@/lib/ticker";

const ParticleMorph = dynamic(() => import("@/components/fx/ParticleMorph").then((m) => m.ParticleMorph), { ssr: false });
const DotStage = dynamic(() => import("@/components/fx/DotStage").then((m) => m.DotStage), { ssr: false });
const BreakLayer = dynamic(() => import("@/components/fx/BreakLayer").then((m) => m.BreakLayer), { ssr: false });
const SourceLayer = dynamic(() => import("@/components/fx/SourceLayer").then((m) => m.SourceLayer), { ssr: false });

/**
 * Follows the page as it scrolls: the section under the middle of the screen sets the page's
 * theme (ink or sand, see globals.css) and the label in the corner.
 */
function useSectionWatcher(active: boolean) {
  useEffect(() => {
    if (!active) return;
    type Span = { top: number; bottom: number; theme: string; chapter: string };
    let spans: Span[] = [];
    let frames = 0;

    const measure = () => {
      spans = [...document.querySelectorAll<HTMLElement>('[data-view="site"] [data-theme]')].map((section) => {
        const box = section.getBoundingClientRect();
        return {
          top: box.top + window.scrollY,
          bottom: box.bottom + window.scrollY,
          theme: section.dataset.theme ?? "dark",
          chapter: section.dataset.chapter ?? "",
        };
      });
    };

    const tick = () => {
      // Section heights change as fonts load and stages mount, so the measurements are refreshed.
      if (frames++ % 30 === 0) measure();
      const middle = now.scrollY + window.innerHeight * 0.5;
      const span = spans.find((s) => middle >= s.top && middle < s.bottom);
      if (!span) return;
      const root = document.documentElement;
      if (root.dataset.theme !== span.theme) root.dataset.theme = span.theme;
      chapter.set(span.chapter);
    };

    ticker.add(tick);
    return () => {
      ticker.remove(tick);
      chapter.set("");
    };
  }, [active]);
}

/**
 * Everything the site draws in canvas, mounted only while the site is the version on screen and
 * only where the device can draw it. Without WebGL the page marks itself `no-webgl` and the
 * sections show their still fallbacks instead.
 */
export function SiteFx() {
  const active = useStore(version, null) === "site";
  const stages = useStore(stagesOn, false);
  const source = useStore(sourceOn, false);
  const breaking = useStore(breakState, "idle");
  const [gl, setGl] = useState(false);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    if (!active) return;
    const decide = () => {
      const ok = hasWebGL();
      setGl(ok);
      document.documentElement.classList.toggle("no-webgl", !ok);
      stagesOn.set(stagesAvailable());
    };
    decide();
    const desktop = window.matchMedia("(min-width: 1024px)");
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    desktop.addEventListener("change", decide);
    motion.addEventListener("change", decide);
    return () => {
      desktop.removeEventListener("change", decide);
      motion.removeEventListener("change", decide);
      stagesOn.set(false);
    };
  }, [active]);

  // The break layer is only fetched the first time someone presses "Break it".
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- latches on, once, from a store change
    if (breaking !== "idle") setBroken(true);
  }, [breaking]);

  useSectionWatcher(active);

  if (!active) return null;
  return (
    <>
      {gl ? <ParticleMorph /> : null}
      {gl && stages ? <DotStage /> : null}
      {broken ? <BreakLayer /> : null}
      {source ? <SourceLayer /> : null}
    </>
  );
}
