import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { issues, roadmapEpicPauses } from "@paperclipai/db";
import { unprocessable } from "../errors.js";

const ROADMAP_EPIC_ID_REGEX = /^RM-[A-Za-z0-9-]+$/i;
const ROADMAP_EPIC_ID_EXTRACT_REGEX = /\bRM-[A-Za-z0-9-]+\b/gi;

function readNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function normalizeRoadmapEpicId(rawRoadmapId: string) {
  const normalized = readNonEmptyString(rawRoadmapId)?.toUpperCase() ?? "";
  if (!ROADMAP_EPIC_ID_REGEX.test(normalized)) {
    throw unprocessable("Invalid roadmap epic id. Expected format RM-<TOKEN>.");
  }
  return normalized;
}

export function extractRoadmapEpicIdsFromText(rawText: string | null | undefined) {
  if (!rawText) return [];
  const ids = new Set<string>();
  for (const match of rawText.matchAll(ROADMAP_EPIC_ID_EXTRACT_REGEX)) {
    const normalized = readNonEmptyString(match[0])?.toUpperCase();
    if (normalized) ids.add(normalized);
  }
  return [...ids];
}

function extractRoadmapEpicIdsFromIssue(input: { title: string; description: string | null }) {
  const combined = `${input.title}\n${input.description ?? ""}`;
  return extractRoadmapEpicIdsFromText(combined);
}

export function roadmapEpicService(db: Db) {
  return {
    listPausedEpicIds: async (companyId: string) => {
      const rows = await db
        .select({ roadmapId: roadmapEpicPauses.roadmapId })
        .from(roadmapEpicPauses)
        .where(eq(roadmapEpicPauses.companyId, companyId));

      return rows
        .map((row) => row.roadmapId)
        .filter((roadmapId): roadmapId is string => typeof roadmapId === "string" && roadmapId.length > 0)
        .sort((a, b) => a.localeCompare(b));
    },

    pauseEpic: async (companyId: string, rawRoadmapId: string, pausedByUserId: string | null) => {
      const roadmapId = normalizeRoadmapEpicId(rawRoadmapId);
      const now = new Date();

      await db
        .insert(roadmapEpicPauses)
        .values({
          companyId,
          roadmapId,
          pausedByUserId,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [roadmapEpicPauses.companyId, roadmapEpicPauses.roadmapId],
          set: {
            pausedByUserId,
            updatedAt: now,
          },
        });

      return { roadmapId };
    },

    resumeEpic: async (companyId: string, rawRoadmapId: string) => {
      const roadmapId = normalizeRoadmapEpicId(rawRoadmapId);

      await db
        .delete(roadmapEpicPauses)
        .where(and(eq(roadmapEpicPauses.companyId, companyId), eq(roadmapEpicPauses.roadmapId, roadmapId)));

      return { roadmapId };
    },

    getPausedEpicIdForIssue: async (companyId: string, issueId: string) => {
      const issue = await db
        .select({
          title: issues.title,
          description: issues.description,
        })
        .from(issues)
        .where(and(eq(issues.id, issueId), eq(issues.companyId, companyId)))
        .then((rows) => rows[0] ?? null);
      if (!issue) return null;

      const roadmapIds = extractRoadmapEpicIdsFromIssue(issue);
      if (roadmapIds.length === 0) return null;

      const paused = await db
        .select({ roadmapId: roadmapEpicPauses.roadmapId })
        .from(roadmapEpicPauses)
        .where(
          and(
            eq(roadmapEpicPauses.companyId, companyId),
            inArray(roadmapEpicPauses.roadmapId, roadmapIds),
          ),
        )
        .then((rows) => rows[0] ?? null);

      return paused?.roadmapId ?? null;
    },
  };
}
