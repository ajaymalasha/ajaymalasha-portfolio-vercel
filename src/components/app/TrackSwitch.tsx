"use client";

import { dock } from "@/content/sections";
import { setTrack, soundTrack, TRACKS } from "@/lib/audio";
import { useStore } from "@/lib/store";
import styles from "./TrackSwitch.module.css";

type Props = { className?: string; onSwitch?: () => void; goo?: boolean };

/** Names the soundtrack that is playing, and swaps to the other one. */
export function TrackSwitch({ className = "", onSwitch, goo }: Props) {
  const current = useStore(soundTrack, "drift");
  const next = TRACKS[(TRACKS.indexOf(current) + 1) % TRACKS.length];
  const label = dock.track.replace("{current}", dock.tracks[current]).replace("{next}", dock.tracks[next]);

  return (
    <button
      type="button"
      className={`${styles.track} ${className}`}
      aria-label={label}
      data-goo={goo ? "" : undefined}
      onClick={() => {
        setTrack(next);
        onSwitch?.();
      }}
    >
      <span>{dock.tracks[current]}</span>
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
        <path
          d="M7 7h11l-3-3M17 17H6l3 3"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
