"use client";

import { createStore } from "./store";

/**
 * The pinned "stage" sections (Services, Process, Work, Now building) each show one item at a
 * time. Which item that is lives here, because two things need it: the section, which shows the
 * copy, and the dot stage (components/fx/DotStage), which draws that item's picture.
 */
export const stageIndex = {
  services: createStore(0),
  process: createStore(0),
  work: createStore(0),
  building: createStore(0),
};

export type StageName = keyof typeof stageIndex;

/**
 * Whether the stages are in use on this device (see `stagesAvailable` in lib/device). Decided
 * once on the client after mount; the server always renders the plain list versions.
 */
export const stagesOn = createStore(false);
