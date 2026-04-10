import { and, asc, desc, eq, isNull, sql, inArray } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { knowledgeEntries, documents, documentRevisions, assets, agents } from "@paperclipai/db";
import type {
  KnowledgeEntry,
  KnowledgeEntryWithContent,
  KnowledgeAssetInfo,
  KnowledgeDepartment,
  KnowledgeDocumentRevision,
  KnowledgeEntryScope,
} from "@paperclipai/shared";
import { notFound, conflict, unprocessable } from "../errors.js";

function mapEntry(row: typeof knowledgeEntries.$inferSelect): KnowledgeEntry {
  return {
    id: row.id,
    companyId: row.companyId,
    parentId: row.parentId,
    type: row.type as KnowledgeEntry["type"],
    name: row.name,
    scope: row.scope as KnowledgeEntryScope,
    scopeAgentId: row.scopeAgentId,
    documentId: row.documentId,
    assetId: row.assetId,
    description: row.description,
    sortOrder: row.sortOrder,
    createdByUserId: row.createdByUserId,
    createdByAgentId: row.createdByAgentId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ── Department helpers ──────────────────────────────────────────────

async function findCeo(db: Db, companyId: string) {
  const rows = await db
    .select({ id: agents.id, name: agents.name, title: agents.title, role: agents.role, icon: agents.icon })
    .from(agents)
    .where(and(eq(agents.companyId, companyId), isNull(agents.reportsTo)));
  return rows[0] ?? null;
}

async function listDepartmentHeads(db: Db, companyId: string): Promise<KnowledgeDepartment[]> {
  const ceo = await findCeo(db, companyId);
  if (!ceo) return [];

  const heads = await db
    .select({
      id: agents.id,
      name: agents.name,
      title: agents.title,
      role: agents.role,
      icon: agents.icon,
    })
    .from(agents)
    .where(and(eq(agents.companyId, companyId), eq(agents.reportsTo, ceo.id)))
    .orderBy(asc(agents.name));

  return heads.map((h) => ({
    agentId: h.id,
    agentName: h.name,
    agentTitle: h.title,
    agentRole: h.role,
    agentIcon: h.icon,
  }));
}

async function getSubtreeAgentIds(db: Db, companyId: string, rootAgentId: string): Promise<string[]> {
  const result = await db.execute<{ id: string }>(sql`
    WITH RECURSIVE subtree AS (
      SELECT id FROM agents WHERE id = ${rootAgentId} AND company_id = ${companyId}
      UNION ALL
      SELECT a.id FROM agents a INNER JOIN subtree s ON a.reports_to = s.id WHERE a.company_id = ${companyId}
    )
    SELECT id FROM subtree
  `);
  return Array.from(result).map((r) => r.id);
}

async function getAgentDepartmentHead(
  db: Db,
  companyId: string,
  agentId: string,
): Promise<string | null> {
  const result = await db.execute<{ id: string }>(sql`
    WITH RECURSIVE chain AS (
      SELECT id, reports_to FROM agents WHERE id = ${agentId} AND company_id = ${companyId}
      UNION ALL
      SELECT a.id, a.reports_to FROM agents a INNER JOIN chain c ON a.id = c.reports_to WHERE a.company_id = ${companyId}
    )
    SELECT c.id FROM chain c
    INNER JOIN agents ceo ON c.reports_to = ceo.id AND ceo.reports_to IS NULL AND ceo.company_id = ${companyId}
    LIMIT 1
  `);
  const rows = Array.from(result);
  return rows[0]?.id ?? null;
}

// ── Descendant helper ───────────────────────────────────────────────

async function getDescendantIds(db: Db, companyId: string, entryId: string): Promise<string[]> {
  const result = await db.execute<{ id: string }>(sql`
    WITH RECURSIVE descendants AS (
      SELECT id FROM knowledge_entries WHERE id = ${entryId} AND company_id = ${companyId}
      UNION ALL
      SELECT ke.id FROM knowledge_entries ke INNER JOIN descendants d ON ke.parent_id = d.id WHERE ke.company_id = ${companyId}
    )
    SELECT id FROM descendants
  `);
  return Array.from(result).map((r) => r.id);
}

// ── Service ─────────────────────────────────────────────────────────

export function knowledgeService(db: Db) {
  return {
    listDepartments: (companyId: string) => listDepartmentHeads(db, companyId),

    list: async (
      companyId: string,
      filters: {
        scope?: KnowledgeEntryScope;
        scopeAgentId?: string;
        parentId?: string | null;
      } = {},
    ): Promise<KnowledgeEntry[]> => {
      const conditions = [eq(knowledgeEntries.companyId, companyId)];

      if (filters.scope) {
        conditions.push(eq(knowledgeEntries.scope, filters.scope));
      }
      if (filters.scopeAgentId) {
        conditions.push(eq(knowledgeEntries.scopeAgentId, filters.scopeAgentId));
      }
      if (filters.parentId === null || filters.parentId === undefined) {
        // If parentId not specified, only return root-level entries
        if ("parentId" in filters) {
          conditions.push(isNull(knowledgeEntries.parentId));
        }
      } else {
        conditions.push(eq(knowledgeEntries.parentId, filters.parentId));
      }

      const rows = await db
        .select()
        .from(knowledgeEntries)
        .where(and(...conditions))
        .orderBy(
          // folders first, then by sortOrder, then by name
          sql`CASE WHEN ${knowledgeEntries.type} = 'folder' THEN 0 ELSE 1 END`,
          asc(knowledgeEntries.sortOrder),
          asc(knowledgeEntries.name),
        );

      return rows.map(mapEntry);
    },

    listTree: async (
      companyId: string,
      filters: { scope?: KnowledgeEntryScope; scopeAgentId?: string } = {},
    ): Promise<KnowledgeEntry[]> => {
      const conditions = [eq(knowledgeEntries.companyId, companyId)];
      if (filters.scope) {
        conditions.push(eq(knowledgeEntries.scope, filters.scope));
      }
      if (filters.scopeAgentId) {
        conditions.push(eq(knowledgeEntries.scopeAgentId, filters.scopeAgentId));
      }

      const rows = await db
        .select()
        .from(knowledgeEntries)
        .where(and(...conditions))
        .orderBy(
          sql`CASE WHEN ${knowledgeEntries.type} = 'folder' THEN 0 ELSE 1 END`,
          asc(knowledgeEntries.sortOrder),
          asc(knowledgeEntries.name),
        );

      return rows.map(mapEntry);
    },

    getById: async (companyId: string, entryId: string): Promise<KnowledgeEntryWithContent | null> => {
      const entry = await db
        .select()
        .from(knowledgeEntries)
        .where(and(eq(knowledgeEntries.id, entryId), eq(knowledgeEntries.companyId, companyId)))
        .then((rows) => rows[0] ?? null);

      if (!entry) return null;

      let documentBody: string | null = null;
      let latestRevisionId: string | null = null;
      let latestRevisionNumber: number | null = null;
      let asset: KnowledgeAssetInfo | null = null;

      if (entry.type === "document" && entry.documentId) {
        const doc = await db
          .select()
          .from(documents)
          .where(eq(documents.id, entry.documentId))
          .then((rows) => rows[0] ?? null);
        if (doc) {
          documentBody = doc.latestBody;
          latestRevisionId = doc.latestRevisionId;
          latestRevisionNumber = doc.latestRevisionNumber;
        }
      }

      if (entry.type === "file" && entry.assetId) {
        const a = await db
          .select()
          .from(assets)
          .where(eq(assets.id, entry.assetId))
          .then((rows) => rows[0] ?? null);
        if (a) {
          asset = {
            assetId: a.id,
            provider: a.provider,
            objectKey: a.objectKey,
            contentType: a.contentType,
            byteSize: a.byteSize,
            sha256: a.sha256,
            originalFilename: a.originalFilename,
            contentPath: `/api/assets/${a.id}/content`,
          };
        }
      }

      return {
        ...mapEntry(entry),
        documentBody,
        latestRevisionId,
        latestRevisionNumber,
        asset,
      };
    },

    createFolder: async (
      companyId: string,
      input: {
        parentId?: string | null;
        name: string;
        scope: KnowledgeEntryScope;
        scopeAgentId?: string | null;
        description?: string | null;
        createdByUserId?: string | null;
        createdByAgentId?: string | null;
      },
    ): Promise<KnowledgeEntry> => {
      if ((input.scope === "department" || input.scope === "agent") && !input.scopeAgentId) {
        throw unprocessable("scopeAgentId is required for department and agent scopes");
      }
      const now = new Date();
      const [row] = await db
        .insert(knowledgeEntries)
        .values({
          companyId,
          parentId: input.parentId ?? null,
          type: "folder",
          name: input.name,
          scope: input.scope,
          scopeAgentId: input.scopeAgentId ?? null,
          description: input.description ?? null,
          createdByUserId: input.createdByUserId ?? null,
          createdByAgentId: input.createdByAgentId ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return mapEntry(row);
    },

    createDocument: async (
      companyId: string,
      input: {
        parentId?: string | null;
        name: string;
        scope: KnowledgeEntryScope;
        scopeAgentId?: string | null;
        description?: string | null;
        body: string;
        createdByUserId?: string | null;
        createdByAgentId?: string | null;
      },
    ): Promise<KnowledgeEntryWithContent> => {
      if ((input.scope === "department" || input.scope === "agent") && !input.scopeAgentId) {
        throw unprocessable("scopeAgentId is required for department and agent scopes");
      }
      const now = new Date();

      return db.transaction(async (tx) => {
        // Create the document row
        const [doc] = await tx
          .insert(documents)
          .values({
            companyId,
            title: input.name,
            format: "markdown",
            latestBody: input.body,
            latestRevisionId: null,
            latestRevisionNumber: 1,
            createdByAgentId: input.createdByAgentId ?? null,
            createdByUserId: input.createdByUserId ?? null,
            updatedByAgentId: input.createdByAgentId ?? null,
            updatedByUserId: input.createdByUserId ?? null,
            createdAt: now,
            updatedAt: now,
          })
          .returning();

        // Create initial revision
        const [revision] = await tx
          .insert(documentRevisions)
          .values({
            companyId,
            documentId: doc.id,
            revisionNumber: 1,
            title: input.name,
            format: "markdown",
            body: input.body,
            changeSummary: "Initial version",
            createdByAgentId: input.createdByAgentId ?? null,
            createdByUserId: input.createdByUserId ?? null,
            createdAt: now,
          })
          .returning();

        // Update document with revision ID
        await tx
          .update(documents)
          .set({ latestRevisionId: revision.id })
          .where(eq(documents.id, doc.id));

        // Create knowledge entry
        const [entry] = await tx
          .insert(knowledgeEntries)
          .values({
            companyId,
            parentId: input.parentId ?? null,
            type: "document",
            name: input.name,
            scope: input.scope,
            scopeAgentId: input.scopeAgentId ?? null,
            documentId: doc.id,
            description: input.description ?? null,
            createdByUserId: input.createdByUserId ?? null,
            createdByAgentId: input.createdByAgentId ?? null,
            createdAt: now,
            updatedAt: now,
          })
          .returning();

        return {
          ...mapEntry(entry),
          documentBody: input.body,
          latestRevisionId: revision.id,
          latestRevisionNumber: 1,
          asset: null,
        };
      });
    },

    createFile: async (
      companyId: string,
      input: {
        parentId?: string | null;
        name: string;
        scope: KnowledgeEntryScope;
        scopeAgentId?: string | null;
        description?: string | null;
        createdByUserId?: string | null;
        createdByAgentId?: string | null;
      },
      assetRow: {
        id: string;
        provider: string;
        objectKey: string;
        contentType: string;
        byteSize: number;
        sha256: string;
        originalFilename: string | null;
      },
    ): Promise<KnowledgeEntryWithContent> => {
      if ((input.scope === "department" || input.scope === "agent") && !input.scopeAgentId) {
        throw unprocessable("scopeAgentId is required for department and agent scopes");
      }
      const now = new Date();

      const [entry] = await db
        .insert(knowledgeEntries)
        .values({
          companyId,
          parentId: input.parentId ?? null,
          type: "file",
          name: input.name,
          scope: input.scope,
          scopeAgentId: input.scopeAgentId ?? null,
          assetId: assetRow.id,
          description: input.description ?? null,
          createdByUserId: input.createdByUserId ?? null,
          createdByAgentId: input.createdByAgentId ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      return {
        ...mapEntry(entry),
        documentBody: null,
        latestRevisionId: null,
        latestRevisionNumber: null,
        asset: {
          assetId: assetRow.id,
          provider: assetRow.provider,
          objectKey: assetRow.objectKey,
          contentType: assetRow.contentType,
          byteSize: assetRow.byteSize,
          sha256: assetRow.sha256,
          originalFilename: assetRow.originalFilename,
          contentPath: `/api/assets/${assetRow.id}/content`,
        },
      };
    },

    updateEntry: async (
      companyId: string,
      entryId: string,
      input: {
        name?: string;
        parentId?: string | null;
        description?: string | null;
        sortOrder?: number;
      },
    ): Promise<KnowledgeEntry | null> => {
      const existing = await db
        .select()
        .from(knowledgeEntries)
        .where(and(eq(knowledgeEntries.id, entryId), eq(knowledgeEntries.companyId, companyId)))
        .then((rows) => rows[0] ?? null);
      if (!existing) return null;

      const updates: Partial<typeof knowledgeEntries.$inferInsert> = { updatedAt: new Date() };
      if (input.name !== undefined) updates.name = input.name;
      if ("parentId" in input) updates.parentId = input.parentId ?? null;
      if ("description" in input) updates.description = input.description ?? null;
      if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;

      // If it's a document, also update the document title
      if (input.name !== undefined && existing.type === "document" && existing.documentId) {
        await db
          .update(documents)
          .set({ title: input.name, updatedAt: new Date() })
          .where(eq(documents.id, existing.documentId));
      }

      const [updated] = await db
        .update(knowledgeEntries)
        .set(updates)
        .where(eq(knowledgeEntries.id, entryId))
        .returning();

      return mapEntry(updated);
    },

    updateDocumentBody: async (
      companyId: string,
      entryId: string,
      input: {
        body: string;
        baseRevisionId?: string | null;
        changeSummary?: string | null;
        createdByUserId?: string | null;
        createdByAgentId?: string | null;
      },
    ) => {
      const entry = await db
        .select()
        .from(knowledgeEntries)
        .where(and(eq(knowledgeEntries.id, entryId), eq(knowledgeEntries.companyId, companyId)))
        .then((rows) => rows[0] ?? null);

      if (!entry) throw notFound("Knowledge entry not found");
      if (entry.type !== "document" || !entry.documentId) {
        throw unprocessable("Entry is not a document");
      }

      return db.transaction(async (tx) => {
        const doc = await tx
          .select()
          .from(documents)
          .where(eq(documents.id, entry.documentId!))
          .then((rows) => rows[0] ?? null);

        if (!doc) throw notFound("Document not found");

        // Conflict detection
        if (input.baseRevisionId && input.baseRevisionId !== doc.latestRevisionId) {
          throw conflict("Document was updated by someone else", {
            currentRevisionId: doc.latestRevisionId,
          });
        }

        const now = new Date();
        const nextRevisionNumber = doc.latestRevisionNumber + 1;

        const [revision] = await tx
          .insert(documentRevisions)
          .values({
            companyId,
            documentId: doc.id,
            revisionNumber: nextRevisionNumber,
            title: doc.title,
            format: doc.format,
            body: input.body,
            changeSummary: input.changeSummary ?? null,
            createdByAgentId: input.createdByAgentId ?? null,
            createdByUserId: input.createdByUserId ?? null,
            createdAt: now,
          })
          .returning();

        await tx
          .update(documents)
          .set({
            latestBody: input.body,
            latestRevisionId: revision.id,
            latestRevisionNumber: nextRevisionNumber,
            updatedByAgentId: input.createdByAgentId ?? null,
            updatedByUserId: input.createdByUserId ?? null,
            updatedAt: now,
          })
          .where(eq(documents.id, doc.id));

        await tx
          .update(knowledgeEntries)
          .set({ updatedAt: now })
          .where(eq(knowledgeEntries.id, entryId));

        return {
          ...mapEntry({ ...entry, updatedAt: now }),
          documentBody: input.body,
          latestRevisionId: revision.id,
          latestRevisionNumber: nextRevisionNumber,
          asset: null,
        };
      });
    },

    listRevisions: async (companyId: string, entryId: string): Promise<KnowledgeDocumentRevision[]> => {
      const entry = await db
        .select()
        .from(knowledgeEntries)
        .where(and(eq(knowledgeEntries.id, entryId), eq(knowledgeEntries.companyId, companyId)))
        .then((rows) => rows[0] ?? null);

      if (!entry || entry.type !== "document" || !entry.documentId) return [];

      return db
        .select({
          id: documentRevisions.id,
          companyId: documentRevisions.companyId,
          documentId: documentRevisions.documentId,
          revisionNumber: documentRevisions.revisionNumber,
          title: documentRevisions.title,
          format: documentRevisions.format,
          body: documentRevisions.body,
          changeSummary: documentRevisions.changeSummary,
          createdByAgentId: documentRevisions.createdByAgentId,
          createdByUserId: documentRevisions.createdByUserId,
          createdAt: documentRevisions.createdAt,
        })
        .from(documentRevisions)
        .where(eq(documentRevisions.documentId, entry.documentId))
        .orderBy(desc(documentRevisions.revisionNumber));
    },

    deleteEntry: async (companyId: string, entryId: string): Promise<KnowledgeEntry | null> => {
      const entry = await db
        .select()
        .from(knowledgeEntries)
        .where(and(eq(knowledgeEntries.id, entryId), eq(knowledgeEntries.companyId, companyId)))
        .then((rows) => rows[0] ?? null);

      if (!entry) return null;

      return db.transaction(async (tx) => {
        // Get all descendant IDs (for folder cascade)
        const allIds = await getDescendantIds(tx as unknown as Db, companyId, entryId);

        // Collect all document and asset IDs to clean up
        const entriesToDelete = await tx
          .select({
            id: knowledgeEntries.id,
            documentId: knowledgeEntries.documentId,
            assetId: knowledgeEntries.assetId,
          })
          .from(knowledgeEntries)
          .where(inArray(knowledgeEntries.id, allIds));

        const documentIds = entriesToDelete.filter((e) => e.documentId).map((e) => e.documentId!);
        const assetIds = entriesToDelete.filter((e) => e.assetId).map((e) => e.assetId!);

        // Delete knowledge entries (children first via FK cascade on parentId)
        // Delete from leaves up by reversing the list
        const reversedIds = [...allIds].reverse();
        for (const id of reversedIds) {
          await tx.delete(knowledgeEntries).where(eq(knowledgeEntries.id, id));
        }

        // Clean up orphaned documents (cascade will handle revisions)
        if (documentIds.length > 0) {
          await tx.delete(documents).where(inArray(documents.id, documentIds));
        }

        // Note: we don't delete asset files from storage here — that would need
        // a separate cleanup job. We only remove the DB rows.
        if (assetIds.length > 0) {
          await tx.delete(assets).where(inArray(assets.id, assetIds));
        }

        return mapEntry(entry);
      });
    },

    resolveAgentVisibleEntries: async (
      companyId: string,
      agentId: string,
    ): Promise<KnowledgeEntry[]> => {
      // 1. Company-scoped entries (visible to all)
      const companyEntries = await db
        .select()
        .from(knowledgeEntries)
        .where(and(eq(knowledgeEntries.companyId, companyId), eq(knowledgeEntries.scope, "company")));

      // 2. Agent's own entries
      const agentEntries = await db
        .select()
        .from(knowledgeEntries)
        .where(
          and(
            eq(knowledgeEntries.companyId, companyId),
            eq(knowledgeEntries.scope, "agent"),
            eq(knowledgeEntries.scopeAgentId, agentId),
          ),
        );

      // 3. Department entries — find which department this agent belongs to
      const deptHeadId = await getAgentDepartmentHead(db, companyId, agentId);
      let deptEntries: (typeof knowledgeEntries.$inferSelect)[] = [];
      if (deptHeadId) {
        deptEntries = await db
          .select()
          .from(knowledgeEntries)
          .where(
            and(
              eq(knowledgeEntries.companyId, companyId),
              eq(knowledgeEntries.scope, "department"),
              eq(knowledgeEntries.scopeAgentId, deptHeadId),
            ),
          );
      }

      // Also check if the agent IS a department head
      const ownDeptEntries = await db
        .select()
        .from(knowledgeEntries)
        .where(
          and(
            eq(knowledgeEntries.companyId, companyId),
            eq(knowledgeEntries.scope, "department"),
            eq(knowledgeEntries.scopeAgentId, agentId),
          ),
        );

      const allEntries = [...companyEntries, ...agentEntries, ...deptEntries, ...ownDeptEntries];
      // Deduplicate by ID
      const seen = new Set<string>();
      return allEntries
        .filter((e) => {
          if (seen.has(e.id)) return false;
          seen.add(e.id);
          return true;
        })
        .map(mapEntry);
    },
  };
}
