"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { canHover, prefersReducedMotion } from "@/lib/device";
import { AVATAR_URL } from "@/lib/particle-kit";
import { DotPhoto } from "./DotPhoto";
import styles from "./DotAvatar.module.css";

type Props = {
  /** Leave out when the avatar is decoration beside text that already names him. */
  alt?: string;
  /** Distance between dots, in CSS pixels. */
  step?: number;
  /** Sets the size: the avatar is a round box that fills whatever this class gives it. */
  className?: string;
};

/** How far the avatar leans after the cursor, as a share of the cursor's travel. */
const FOLLOW = 0.4;

/** Sets the point the photo opens from to where the pointer is, and returns the avatar's box. */
function openFrom(element: HTMLElement, clientX: number, clientY: number): DOMRect {
  const box = element.getBoundingClientRect();
  element.style.setProperty("--ox", `${(((clientX - box.left) / box.width) * 100).toFixed(1)}%`);
  element.style.setProperty("--oy", `${(((clientY - box.top) / box.height) * 100).toFixed(1)}%`);
  return box;
}

/**
 * The round portrait drawn in dots. Under the cursor (or a tap, on touch screens) the real photo
 * opens from the point of entry, the dots scatter, and the disc leans after the pointer.
 */
export function DotAvatar({ alt, step = 2, className }: Props) {
  const root = useRef<HTMLSpanElement>(null);
  // The photo and the canvas are only created once the avatar is near the screen.
  const [near, setNear] = useState(false);
  const [open, setOpen] = useState(false);
  const isOpen = useRef(false);
  /** The centre of the disc at rest, in viewport pixels, taken when the pointer came in. */
  const rest = useRef({ x: 0, y: 0 });
  const lean = useRef({ x: 0, y: 0 });

  const moveTo = (x: number, y: number) => {
    lean.current = { x, y };
    root.current?.style.setProperty("--tx", `${x.toFixed(1)}px`);
    root.current?.style.setProperty("--ty", `${y.toFixed(1)}px`);
  };

  const show = (clientX: number, clientY: number) => {
    const element = root.current;
    if (!element) return;
    const box = openFrom(element, clientX, clientY);
    rest.current = { x: box.left + box.width / 2 - lean.current.x, y: box.top + box.height / 2 - lean.current.y };
    isOpen.current = true;
    setOpen(true);
  };

  const hide = () => {
    isOpen.current = false;
    setOpen(false);
    moveTo(0, 0);
  };

  const onEnter = (event: ReactPointerEvent) => {
    if (event.pointerType === "mouse" && canHover()) show(event.clientX, event.clientY);
  };

  const onMove = (event: ReactPointerEvent) => {
    if (!isOpen.current || event.pointerType !== "mouse" || prefersReducedMotion()) return;
    moveTo((event.clientX - rest.current.x) * FOLLOW, (event.clientY - rest.current.y) * FOLLOW);
  };

  const onLeave = (event: ReactPointerEvent) => {
    if (event.pointerType === "mouse") hide();
  };

  useEffect(() => {
    const element = root.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        setNear(true);
      },
      { rootMargin: "800px 0px" },
    );
    observer.observe(element);

    // Touch has no hover: a tap on the avatar opens or closes it, a tap anywhere else closes it.
    const onTap = (event: PointerEvent) => {
      if (event.pointerType === "mouse") return;
      const inside = element.contains(event.target as Node);
      if (inside && !isOpen.current) {
        openFrom(element, event.clientX, event.clientY);
        isOpen.current = true;
        setOpen(true);
      } else if (isOpen.current) {
        isOpen.current = false;
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onTap);

    return () => {
      observer.disconnect();
      document.removeEventListener("pointerdown", onTap);
    };
  }, []);

  return (
    <span
      ref={root}
      className={className ? `${styles.avatar} ${className}` : styles.avatar}
      data-open={open}
      data-cursor="hide"
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      onPointerEnter={onEnter}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      {near ? (
        <>
          <span className={styles.real} style={{ backgroundImage: `url(${AVATAR_URL})` }} />
          <DotPhoto className={styles.dots} src={AVATAR_URL} step={step} gamma={0.75} />
        </>
      ) : null}
    </span>
  );
}
