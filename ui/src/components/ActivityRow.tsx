import { Link } from "@/lib/router";
import { Identity } from "./Identity";
import { timeAgo } from "../lib/timeAgo";
import { cn } from "../lib/utils";
import { useI18n } from "../context/I18nContext";
import { deriveProjectUrlKey, type ActivityEvent, type Agent } from "@paperclipai/shared";

const ACTION_VERBS: Record<string, string> = {
  "issue.created": "created",
  "issue.updated": "updated",
  "issue.checked_out": "checked out",
  "issue.released": "released",
  "issue.comment_added": "commented on",
  "issue.attachment_added": "attached file to",
  "issue.attachment_removed": "removed attachment from",
  "issue.commented": "commented on",
  "issue.deleted": "deleted",
  "agent.created": "created",
  "agent.updated": "updated",
  "agent.paused": "paused",
  "agent.resumed": "resumed",
  "agent.terminated": "terminated",
  "agent.key_created": "created API key for",
  "agent.budget_updated": "updated budget for",
  "agent.runtime_session_reset": "reset session for",
  "heartbeat.invoked": "invoked heartbeat for",
  "heartbeat.cancelled": "cancelled heartbeat for",
  "approval.created": "requested approval",
  "approval.approved": "approved",
  "approval.rejected": "rejected",
  "project.created": "created",
  "project.updated": "updated",
  "project.deleted": "deleted",
  "goal.created": "created",
  "goal.updated": "updated",
  "goal.deleted": "deleted",
  "cost.reported": "reported cost for",
  "cost.recorded": "recorded cost for",
  "company.created": "created company",
  "company.updated": "updated company",
  "company.archived": "archived",
  "company.budget_updated": "updated budget for",
};

function humanizeValue(value: unknown): string {
  if (typeof value !== "string") return String(value ?? "none");
  return value.replace(/_/g, " ");
}

function formatVerb(action: string, details?: Record<string, unknown> | null, t?: (key: string, vars?: Record<string, string>) => string): string {
  if (action === "issue.updated" && details) {
    const previous = (details._previous ?? {}) as Record<string, unknown>;
    if (details.status !== undefined) {
      const from = previous.status;
      return from
        ? (t
            ? t("activityVerb.changedStatus", {
                from: humanizeValue(from),
                to: humanizeValue(details.status),
              })
            : `changed status from ${humanizeValue(from)} to ${humanizeValue(details.status)} on`)
        : (t
            ? t("activityVerb.changedStatusTo", { to: humanizeValue(details.status) })
            : `changed status to ${humanizeValue(details.status)} on`);
    }
    if (details.priority !== undefined) {
      const from = previous.priority;
      return from
        ? (t
            ? t("activityVerb.changedPriority", {
                from: humanizeValue(from),
                to: humanizeValue(details.priority),
              })
            : `changed priority from ${humanizeValue(from)} to ${humanizeValue(details.priority)} on`)
        : (t
            ? t("activityVerb.changedPriorityTo", { to: humanizeValue(details.priority) })
            : `changed priority to ${humanizeValue(details.priority)} on`);
    }
  }

  const verbKeyMap: Record<string, string> = {
    "issue.created": "activityVerb.created",
    "issue.checked_out": "activityVerb.checkedOut",
    "issue.released": "activityVerb.released",
    "issue.comment_added": "activityVerb.commentedOn",
    "issue.attachment_added": "activityVerb.attachedFileTo",
    "issue.attachment_removed": "activityVerb.removedAttachmentFrom",
    "issue.commented": "activityVerb.commentedOn",
    "issue.deleted": "activityVerb.deleted",
    "agent.created": "activityVerb.created",
    "agent.updated": "activityVerb.updated",
    "agent.paused": "activityVerb.paused",
    "agent.resumed": "activityVerb.resumed",
    "agent.terminated": "activityVerb.terminated",
    "agent.key_created": "activityVerb.createdApiKeyFor",
    "agent.budget_updated": "activityVerb.updatedBudgetFor",
    "agent.runtime_session_reset": "activityVerb.resetSessionFor",
    "heartbeat.invoked": "activityVerb.invokedHeartbeatFor",
    "heartbeat.cancelled": "activityVerb.cancelledHeartbeatFor",
    "approval.created": "activityVerb.requestedApproval",
    "approval.approved": "activityVerb.approved",
    "approval.rejected": "activityVerb.rejected",
    "project.created": "activityVerb.created",
    "project.updated": "activityVerb.updated",
    "project.deleted": "activityVerb.deleted",
    "goal.created": "activityVerb.created",
    "goal.updated": "activityVerb.updated",
    "goal.deleted": "activityVerb.deleted",
    "cost.reported": "activityVerb.reportedCostFor",
    "cost.recorded": "activityVerb.recordedCostFor",
    "company.created": "event.companyCreated",
    "company.updated": "activityVerb.updatedCompany",
    "company.archived": "activityVerb.archived",
    "company.budget_updated": "activityVerb.updatedBudgetFor",
  };

  if (t && verbKeyMap[action]) return t(verbKeyMap[action]);
  return ACTION_VERBS[action] ?? action.replace(/[._]/g, " ");
}

function entityLink(entityType: string, entityId: string, name?: string | null): string | null {
  switch (entityType) {
    case "issue": return `/issues/${name ?? entityId}`;
    case "agent": return `/agents/${entityId}`;
    case "project": return `/projects/${deriveProjectUrlKey(name, entityId)}`;
    case "goal": return `/goals/${entityId}`;
    case "approval": return `/approvals/${entityId}`;
    default: return null;
  }
}

interface ActivityRowProps {
  event: ActivityEvent;
  agentMap: Map<string, Agent>;
  entityNameMap: Map<string, string>;
  entityTitleMap?: Map<string, string>;
  className?: string;
}

export function ActivityRow({ event, agentMap, entityNameMap, entityTitleMap, className }: ActivityRowProps) {
  const { t } = useI18n();
  const verb = formatVerb(event.action, event.details, t);

  const isHeartbeatEvent = event.entityType === "heartbeat_run";
  const heartbeatAgentId = isHeartbeatEvent
    ? (event.details as Record<string, unknown> | null)?.agentId as string | undefined
    : undefined;

  const name = isHeartbeatEvent
    ? (heartbeatAgentId ? entityNameMap.get(`agent:${heartbeatAgentId}`) : null)
    : entityNameMap.get(`${event.entityType}:${event.entityId}`);

  const entityTitle = entityTitleMap?.get(`${event.entityType}:${event.entityId}`);

  const link = isHeartbeatEvent && heartbeatAgentId
    ? `/agents/${heartbeatAgentId}/runs/${event.entityId}`
    : entityLink(event.entityType, event.entityId, name);

  const actor = event.actorType === "agent" ? agentMap.get(event.actorId) : null;
  const actorName = actor?.name ?? (event.actorType === "system" ? t("activity.actorSystem") : event.actorType === "user" ? t("activity.actorBoard") : event.actorId || t("activity.actorUnknown"));

  const inner = (
    <div className="flex gap-3">
      <p className="flex-1 min-w-0 truncate">
        <Identity
          name={actorName}
          size="xs"
          className="align-baseline"
        />
        <span className="text-muted-foreground ml-1">{verb} </span>
        {name && <span className="font-medium">{name}</span>}
        {entityTitle && <span className="text-muted-foreground ml-1">— {entityTitle}</span>}
      </p>
      <span className="text-xs text-muted-foreground shrink-0 pt-0.5">{timeAgo(event.createdAt)}</span>
    </div>
  );

  const classes = cn(
    "px-4 py-2 text-sm",
    link && "cursor-pointer hover:bg-accent/50 transition-colors",
    className,
  );

  if (link) {
    return (
      <Link to={link} className={cn(classes, "no-underline text-inherit block")}>
        {inner}
      </Link>
    );
  }

  return (
    <div className={classes}>
      {inner}
    </div>
  );
}
