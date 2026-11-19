"use client";

import { useEffect, useRef } from "react";
import styles from "./DotPhoto.module.css";

type Props = {
  src: string;
  /** Distance between dots, in CSS pixels. */
  step?: number;
  /** Below 1 lifts the mid-tones, so a dark photo still reads as a face. */
  gamma?: number;
  /** Leave out when the picture is decoration. */
  alt?: string;
  className?: string;
};

const decoded = new Map<string, Promise<HTMLImageElement>>();

function loadImage(src: string): Promise<HTMLImageElement> {
  let pending = decoded.get(src);
  if (!pending) {
    const image = new Image();
    image.src = src;
    pending = image.decode().then(
      () => image,
      (error: unknown) => {
        // A failed download is not remembered, so the next draw can try again.
        decoded.delete(src);
        throw error;
      },
    );
    decoded.set(src, pending);
  }
  return pending;
}

/** Repeatable random numbers: the dots keep their places every time the canvas is redrawn. */
function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Whether a CSS colour is nearer white than black. Unknown formats count as light. */
function isLight(color: string): boolean {
  const channels = color.match(/[\d.]+/g)?.map(Number);
  if (!channels || channels.length < 3) return true;
  return (0.299 * channels[0] + 0.587 * channels[1] + 0.114 * channels[2]) / 255 > 0.5;
}

/**
 * A photo redrawn as a grid of dots, in the element's text colour. Light dots grow with the
 * brightness of the picture and dark dots with its shadows, so it reads on either background.
 * The picture fills the canvas (cropped from the centre) and is redrawn when the canvas resizes.
 */
export function DotPhoto({ src, step = 3, gamma = 1, alt, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let alive = true;

    const draw = async () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height) return;
      let image: HTMLImageElement;
      try {
        image = await loadImage(src);
      } catch {
        return;
      }
      if (!alive) return;

      // One pixel of this small copy is one dot.
      const cols = Math.ceil(width / step);
      const rows = Math.ceil(height / step);
      const probe = document.createElement("canvas");
      probe.width = cols;
      probe.height = rows;
      const reader = probe.getContext("2d", { willReadFrequently: true });
      const context = canvas.getContext("2d");
      if (!reader || !context) return;
      reader.imageSmoothingQuality = "high";
      const cover = Math.max(cols / image.width, rows / image.height);
      const w = image.width * cover;
      const h = image.height * cover;
      reader.drawImage(image, (cols - w) / 2, (rows - h) / 2, w, h);
      const { data } = reader.getImageData(0, 0, cols, rows);

      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.scale(ratio, ratio);
      const color = getComputedStyle(canvas).color;
      const lightDots = isLight(color);
      context.fillStyle = color;

      const random = seededRandom(cols * 7919 + rows);
      const wobble = step * 0.35;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const i = (row * cols + col) * 4;
          const dx = (random() - 0.5) * wobble;
          const dy = (random() - 0.5) * wobble;
          const alpha = data[i + 3] / 255;
          if (alpha < 0.1) continue;
          const lum = Math.pow((0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255, gamma);
          const radius = step * 0.55 * Math.sqrt(lightDots ? lum : 1 - lum) * alpha;
          if (radius < 0.3) continue;
          context.beginPath();
          context.arc((col + 0.5) * step + dx, (row + 0.5) * step + dy, radius, 0, Math.PI * 2);
          context.fill();
        }
      }
    };

    // Fires once on observe, so this is also the first draw.
    const observer = new ResizeObserver(() => void draw());
    observer.observe(canvas);
    return () => {
      alive = false;
      observer.disconnect();
    };
  }, [src, step, gamma]);

  return (
    <canvas
      ref={ref}
      className={className ? `${styles.photo} ${className}` : styles.photo}
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
    />
  );
}
