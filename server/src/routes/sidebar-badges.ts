import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { and, eq, sql } from "drizzle-orm";
import { joinRequests } from "@paperclipai/db";
import { sidebarBadgeService } from "../services/sidebar-badges.js";
import { inboxDismissalService } from "../services/inbox-dismissals.js";
import { issueService } from "../services/issues.js";
import { accessService } from "../services/access.js";
import { dashboardService } from "../services/dashboard.js";
import { heartbeatService } from "../services/heartbeat.js";
import { assertCompanyAccess } from "./authz.js";

export function sidebarBadgeRoutes(db: Db) {
  const router = Router();
  const svc = sidebarBadgeService(db);
  const issueSvc = issueService(db);
  const access = accessService(db);
  const dashboard = dashboardService(db);
  const heartbeat = heartbeatService(db);
  const inboxDismissals = inboxDismissalService(db);

  router.get("/companies/:companyId/sidebar-badges", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    let canApproveJoins = false;
    if (req.actor.type === "board") {
      canApproveJoins =
        req.actor.source === "local_implicit" ||
        Boolean(req.actor.isInstanceAdmin) ||
        (await access.canUser(companyId, req.actor.userId, "joins:approve"));
    } else if (req.actor.type === "agent" && req.actor.agentId) {
      canApproveJoins = await access.hasPermission(companyId, "agent", req.actor.agentId, "joins:approve");
    }

    const joinRequestCount = canApproveJoins
      ? await db
        .select({ count: sql<number>`count(*)` })
        .from(joinRequests)
        .where(and(eq(joinRequests.companyId, companyId), eq(joinRequests.status, "pending_approval")))
        .then((rows) => Number(rows[0]?.count ?? 0))
      : 0;

    const [latestFailedRuns, dismissals] = await Promise.all([
      heartbeat.listLatestFailedRuns(companyId),
      req.actor.type === "board" && req.actor.userId
        ? inboxDismissals.listActive(companyId, req.actor.userId)
        : Promise.resolve({
          failedRunIds: [],
          staleIssueIds: [],
          alerts: { agentErrors: false, budget: false },
          items: [],
        }),
    ]);
    const visibleFailedRunCount = Math.max(latestFailedRuns.length - dismissals.failedRunIds.length, 0);
    const badges = await svc.get(companyId, { joinRequests: joinRequestCount, failedRuns: visibleFailedRunCount });
    const summary = await dashboard.summary(companyId);
    const staleIssueCount = Math.max(
      await issueSvc.staleCount(companyId, 24 * 60) - dismissals.staleIssueIds.length,
      0,
    );
    const hasFailedRuns = visibleFailedRunCount > 0;
    const alertsCount =
      (summary.agents.error > 0 && !hasFailedRuns && !dismissals.alerts.agentErrors ? 1 : 0) +
      (
        summary.costs.monthBudgetCents > 0 &&
        summary.costs.monthUtilizationPercent >= 80 &&
        !dismissals.alerts.budget
          ? 1
          : 0
      );
    badges.inbox = visibleFailedRunCount + alertsCount + staleIssueCount + joinRequestCount + badges.approvals;

    res.json(badges);
  });

  return router;
}
