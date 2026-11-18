"use client";

import { useEffect } from "react";
import type { Version } from "@/lib/experience";

type Props = { active: boolean; load: () => Promise<unknown>[]; onChoose: (id: Version) => void; onDone: () => void };

/** Placeholder: goes straight to the site. Replaced by the real entry screen. */
export function EntryGate({ active, onChoose, onDone }: Props) {
  useEffect(() => {
    if (!active) return;
    onChoose("site");
    onDone();
  }, [active, onChoose, onDone]);
  return null;
}
