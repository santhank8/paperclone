import type { Issue } from "@paperclipai/shared";
import { cn } from "./utils";

export interface EpicTone {
  badge: string;
  row: string;
  card: string;
}

const ROADMAP_EPIC_ID_REGEX = /\bRM-(?:\d{4}-Q[1-4]-\d{2}|UNPLANNED)\b/gi;

const EPIC_TONES: EpicTone[] = [
  {
    badge: "border-cyan-300 bg-cyan-50 text-cyan-900 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-100",
    row: "border-cyan-300/70 bg-cyan-50/25 dark:border-cyan-800/70 dark:bg-cyan-950/12",
    card: "border-cyan-300/70 bg-cyan-50/40 dark:border-cyan-800/70 dark:bg-cyan-950/20",
  },
  {
    badge: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100",
    row: "border-emerald-300/70 bg-emerald-50/25 dark:border-emerald-800/70 dark:bg-emerald-950/12",
    card: "border-emerald-300/70 bg-emerald-50/40 dark:border-emerald-800/70 dark:bg-emerald-950/20",
  },
  {
    badge: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100",
    row: "border-amber-300/70 bg-amber-50/25 dark:border-amber-800/70 dark:bg-amber-950/12",
    card: "border-amber-300/70 bg-amber-50/40 dark:border-amber-800/70 dark:bg-amber-950/20",
  },
  {
    badge: "border-violet-300 bg-violet-50 text-violet-900 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-100",
    row: "border-violet-300/70 bg-violet-50/25 dark:border-violet-800/70 dark:bg-violet-950/12",
    card: "border-violet-300/70 bg-violet-50/40 dark:border-violet-800/70 dark:bg-violet-950/20",
  },
  {
    badge: "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100",
    row: "border-rose-300/70 bg-rose-50/25 dark:border-rose-800/70 dark:bg-rose-950/12",
    card: "border-rose-300/70 bg-rose-50/40 dark:border-rose-800/70 dark:bg-rose-950/20",
  },
  {
    badge: "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100",
    row: "border-sky-300/70 bg-sky-50/25 dark:border-sky-800/70 dark:bg-sky-950/12",
    card: "border-sky-300/70 bg-sky-50/40 dark:border-sky-800/70 dark:bg-sky-950/20",
  },
];

function hashValue(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function epicTone(epicId: string): EpicTone {
  return EPIC_TONES[hashValue(epicId) % EPIC_TONES.length] ?? EPIC_TONES[0];
}

export function epicButtonClassName(tone: EpicTone, selected: boolean): string {
  return cn(
    "border transition-all",
    tone.badge,
    selected
      ? "ring-1 ring-foreground/25 shadow-xs saturate-125"
      : "opacity-80 hover:opacity-100 hover:-translate-y-px",
  );
}

export function extractRoadmapEpicIdsFromIssue(issue: Pick<Issue, "title" | "description">): string[] {
  ROADMAP_EPIC_ID_REGEX.lastIndex = 0;
  const rawMatches = (`${issue.title}\n${issue.description ?? ""}`).match(ROADMAP_EPIC_ID_REGEX);
  if (!rawMatches) return [];
  const ids = new Set(rawMatches.map((value) => value.toUpperCase()));
  return [...ids];
}

export function pickRoadmapOverviewField(fields: Array<{ key: string; value: string }>): { key: string; value: string } | null {
  return fields.find((field) => {
    const normalizedKey = field.key.trim().toLowerCase();
    return normalizedKey === "purpose" || normalizedKey === "outcome" || normalizedKey === "scope";
  }) ?? fields.find((field) => {
    const normalizedKey = field.key.trim().toLowerCase();
    return normalizedKey !== "linked tickets" && normalizedKey !== "status";
  }) ?? null;
}
