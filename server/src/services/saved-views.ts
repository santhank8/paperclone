import { eq, and, asc } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { savedViews } from "@paperclipai/db";
import { notFound } from "../errors.js";

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
      if (data.filters !== undefined) patch.filters = data.filters;
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
