"use client";

import { stagesOn } from "@/lib/stage";
import { useStore } from "@/lib/store";
import { ProcessStage } from "./ProcessStage";
import { ServicesList } from "./ServicesList";
import { ServicesStage } from "./ServicesStage";

/**
 * (02) What I do. Where the device can draw them, two pinned stages (services, then process)
 * with a dot drawing for each item; everywhere else, and on the server, one plain section that
 * lists both.
 */
export function Services() {
  const staged = useStore(stagesOn, false);
  if (!staged) return <ServicesList />;
  return (
    <>
      <ServicesStage />
      <ProcessStage />
    </>
  );
}
