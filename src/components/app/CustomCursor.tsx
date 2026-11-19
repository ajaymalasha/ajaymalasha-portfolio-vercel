"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowIcon } from "@/components/ui/ArrowIcon";
import { hasFinePointer } from "@/lib/device";
import { ticker } from "@/lib/ticker";
import styles from "./CustomCursor.module.css";

type Mode = "default" | "hidden" | "stick" | "label";
type Look = { mode: Mode; label: string; link: boolean };

const IDLE: Look = { mode: "default", label: "", link: false };
const OFFSCREEN = -100;

/**
 * The cursor on devices with a mouse: a dot that inverts whatever is under it. It becomes a ring
 * around elements that ask it to stick, a labelled disc over elements that carry a label, and
 * gets out of the way over buttons, which have hover effects of their own.
 */
export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const [look, setLook] = useState<Look>(IDLE);

  useEffect(() => {
    if (!hasFinePointer()) return;
    const root = document.documentElement;
    root.classList.add("has-custom-cursor");

    const pointer = { x: OFFSCREEN, y: OFFSCREEN };
    const dot = { x: OFFSCREEN, y: OFFSCREEN };
    const disc = { x: OFFSCREEN, y: OFFSCREEN };
    let anchor: Element | null = null;

    const show = (next: Look) =>
      setLook((previous) =>
        previous.mode === next.mode && previous.label === next.label && previous.link === next.link ? previous : next,
      );

    const read = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return;
      anchor = null;
      // The story draws its own ring, which does the talking over anything clickable.
      const ringHasIt = root.classList.contains("has-ring-cursor") && target.closest("a, button");
      if (ringHasIt || target.closest('[data-cursor="hide"]')) return show({ ...IDLE, mode: "hidden" });
      if (target.closest('[data-cursor="dot"]')) return show(IDLE);
      anchor = target.closest('[data-cursor="stick"]');
      if (anchor) return show({ ...IDLE, mode: "stick" });
      const labelled = target.closest<HTMLElement>("[data-cursor-label]");
      if (labelled) {
        return show({ mode: "label", label: labelled.dataset.cursorLabel ?? "", link: labelled.matches("a[href]") });
      }
      if (target.closest("button, .fill, .btn-primary, .btn-icon")) return show({ ...IDLE, mode: "hidden" });
      show(IDLE);
    };

    const onMove = (event: MouseEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      read(event.target);
    };
    // The page moves under a cursor that is standing still.
    const onScroll = () => read(document.elementFromPoint(pointer.x, pointer.y));
    const onLeave = () => show({ ...IDLE, mode: "hidden" });

    const follow = () => {
      const dotEl = dotRef.current;
      const labelEl = labelRef.current;
      if (!dotEl || !labelEl) return;
      let x = pointer.x;
      let y = pointer.y;
      if (anchor) {
        // Stuck: the ring sits on the element's centre and only leans towards the pointer.
        const box = anchor.getBoundingClientRect();
        const cx = box.left + box.width / 2;
        const cy = box.top + box.height / 2;
        x = cx + (pointer.x - cx) * 0.12;
        y = cy + (pointer.y - cy) * 0.12;
        dotEl.style.setProperty("--stick", `${(Math.max(box.width, box.height) + 14).toFixed(0)}px`);
      }
      dot.x += (x - dot.x) * 0.28;
      dot.y += (y - dot.y) * 0.28;
      dotEl.style.translate = `${dot.x.toFixed(1)}px ${dot.y.toFixed(1)}px`;
      disc.x += (pointer.x - disc.x) * 0.18;
      disc.y += (pointer.y - disc.y) * 0.18;
      labelEl.style.translate = `${disc.x.toFixed(1)}px ${disc.y.toFixed(1)}px`;
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("mouseleave", onLeave);
    ticker.add(follow);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("mouseleave", onLeave);
      ticker.remove(follow);
      root.classList.remove("has-custom-cursor");
    };
  }, []);

  // Always in the HTML, shown by CSS only once the document is marked as having this cursor.
  return (
    <div className={styles.root} aria-hidden="true">
      <div className={styles.blend}>
        <div ref={dotRef} className={styles.dot} data-mode={look.mode} />
      </div>
      <div className={styles.overlay}>
        <div
          ref={labelRef}
          className={`${styles.label} font-semibold`}
          data-visible={look.mode === "label" || undefined}
        >
          {look.label}
          {look.link ? <ArrowIcon className={styles.arrow} /> : null}
        </div>
      </div>
    </div>
  );
}
