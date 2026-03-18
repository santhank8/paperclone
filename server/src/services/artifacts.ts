import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { artifacts } from "@paperclipai/db";
import { notFound } from "../errors.js";

export interface ArtifactFilters {
  agentId?: string;
  issueId?: string;
  type?: string;
  status?: string;
}

export function artifactService(db: Db) {
  return {
    create: async (
      companyId: string,
      data: Omit<typeof artifacts.$inferInsert, "companyId" | "id" | "createdAt" | "updatedAt">,
    ) => {
      const now = new Date();
      const [row] = await db
        .insert(artifacts)
        .values({
          ...data,
          companyId,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return row;
    },

    list: async (companyId: string, filters?: ArtifactFilters) => {
      const conditions = [eq(artifacts.companyId, companyId)];
      if (filters?.agentId) conditions.push(eq(artifacts.agentId, filters.agentId));
      if (filters?.issueId) conditions.push(eq(artifacts.issueId, filters.issueId));
      if (filters?.type) conditions.push(eq(artifacts.type, filters.type));
      if (filters?.status) conditions.push(eq(artifacts.status, filters.status));

      return db
        .select()
        .from(artifacts)
        .where(and(...conditions))
        .orderBy(desc(artifacts.createdAt));
    },

    getById: async (id: string) => {
      const row = await db
        .select()
        .from(artifacts)
        .where(eq(artifacts.id, id))
        .then((rows) => rows[0] ?? null);
      if (!row) throw notFound("Artifact not found");
      return row;
    },

    update: async (
      id: string,
      patch: Partial<Pick<typeof artifacts.$inferInsert, "name" | "description" | "status" | "metadata">>,
    ) => {
      const [updated] = await db
        .update(artifacts)
        .set({
          ...patch,
          updatedAt: new Date(),
        })
        .where(eq(artifacts.id, id))
        .returning();
      if (!updated) throw notFound("Artifact not found");
      return updated;
    },

    archive: async (id: string) => {
      const [updated] = await db
        .update(artifacts)
        .set({
          status: "archived",
          updatedAt: new Date(),
        })
        .where(eq(artifacts.id, id))
        .returning();
      if (!updated) throw notFound("Artifact not found");
      return updated;
    },
  };
}
