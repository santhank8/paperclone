import type { VirtualOrgStage } from "@paperclipai/virtual-org-types";
import * as React from "react";

const LABELS: Record<VirtualOrgStage, string> = {
  discovery: "Discovery",
  validation: "Validation",
  growth: "Growth",
  scale: "Scale",
};

const COLORS: Record<VirtualOrgStage, string> = {
  discovery: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  validation: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  growth: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  scale: "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300",
};

export function StageBadge({ stage }: { stage: VirtualOrgStage }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${COLORS[stage]}`}>
      {LABELS[stage]}
    </span>
  );
}
