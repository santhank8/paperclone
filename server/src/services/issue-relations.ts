import { and, eq, or, desc } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { issueRelations, issues } from "@paperclipai/db";
import { notFound, unprocessable } from "../errors.js";
import type { IssueRelationType } from "@paperclipai/shared";

export function issueRelationService(db: Db) {
  async function getIssue(issueId: string) {
    return db
      .select()
      .from(issues)
      .where(eq(issues.id, issueId))
      .then((rows) => rows[0] ?? null);
  }

  return {
    listForIssue: async (issueId: string) => {
      const issue = await getIssue(issueId);
      if (!issue) throw notFound("Issue not found");

      const rows = await db
        .select({
          id: issueRelations.id,
          companyId: issueRelations.companyId,
          issueId: issueRelations.issueId,
          relatedIssueId: issueRelations.relatedIssueId,
          type: issueRelations.type,
          createdAt: issueRelations.createdAt,
          relatedIssueTitle: issues.title,
          relatedIssueIdentifier: issues.identifier,
          relatedIssueStatus: issues.status,
        })
        .from(issueRelations)
        .innerJoin(issues, eq(issueRelations.relatedIssueId, issues.id))
        .where(eq(issueRelations.issueId, issueId))
        .orderBy(desc(issueRelations.createdAt));

      return rows.map((row) => ({
        id: row.id,
        companyId: row.companyId,
        issueId: row.issueId,
        relatedIssueId: row.relatedIssueId,
        type: row.type as IssueRelationType,
        relatedIssue: {
          id: row.relatedIssueId,
          identifier: row.relatedIssueIdentifier,
          title: row.relatedIssueTitle,
          status: row.relatedIssueStatus,
        },
        createdAt: row.createdAt,
      }));
    },

    create: async (
      issueId: string,
      data: { relatedIssueId: string; type: IssueRelationType },
    ) => {
      const issue = await getIssue(issueId);
      if (!issue) throw notFound("Issue not found");

      const relatedIssue = await getIssue(data.relatedIssueId);
      if (!relatedIssue) throw notFound("Related issue not found");

      if (issue.companyId !== relatedIssue.companyId) {
        throw unprocessable("Issues must belong to the same company");
      }
      if (issueId === data.relatedIssueId) {
        throw unprocessable("An issue cannot relate to itself");
      }

      const [relation] = await db
        .insert(issueRelations)
        .values({
          companyId: issue.companyId,
          issueId,
          relatedIssueId: data.relatedIssueId,
          type: data.type,
        })
        .onConflictDoNothing()
        .returning();

      if (!relation) {
        throw unprocessable("This relation already exists");
      }

      // Create the inverse relation for blocks/blocked_by
      if (data.type === "blocks") {
        await db
          .insert(issueRelations)
          .values({
            companyId: issue.companyId,
            issueId: data.relatedIssueId,
            relatedIssueId: issueId,
            type: "blocked_by",
          })
          .onConflictDoNothing();
      } else if (data.type === "blocked_by") {
        await db
          .insert(issueRelations)
          .values({
            companyId: issue.companyId,
            issueId: data.relatedIssueId,
            relatedIssueId: issueId,
            type: "blocks",
          })
          .onConflictDoNothing();
      }

      return relation;
    },

    delete: async (issueId: string, relationId: string) => {
      const [relation] = await db
        .select()
        .from(issueRelations)
        .where(and(eq(issueRelations.id, relationId), eq(issueRelations.issueId, issueId)));

      if (!relation) throw notFound("Relation not found");

      // Delete the inverse relation for blocks/blocked_by
      if (relation.type === "blocks" || relation.type === "blocked_by") {
        const inverseType = relation.type === "blocks" ? "blocked_by" : "blocks";
        await db
          .delete(issueRelations)
          .where(
            and(
              eq(issueRelations.issueId, relation.relatedIssueId),
              eq(issueRelations.relatedIssueId, relation.issueId),
              eq(issueRelations.type, inverseType),
            ),
          );
      }

      await db.delete(issueRelations).where(eq(issueRelations.id, relationId));
      return true;
    },

    /**
     * Find all issues that are blocked by the given issue.
     * Used for dependency-aware status transitions.
     */
    findBlockedByIssue: async (issueId: string) => {
      return db
        .select({
          id: issueRelations.id,
          blockedIssueId: issueRelations.relatedIssueId,
        })
        .from(issueRelations)
        .where(
          and(
            eq(issueRelations.issueId, issueId),
            eq(issueRelations.type, "blocks"),
          ),
        );
    },

    /**
     * Check if all blockers of an issue are resolved (done or cancelled).
     */
    areAllBlockersResolved: async (issueId: string) => {
      const blockers = await db
        .select({
          blockerIssueId: issueRelations.relatedIssueId,
          blockerStatus: issues.status,
        })
        .from(issueRelations)
        .innerJoin(issues, eq(issueRelations.relatedIssueId, issues.id))
        .where(
          and(
            eq(issueRelations.issueId, issueId),
            eq(issueRelations.type, "blocked_by"),
          ),
        );

      if (blockers.length === 0) return true;
      return blockers.every(
        (b) => b.blockerStatus === "done" || b.blockerStatus === "cancelled",
      );
    },
  };
}
