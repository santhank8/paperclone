import { eq, and, asc } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { savedViews } from "@paperclipai/db";
import { notFound, badRequest } from "../errors.js";

const FILTER_KEYS = ["statuses", "priorities", "assignees", "labels"] as const;

function validateFilters(filters: unknown): filters is { statuses: string[]; priorities: string[]; assignees: string[]; labels: string[] } {
  if (typeof filters !== "object" || filters === null || Array.isArray(filters)) return false;
  const f = filters as Record<string, unknown>;
  const keys = Object.keys(f);
  if (keys.length !== FILTER_KEYS.length || !FILTER_KEYS.every((k) => k in f)) return false;
  return FILTER_KEYS.every((k) => Array.isArray(f[k]) && (f[k] as unknown[]).every((v) => typeof v === "string"));
}

export function savedViewService(db: Db) {
  return {
    async list(companyId: string) {
      return db
        .select()
        .from(savedViews)
        .where(eq(savedViews.companyId, companyId))
        .orderBy(asc(savedViews.createdAt));
    },

    async create(companyId: string, data: {
      name: string;
      filters: { statuses: string[]; priorities: string[]; assignees: string[]; labels: string[] };
      groupBy: string;
      sortField: string;
      sortDirection: string;
    }) {
      if (!validateFilters(data.filters)) throw badRequest("filters must contain statuses, priorities, assignees, labels as arrays of strings");
      const [row] = await db
        .insert(savedViews)
        .values({
          companyId,
          name: data.name,
          filters: data.filters,
          groupBy: data.groupBy,
          sortField: data.sortField,
          sortDirection: data.sortDirection,
        })
        .returning();
      return row;
    },

    async update(id: string, companyId: string, data: {
      name?: string;
      filters?: { statuses: string[]; priorities: string[]; assignees: string[]; labels: string[] };
      groupBy?: string;
      sortField?: string;
      sortDirection?: string;
    }) {
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (data.name !== undefined) patch.name = data.name;
      if (data.filters !== undefined) {
        if (!validateFilters(data.filters)) throw badRequest("filters must contain statuses, priorities, assignees, labels as arrays of strings");
        patch.filters = data.filters;
      }
      if (data.groupBy !== undefined) patch.groupBy = data.groupBy;
      if (data.sortField !== undefined) patch.sortField = data.sortField;
      if (data.sortDirection !== undefined) patch.sortDirection = data.sortDirection;

      const [row] = await db
        .update(savedViews)
        .set(patch)
        .where(and(eq(savedViews.id, id), eq(savedViews.companyId, companyId)))
        .returning();
      if (!row) throw notFound("Saved view not found");
      return row;
    },

    async remove(id: string, companyId: string) {
      const [row] = await db
        .delete(savedViews)
        .where(and(eq(savedViews.id, id), eq(savedViews.companyId, companyId)))
        .returning();
      if (!row) throw notFound("Saved view not found");
      return row;
    },
  };
}
