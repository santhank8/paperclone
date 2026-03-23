import { and, desc, eq, sql, isNull, inArray, gte, lte } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { knowledgeStore } from "@paperclipai/db";
import { publishLiveEvent } from "./live-events.js";

export interface CreateKnowledgeInput {
  companyId?: string | null;
  sourceAgentId?: string | null;
  sourcePlatform?: string;
  category?: string;
  title: string;
  body: string;
  tags?: string[];
  projectId?: string | null;
  relevanceScore?: number;
  ttlDays?: number | null;
  urgent?: boolean;
}

export interface SearchKnowledgeInput {
  query: string;
  companyId?: string | null;
  category?: string;
  projectId?: string | null;
  tags?: string[];
  limit?: number;
  offset?: number;
  minRelevance?: number;
  maxAgeDays?: number;
}

export interface BulkImportEntry {
  title: string;
  body: string;
  category?: string;
  tags?: string[];
  sourcePlatform?: string;
  companyId?: string | null;
  projectId?: string | null;
}

export function createKnowledgeService(db: Db) {
  return {
    async create(input: CreateKnowledgeInput) {
      const [entry] = await db
        .insert(knowledgeStore)
        .values({
          companyId: input.companyId ?? null,
          sourceAgentId: input.sourceAgentId ?? null,
          sourcePlatform: input.sourcePlatform ?? "claude_local",
          category: input.category ?? "observation",
          title: input.title,
          body: input.body,
          tags: input.tags ?? [],
          projectId: input.projectId ?? null,
          relevanceScore: input.relevanceScore ?? 1.0,
          ttlDays: input.ttlDays ?? null,
        })
        .returning();
      try {
        if (entry.companyId) {
          publishLiveEvent({
            companyId: entry.companyId,
            type: "knowledge.created",
            payload: { id: entry.id, title: entry.title, category: entry.category },
          });
        }
      } catch { /* non-fatal */ }
      return entry;
    },

    async getById(id: string) {
      const [entry] = await db
        .select()
        .from(knowledgeStore)
        .where(eq(knowledgeStore.id, id));
      return entry ?? null;
    },

    async search(input: SearchKnowledgeInput) {
      const conditions = [];

      // Full-text search
      if (input.query) {
        const tsQuery = input.query
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .map((w) => w.replace(/[^a-zA-Z0-9\u00C0-\u024F]/g, ""))
          .filter(Boolean)
          .join(" & ");
        if (tsQuery) {
          conditions.push(
            sql`${knowledgeStore}.search_vector @@ to_tsquery('simple', ${tsQuery})`,
          );
        }
      }

      // Filters
      if (input.companyId) {
        conditions.push(eq(knowledgeStore.companyId, input.companyId));
      }
      if (input.category) {
        conditions.push(eq(knowledgeStore.category, input.category));
      }
      if (input.projectId) {
        conditions.push(eq(knowledgeStore.projectId, input.projectId));
      }
      if (input.tags && input.tags.length > 0) {
        conditions.push(sql`${knowledgeStore.tags} && ${input.tags}`);
      }
      if (input.minRelevance !== undefined) {
        conditions.push(gte(knowledgeStore.relevanceScore, input.minRelevance));
      }
      if (input.maxAgeDays !== undefined) {
        const cutoff = new Date(Date.now() - input.maxAgeDays * 86400000);
        conditions.push(gte(knowledgeStore.createdAt, cutoff));
      }

      // Exclude superseded entries
      conditions.push(isNull(knowledgeStore.supersededBy));

      const limit = Math.min(input.limit ?? 20, 100);
      const offset = input.offset ?? 0;

      const results = await db
        .select({
          id: knowledgeStore.id,
          companyId: knowledgeStore.companyId,
          sourceAgentId: knowledgeStore.sourceAgentId,
          sourcePlatform: knowledgeStore.sourcePlatform,
          category: knowledgeStore.category,
          title: knowledgeStore.title,
          body: knowledgeStore.body,
          tags: knowledgeStore.tags,
          projectId: knowledgeStore.projectId,
          relevanceScore: knowledgeStore.relevanceScore,
          accessCount: knowledgeStore.accessCount,
          createdAt: knowledgeStore.createdAt,
        })
        .from(knowledgeStore)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(knowledgeStore.relevanceScore), desc(knowledgeStore.createdAt))
        .limit(limit)
        .offset(offset);

      try {
        if (input.companyId) {
          publishLiveEvent({
            companyId: input.companyId,
            type: "knowledge.searched",
            payload: { query: input.query, resultCount: results.length },
          });
        }
      } catch { /* non-fatal */ }

      return results;
    },

    /** Progressive disclosure: return titles + excerpts only */
    async searchSummary(input: SearchKnowledgeInput) {
      const results = await this.search(input);
      return results.map((r) => ({
        id: r.id,
        title: r.title,
        category: r.category,
        excerpt: r.body.slice(0, 200),
        tags: r.tags,
        relevanceScore: r.relevanceScore,
        createdAt: r.createdAt,
      }));
    },

    /** Bump relevance when an agent finds knowledge useful */
    async bumpAccess(id: string) {
      const [updated] = await db
        .update(knowledgeStore)
        .set({
          accessCount: sql`${knowledgeStore.accessCount} + 1`,
          relevanceScore: sql`LEAST(${knowledgeStore.relevanceScore} * 1.05, 10.0)`,
          updatedAt: new Date(),
        })
        .where(eq(knowledgeStore.id, id))
        .returning({ id: knowledgeStore.id, accessCount: knowledgeStore.accessCount });
      try {
        const full = await this.getById(id);
        if (full?.companyId) {
          publishLiveEvent({
            companyId: full.companyId,
            type: "knowledge.learned",
            payload: { id, accessCount: updated?.accessCount },
          });
        }
      } catch { /* non-fatal */ }
      return updated ?? null;
    },

    /** Mark an entry as superseded by another */
    async supersede(oldId: string, newId: string) {
      const [old] = await db
        .select({ companyId: knowledgeStore.companyId })
        .from(knowledgeStore)
        .where(eq(knowledgeStore.id, oldId));
      await db
        .update(knowledgeStore)
        .set({ supersededBy: newId, updatedAt: new Date() })
        .where(eq(knowledgeStore.id, oldId));
      try {
        if (old?.companyId) {
          publishLiveEvent({
            companyId: old.companyId,
            type: "knowledge.superseded",
            payload: { oldId, newId },
          });
        }
      } catch { /* non-fatal */ }
    },

    /** Bulk import from Vault/claude-mem/OpenClaw */
    async bulkImport(entries: BulkImportEntry[]) {
      if (entries.length === 0) return { imported: 0 };

      const values = entries.map((e) => ({
        companyId: e.companyId ?? null,
        sourcePlatform: e.sourcePlatform ?? "vault",
        category: e.category ?? "observation",
        title: e.title,
        body: e.body,
        tags: e.tags ?? [],
        projectId: e.projectId ?? null,
      }));

      const inserted = await db
        .insert(knowledgeStore)
        .values(values)
        .returning({ id: knowledgeStore.id });

      return { imported: inserted.length };
    },

    /** Get recent knowledge relevant to a task (for heartbeat context injection) */
    async getRelevantForTask(opts: {
      query: string;
      companyId: string;
      limit?: number;
    }) {
      return this.searchSummary({
        query: opts.query,
        companyId: opts.companyId,
        limit: opts.limit ?? 5,
        minRelevance: 0.3,
        maxAgeDays: 30,
      });
    },

    /** Apply daily relevance decay to unaccessed entries */
    async applyRelevanceDecay() {
      const result = await db
        .update(knowledgeStore)
        .set({
          relevanceScore: sql`${knowledgeStore.relevanceScore} * 0.99`,
          updatedAt: new Date(),
        })
        .where(
          and(
            isNull(knowledgeStore.supersededBy),
            lte(knowledgeStore.accessCount, 0),
          ),
        );
      return result;
    },

    /** Get stats */
    async getStats() {
      const totalResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(knowledgeStore);
      const activeResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(knowledgeStore)
        .where(isNull(knowledgeStore.supersededBy));
      const catResult = await db
        .selectDistinct({ category: knowledgeStore.category })
        .from(knowledgeStore);
      const platResult = await db
        .selectDistinct({ platform: knowledgeStore.sourcePlatform })
        .from(knowledgeStore);

      return {
        total: totalResult[0]?.count ?? 0,
        active: activeResult[0]?.count ?? 0,
        categories: catResult.map((r) => r.category),
        platforms: platResult.map((r) => r.platform),
      };
    },

    /** Weekly brain digest — last 7 days summary */
    async getWeeklyDigest() {
      const weekAgo = new Date(Date.now() - 7 * 86400000);

      const newEntries = await db
        .select({
          id: knowledgeStore.id,
          title: knowledgeStore.title,
          category: knowledgeStore.category,
          tags: knowledgeStore.tags,
          createdAt: knowledgeStore.createdAt,
        })
        .from(knowledgeStore)
        .where(gte(knowledgeStore.createdAt, weekAgo))
        .orderBy(desc(knowledgeStore.createdAt))
        .limit(20);

      const topAccessed = await db
        .select({
          id: knowledgeStore.id,
          title: knowledgeStore.title,
          accessCount: knowledgeStore.accessCount,
          relevanceScore: knowledgeStore.relevanceScore,
        })
        .from(knowledgeStore)
        .where(isNull(knowledgeStore.supersededBy))
        .orderBy(desc(knowledgeStore.accessCount))
        .limit(5);

      const lowRelevance = await db
        .select({
          id: knowledgeStore.id,
          title: knowledgeStore.title,
          relevanceScore: knowledgeStore.relevanceScore,
          accessCount: knowledgeStore.accessCount,
        })
        .from(knowledgeStore)
        .where(
          and(
            isNull(knowledgeStore.supersededBy),
            lte(knowledgeStore.relevanceScore, 0.3),
          ),
        )
        .orderBy(knowledgeStore.relevanceScore)
        .limit(5);

      return {
        period: { from: weekAgo.toISOString(), to: new Date().toISOString() },
        newEntries: { count: newEntries.length, items: newEntries },
        topAccessed: { items: topAccessed },
        lowRelevance: { items: lowRelevance, message: "Consider pruning or updating these entries" },
      };
    },
  };
}
