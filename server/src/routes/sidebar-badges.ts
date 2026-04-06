import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { and, eq, sql } from "drizzle-orm";
import {
  joinRequests,
  issues,
  issueReadStates,
  issueComments,
} from "@paperclipai/db";
import { sidebarBadgeService } from "../services/sidebar-badges.js";
import { accessService } from "../services/access.js";
import { dashboardService } from "../services/dashboard.js";
import { assertCompanyAccess } from "./authz.js";

async function countTouchedIssuesForUser(
  db: Db,
  companyId: string,
  userId: string,
): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(issues)
    .where(
      sql<boolean>`
        ${issues.companyId} = ${companyId}
        AND (
          ${issues.createdByUserId} = ${userId}
          OR ${issues.assigneeUserId} = ${userId}
          OR EXISTS (
            SELECT 1 FROM ${issueReadStates}
            WHERE ${issueReadStates.issueId} = ${issues.id}
              AND ${issueReadStates.companyId} = ${companyId}
              AND ${issueReadStates.userId} = ${userId}
          )
          OR EXISTS (
            SELECT 1 FROM ${issueComments}
            WHERE ${issueComments.issueId} = ${issues.id}
              AND ${issueComments.companyId} = ${companyId}
              AND ${issueComments.authorUserId} = ${userId}
          )
        )
      `,
    )
    .then((rows) => Number(rows[0]?.count ?? 0));
  return result;
}

export function sidebarBadgeRoutes(db: Db) {
  const router = Router();
  const svc = sidebarBadgeService(db);
  const access = accessService(db);
  const dashboard = dashboardService(db);

  router.get("/companies/:companyId/sidebar-badges", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    let canApproveJoins = false;
    let userId: string | null = null;
    if (req.actor.type === "board") {
      canApproveJoins =
        req.actor.source === "local_implicit" ||
        Boolean(req.actor.isInstanceAdmin) ||
        (await access.canUser(
          companyId,
          req.actor.userId ?? "",
          "joins:approve",
        ));
      userId = req.actor.userId ?? null;
    } else if (req.actor.type === "agent" && req.actor.agentId) {
      canApproveJoins = await access.hasPermission(
        companyId,
        "agent",
        req.actor.agentId,
        "joins:approve",
      );
    }

    const joinRequestCount = canApproveJoins
      ? await db
          .select({ count: sql<number>`count(*)` })
          .from(joinRequests)
          .where(
            and(
              eq(joinRequests.companyId, companyId),
              eq(joinRequests.status, "pending_approval"),
            ),
          )
          .then((rows) => Number(rows[0]?.count ?? 0))
      : 0;

    const unreadTouchedIssues = userId
      ? await countTouchedIssuesForUser(db, companyId, userId)
      : 0;

    const badges = await svc.get(companyId, {
      joinRequests: joinRequestCount,
      unreadTouchedIssues,
    });
    const summary = await dashboard.summary(companyId);
    const hasFailedRuns = badges.failedRuns > 0;
    const alertsCount =
      (summary.agents.error > 0 && !hasFailedRuns ? 1 : 0) +
      (summary.costs.monthBudgetCents > 0 &&
      summary.costs.monthUtilizationPercent >= 80
        ? 1
        : 0);
    badges.inbox =
      badges.failedRuns +
      alertsCount +
      joinRequestCount +
      badges.approvals +
      unreadTouchedIssues;

    res.json(badges);
  });

  return router;
}
