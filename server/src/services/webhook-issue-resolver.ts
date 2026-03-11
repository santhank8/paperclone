import { eq, and, inArray } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { webhookIssueLinks, issues } from "@paperclipai/db";
import type { NormalizedWebhookEvent } from "../lib/webhook-providers/types.js";
import type { SQL } from "drizzle-orm";

interface ResolvedIssue {
  id: string;
  identifier: string | null;
  title: string;
  source: "link" | "branch" | "pr_title" | "pr_body";
}

const IDENTIFIER_PATTERN = /([A-Z]+-\d+)/g;

function extractIdentifiers(...texts: (string | null | undefined)[]): string[] {
  const ids = new Set<string>();
  for (const text of texts) {
    if (!text) continue;
    for (const match of text.matchAll(IDENTIFIER_PATTERN)) {
      ids.add(match[1]);
    }
  }
  return Array.from(ids);
}

export function webhookIssueResolverService(db: Db) {
  /**
   * Build the base filter for issue queries.
   * When projectId is provided, scopes to that project instead of just companyId.
   */
  function issueScope(companyId: string, projectId: string | null | undefined): SQL {
    if (projectId) {
      return and(eq(issues.companyId, companyId), eq(issues.projectId, projectId))!;
    }
    return eq(issues.companyId, companyId);
  }

  return {
    async resolve(
      event: NormalizedWebhookEvent,
      companyId: string,
      provider: string,
      projectId?: string | null,
    ): Promise<ResolvedIssue[]> {
      const resolved: ResolvedIssue[] = [];
      const seenIds = new Set<string>();
      const scope = issueScope(companyId, projectId);

      // 1. Explicit webhook_issue_links lookup
      const externalIds: string[] = [];
      for (const pr of event.prNumbers) externalIds.push(String(pr));
      for (const branch of event.branches) externalIds.push(branch);
      if (event.repoFullName) externalIds.push(event.repoFullName);

      if (externalIds.length > 0) {
        const links = await db
          .select({ issueId: webhookIssueLinks.issueId })
          .from(webhookIssueLinks)
          .where(
            and(
              eq(webhookIssueLinks.companyId, companyId),
              eq(webhookIssueLinks.provider, provider),
              inArray(webhookIssueLinks.externalId, externalIds),
            ),
          );

        if (links.length > 0) {
          const linkedIssueIds = links.map((l) => l.issueId);
          const linkedIssues = await db
            .select({ id: issues.id, identifier: issues.identifier, title: issues.title })
            .from(issues)
            .where(inArray(issues.id, linkedIssueIds));

          for (const issue of linkedIssues) {
            if (!seenIds.has(issue.id)) {
              seenIds.add(issue.id);
              resolved.push({ ...issue, source: "link" });
            }
          }
        }
      }

      // 2. Extract identifiers from branch names
      const branchIds = extractIdentifiers(...event.branches);
      if (branchIds.length > 0) {
        const branchIssues = await db
          .select({ id: issues.id, identifier: issues.identifier, title: issues.title })
          .from(issues)
          .where(and(scope, inArray(issues.identifier, branchIds)));

        for (const issue of branchIssues) {
          if (!seenIds.has(issue.id)) {
            seenIds.add(issue.id);
            resolved.push({ ...issue, source: "branch" });
          }
        }
      }

      // 3. Extract identifiers from PR title/body
      const prTitleIds = extractIdentifiers(event.prTitle);
      const prBodyIds = extractIdentifiers(event.prBody);
      const allPrIds = [...new Set([...prTitleIds, ...prBodyIds])].filter(
        (id) => !branchIds.includes(id),
      );

      if (allPrIds.length > 0) {
        const prIssues = await db
          .select({ id: issues.id, identifier: issues.identifier, title: issues.title })
          .from(issues)
          .where(and(scope, inArray(issues.identifier, allPrIds)));

        for (const issue of prIssues) {
          if (!seenIds.has(issue.id)) {
            seenIds.add(issue.id);
            resolved.push({
              ...issue,
              source: prTitleIds.includes(issue.identifier!) ? "pr_title" : "pr_body",
            });
          }
        }
      }

      return resolved;
    },
  };
}
