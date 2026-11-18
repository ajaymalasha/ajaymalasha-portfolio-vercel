"use client";

import { useEffect, useState } from "react";

/** Minutes a time zone is ahead of UTC at `date` (negative when behind). Daylight saving included. */
export function zoneOffsetMinutes(timeZone: string, date = new Date()): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    })
      .formatToParts(date)
      .map((part) => [part.type, Number(part.value)]),
  );
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  return Math.round((asUtc - date.getTime()) / 60000);
}

/** "13½ hours", "1 hour", "45 minutes": the gap between two zones, in words. */
export function describeGap(minutes: number): string {
  const total = Math.abs(minutes);
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (!hours) return `${rest} minutes`;
  const fraction = rest === 30 ? "½" : rest === 15 ? "¼" : rest === 45 ? "¾" : "";
  const exact = rest && !fraction ? ` ${rest} min` : "";
  return `${hours}${fraction} ${hours === 1 && !fraction ? "hour" : "hours"}${exact}`;
}

export function formatTime(timeZone: string, options: Intl.DateTimeFormatOptions = {}, locale = "en-GB"): string {
  return new Date().toLocaleTimeString(locale, { timeZone, hour: "2-digit", minute: "2-digit", ...options });
}

/**
 * The time in `timeZone`, kept current. Empty on the server and on the first client render (the
 * server's clock is not the visitor's), then filled in: render it inside an element that can
 * briefly be empty.
 */
export function useClock(timeZone: string, options?: Intl.DateTimeFormatOptions, locale?: string): string {
  const [time, setTime] = useState("");
  const hour12 = options?.hour12;
  useEffect(() => {
    const update = () => setTime(formatTime(timeZone, { hour12 }, locale));
    update();
    const timer = setInterval(update, 10_000);
    return () => clearInterval(timer);
  }, [timeZone, hour12, locale]);
  return time;
}
