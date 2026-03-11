import type { Db } from "@paperclipai/db";
import { issueService } from "./issues.js";
import { heartbeatService } from "./heartbeat.js";

interface ActionContext {
  issueId: string;
  companyId: string;
  params: Record<string, unknown>;
}

export function webhookActionExecutor(db: Db) {
  const issues = issueService(db);
  const heartbeat = heartbeatService(db);

  return {
    async execute(action: string, ctx: ActionContext): Promise<void> {
      switch (action) {
        case "move_issue_to_status": {
          const targetStatus = (ctx.params.target_status ?? ctx.params.targetStatus) as string;
          if (!targetStatus) return;
          await issues.update(ctx.issueId, { status: targetStatus as any });
          break;
        }
        case "add_issue_comment": {
          const body =
            (ctx.params.comment as string) ??
            `Webhook triggered: action ${action}`;
          await issues.addComment(ctx.issueId, body, {});
          break;
        }
        case "wake_agent": {
          const agentId = ctx.params.agent_id as string | undefined;
          if (!agentId) return;
          await heartbeat.wakeup(agentId, {
            source: "automation",
            triggerDetail: "system",
            reason: "webhook_trigger",
            payload: { issueId: ctx.issueId },
            requestedByActorType: "system",
          });
          break;
        }
      }
    },
  };
}
