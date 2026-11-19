"use client";

import { useEffect, useRef } from "react";
import { scramble, whenLoaded, whenSeen } from "@/lib/motion";

type Props = {
  text: string;
  /** "reveal": when scrolled into view. "load": when the page is ready. "hover": when its link or button is hovered. */
  when?: "reveal" | "load" | "hover";
  /** With "load": milliseconds to wait first. */
  delay?: number;
  className?: string;
};

/** Text that settles out of random glyphs. Reads as the plain text to assistive technology. */
export function Scramble({ text, when = "reveal", delay = 0, className }: Props) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let cancelRun = () => {};
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = () => {
      node.style.opacity = "";
      cancelRun();
      cancelRun = scramble(node, text);
    };

    let stop = () => {};
    if (when === "hover") {
      const trigger = node.closest("a, button") ?? node;
      trigger.addEventListener("mouseenter", run);
      stop = () => trigger.removeEventListener("mouseenter", run);
    } else {
      node.style.opacity = "0";
      stop =
        when === "load" ? whenLoaded(() => (timer = setTimeout(run, delay))) : whenSeen(node, run, { threshold: 0.4 });
    }
    return () => {
      stop();
      clearTimeout(timer);
      cancelRun();
      node.style.opacity = "";
    };
  }, [text, when, delay]);

  return (
    <span ref={ref} className={className} data-scramble={when}>
      {text}
    </span>
  );
}
