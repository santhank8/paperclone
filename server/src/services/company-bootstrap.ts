import { eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { companies } from "@paperclipai/db";
import { agentService } from "./agents.js";
import { heartbeatService } from "./heartbeat.js";
import { logActivity } from "./activity-log.js";

type HeartbeatService = ReturnType<typeof heartbeatService>;

export function companyBootstrapService(db: Db, heartbeat: HeartbeatService) {
  const agentSvc = agentService(db);

  return {
    async bootstrapCeo(companyId: string, options?: {
      ceoModel?: string;
      actorUserId?: string;
    }): Promise<{ agentId: string } | null> {
      const [company] = await db
        .select()
        .from(companies)
        .where(eq(companies.id, companyId))
        .limit(1);

      if (!company) return null;

      // Check if CEO already exists using agentSvc.list()
      const allAgents = await agentSvc.list(companyId);
      const ceoAgent = allAgents.find((a: any) => a.role === "ceo" && a.status !== "terminated");
      if (ceoAgent) {
        return { agentId: ceoAgent.id };
      }

      const model = options?.ceoModel ?? (company as any).defaultCeoModel ?? "sonnet";

      const ceo = await agentSvc.create(companyId, {
        name: "CEO",
        role: "ceo",
        title: "Chief Executive Officer",
        status: "idle",
        adapterType: "claude_local",
        adapterConfig: { model },
        runtimeConfig: {},
        budgetMonthlyCents: 500,
        spentMonthlyCents: 0,
        capabilities: "leadership, strategy, hiring, delegation, company management",
        permissions: { canCreateAgents: true },
        lastHeartbeatAt: null,
      });

      await logActivity(db, {
        companyId,
        actorType: "system",
        actorId: "auto-bootstrap",
        action: "agent.created",
        entityType: "agent",
        entityId: ceo.id,
        details: { name: "CEO", role: "ceo", reason: "auto-bootstrap" },
      });

      await heartbeat.wakeup(ceo.id, {
        source: "automation",
        triggerDetail: "system",
        reason: "Company bootstrap — CEO initialized, ready for onboarding",
        payload: { companyId, companyName: company.name, bootstrapAction: "onboard" },
        requestedByActorType: "system",
        requestedByActorId: "auto-bootstrap",
      });

      return { agentId: ceo.id };
    },
  };
}
