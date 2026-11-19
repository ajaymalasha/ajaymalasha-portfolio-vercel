"use client";

import { stagesOn } from "@/lib/stage";
import { useStore } from "@/lib/store";
import { WorkList } from "./WorkList";
import { WorkStage } from "./WorkStage";

/**
 * Selected work. Laptops with a GPU get the pinned stage, where the dots draw each storefront;
 * everything else (and the server) gets the list.
 */
export function Work() {
  return useStore(stagesOn, false) ? <WorkStage /> : <WorkList />;
}
