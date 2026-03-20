import type { Company, Issue, IssueStatus } from "@paperclipai/shared";

const TERMINAL_ISSUE_STATUSES = new Set<IssueStatus>(["done", "blocked", "cancelled"]);

export interface IssueLifecycleActor {
  actorType: "agent" | "user";
  actorId: string;
  agentId: string | null;
}

export interface IssueLifecycleWebhookPayload {
  event: "issue.lifecycle_transition";
  occurredAt: string;
  companyId: string;
  issue: {
    id: string;
    identifier: string | null;
    title: string;
    priority: string;
    status: string;
    assigneeAgentId: string | null;
    assigneeUserId: string | null;
    createdByAgentId: string | null;
    createdByUserId: string | null;
    assignedByAgentId: string | null;
    assignedByUserId: string | null;
  };
  transition: {
    from: string;
    to: string;
  };
  actor: {
    type: "agent" | "user";
    id: string;
    agentId: string | null;
    userId: string | null;
  };
  summary: string | null;
}

export interface IssueLifecycleWebhookDelivery {
  attempted: boolean;
  delivered: boolean;
  status: number | null;
  error: string | null;
}

export function isIssueLifecycleTerminalTransition(fromStatus: string, toStatus: string) {
  return fromStatus !== toStatus && TERMINAL_ISSUE_STATUSES.has(toStatus as IssueStatus);
}

export function resolveLifecycleWakeAgentIds(input: {
  issue: Pick<Issue, "createdByAgentId" | "assignedByAgentId">;
  company: Pick<Company, "notifyIssueCreator" | "notifyIssueAssigner">;
  actor: IssueLifecycleActor;
}) {
  const wakeIds = new Set<string>();
  if (input.company.notifyIssueCreator && input.issue.createdByAgentId) {
    wakeIds.add(input.issue.createdByAgentId);
  }
  if (input.company.notifyIssueAssigner && input.issue.assignedByAgentId) {
    wakeIds.add(input.issue.assignedByAgentId);
  }
  if (input.actor.actorType === "agent" && input.actor.agentId) {
    wakeIds.delete(input.actor.agentId);
  }
  return [...wakeIds];
}

export function buildIssueLifecycleWebhookPayload(input: {
  issue: {
    id: string;
    companyId: string;
    identifier: string | null;
    title: string;
    priority: string;
    status: string;
    assigneeAgentId: string | null;
    assigneeUserId: string | null;
    createdByAgentId: string | null;
    createdByUserId: string | null;
    assignedByAgentId?: string | null;
    assignedByUserId?: string | null;
  };
  previousStatus: string;
  actor: IssueLifecycleActor;
  summary?: string | null;
  occurredAt?: Date;
}): IssueLifecycleWebhookPayload {
  const occurredAt = input.occurredAt ?? new Date();
  const trimmedSummary = input.summary?.trim();
  return {
    event: "issue.lifecycle_transition",
    occurredAt: occurredAt.toISOString(),
    companyId: input.issue.companyId,
    issue: {
      id: input.issue.id,
      identifier: input.issue.identifier,
      title: input.issue.title,
      priority: input.issue.priority,
      status: input.issue.status,
      assigneeAgentId: input.issue.assigneeAgentId,
      assigneeUserId: input.issue.assigneeUserId,
      createdByAgentId: input.issue.createdByAgentId,
      createdByUserId: input.issue.createdByUserId,
      assignedByAgentId: input.issue.assignedByAgentId ?? null,
      assignedByUserId: input.issue.assignedByUserId ?? null,
    },
    transition: {
      from: input.previousStatus,
      to: input.issue.status,
    },
    actor: {
      type: input.actor.actorType,
      id: input.actor.actorId,
      agentId: input.actor.agentId,
      userId: input.actor.actorType === "user" ? input.actor.actorId : null,
    },
    summary: trimmedSummary && trimmedSummary.length > 0 ? trimmedSummary : null,
  };
}

export async function deliverIssueLifecycleWebhook(
  url: string | null | undefined,
  payload: IssueLifecycleWebhookPayload,
  opts?: {
    fetchImpl?: (input: string, init?: RequestInit) => Promise<{ ok: boolean; status: number }>;
    timeoutMs?: number;
  },
): Promise<IssueLifecycleWebhookDelivery> {
  if (!url) {
    return {
      attempted: false,
      delivered: false,
      status: null,
      error: null,
    };
  }

  const fetchImpl = opts?.fetchImpl ?? ((input: string, init?: RequestInit) => fetch(input, init));
  const timeoutMs = opts?.timeoutMs ?? 5000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    return {
      attempted: true,
      delivered: response.ok,
      status: response.status,
      error: response.ok ? null : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      attempted: true,
      delivered: false,
      status: null,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}
