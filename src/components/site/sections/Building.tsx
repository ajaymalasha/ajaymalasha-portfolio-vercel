"use client";

import { stagesOn } from "@/lib/stage";
import { useStore } from "@/lib/store";
import { BuildingList } from "./BuildingList";
import { BuildingStage } from "./BuildingStage";

/**
 * What is being shipped now. Laptops with a GPU get the three-column accordion the dots draw
 * in; everything else (and the server) gets the list.
 */
export function Building() {
  return useStore(stagesOn, false) ? <BuildingStage /> : <BuildingList />;
}
