import type { Agent } from "@paperclipai/shared";
import { textFor, type UiLanguage } from "./ui-language";

type ActivityDetails = Record<string, unknown> | null | undefined;

type ActivityParticipant = {
  type: "agent" | "user";
  agentId?: string | null;
  userId?: string | null;
};

type ActivityIssueReference = {
  id?: string | null;
  identifier?: string | null;
  title?: string | null;
};

interface ActivityFormatOptions {
  agentMap?: Map<string, Agent>;
  currentUserId?: string | null;
  uiLanguage?: UiLanguage;
}

const ACTIVITY_ROW_VERBS: Record<string, { en: string; "zh-CN": string }> = {
  "issue.created": { en: "created", "zh-CN": "创建了" },
  "issue.updated": { en: "updated", "zh-CN": "更新了" },
  "issue.checked_out": { en: "checked out", "zh-CN": "检出了" },
  "issue.released": { en: "released", "zh-CN": "发布了" },
  "issue.comment_added": { en: "commented on", "zh-CN": "评论了" },
  "issue.attachment_added": { en: "attached file to", "zh-CN": "添加了附件到" },
  "issue.attachment_removed": { en: "removed attachment from", "zh-CN": "移除了附件自" },
  "issue.document_created": { en: "created document for", "zh-CN": "创建了文档给" },
  "issue.document_updated": { en: "updated document on", "zh-CN": "更新了文档于" },
  "issue.document_deleted": { en: "deleted document from", "zh-CN": "删除了文档自" },
  "issue.commented": { en: "commented on", "zh-CN": "评论了" },
  "issue.deleted": { en: "deleted", "zh-CN": "删除了" },
  "agent.created": { en: "created", "zh-CN": "创建了" },
  "agent.updated": { en: "updated", "zh-CN": "更新了" },
  "agent.paused": { en: "paused", "zh-CN": "暂停了" },
  "agent.resumed": { en: "resumed", "zh-CN": "恢复了" },
  "agent.terminated": { en: "terminated", "zh-CN": "终止了" },
  "agent.key_created": { en: "created API key for", "zh-CN": "为其创建了 API 密钥" },
  "agent.budget_updated": { en: "updated budget for", "zh-CN": "更新了预算给" },
  "agent.runtime_session_reset": { en: "reset session for", "zh-CN": "重置了会话给" },
  "heartbeat.invoked": { en: "invoked heartbeat for", "zh-CN": "触发了心跳给" },
  "heartbeat.cancelled": { en: "cancelled heartbeat for", "zh-CN": "取消了心跳给" },
  "approval.created": { en: "requested approval", "zh-CN": "发起了审批" },
  "approval.approved": { en: "approved", "zh-CN": "批准了" },
  "approval.rejected": { en: "rejected", "zh-CN": "拒绝了" },
  "project.created": { en: "created", "zh-CN": "创建了" },
  "project.updated": { en: "updated", "zh-CN": "更新了" },
  "project.deleted": { en: "deleted", "zh-CN": "删除了" },
  "goal.created": { en: "created", "zh-CN": "创建了" },
  "goal.updated": { en: "updated", "zh-CN": "更新了" },
  "goal.deleted": { en: "deleted", "zh-CN": "删除了" },
  "cost.reported": { en: "reported cost for", "zh-CN": "上报了成本给" },
  "cost.recorded": { en: "recorded cost for", "zh-CN": "记录了成本给" },
  "company.created": { en: "created company", "zh-CN": "创建了公司" },
  "company.updated": { en: "updated company", "zh-CN": "更新了公司" },
  "company.archived": { en: "archived", "zh-CN": "归档了" },
  "company.budget_updated": { en: "updated budget for", "zh-CN": "更新了预算给" },
};

const ISSUE_ACTIVITY_LABELS: Record<string, { en: string; "zh-CN": string }> = {
  "issue.created": { en: "created the issue", "zh-CN": "创建了任务" },
  "issue.updated": { en: "updated the issue", "zh-CN": "更新了任务" },
  "issue.checked_out": { en: "checked out the issue", "zh-CN": "检出了任务" },
  "issue.released": { en: "released the issue", "zh-CN": "发布了任务" },
  "issue.comment_added": { en: "added a comment", "zh-CN": "添加了评论" },
  "issue.feedback_vote_saved": { en: "saved feedback on an AI output", "zh-CN": "保存了对 AI 输出的反馈" },
  "issue.attachment_added": { en: "added an attachment", "zh-CN": "添加了附件" },
  "issue.attachment_removed": { en: "removed an attachment", "zh-CN": "移除了附件" },
  "issue.document_created": { en: "created a document", "zh-CN": "创建了文档" },
  "issue.document_updated": { en: "updated a document", "zh-CN": "更新了文档" },
  "issue.document_deleted": { en: "deleted a document", "zh-CN": "删除了文档" },
  "issue.deleted": { en: "deleted the issue", "zh-CN": "删除了任务" },
  "agent.created": { en: "created an agent", "zh-CN": "创建了智能体" },
  "agent.updated": { en: "updated the agent", "zh-CN": "更新了智能体" },
  "agent.paused": { en: "paused the agent", "zh-CN": "暂停了智能体" },
  "agent.resumed": { en: "resumed the agent", "zh-CN": "恢复了智能体" },
  "agent.terminated": { en: "terminated the agent", "zh-CN": "终止了智能体" },
  "heartbeat.invoked": { en: "invoked a heartbeat", "zh-CN": "触发了心跳" },
  "heartbeat.cancelled": { en: "cancelled a heartbeat", "zh-CN": "取消了心跳" },
  "approval.created": { en: "requested approval", "zh-CN": "发起了审批" },
  "approval.approved": { en: "approved", "zh-CN": "批准了" },
  "approval.rejected": { en: "rejected", "zh-CN": "拒绝了" },
};

function resolveUiLanguage(options: ActivityFormatOptions): UiLanguage {
  return options.uiLanguage ?? "en";
}

function localizedText(
  copy: { en: string; "zh-CN": string },
  uiLanguage: UiLanguage,
): string {
  return textFor(uiLanguage, copy);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function humanizeValue(value: unknown): string {
  if (typeof value !== "string") return String(value ?? "none");
  return value.replace(/_/g, " ");
}

function isActivityParticipant(value: unknown): value is ActivityParticipant {
  const record = asRecord(value);
  if (!record) return false;
  return record.type === "agent" || record.type === "user";
}

function isActivityIssueReference(value: unknown): value is ActivityIssueReference {
  return asRecord(value) !== null;
}

function readParticipants(details: ActivityDetails, key: string): ActivityParticipant[] {
  const value = details?.[key];
  if (!Array.isArray(value)) return [];
  return value.filter(isActivityParticipant);
}

function readIssueReferences(details: ActivityDetails, key: string): ActivityIssueReference[] {
  const value = details?.[key];
  if (!Array.isArray(value)) return [];
  return value.filter(isActivityIssueReference);
}

function formatUserLabel(
  userId: string | null | undefined,
  currentUserId?: string | null,
  uiLanguage: UiLanguage = "en",
): string {
  if (!userId || userId === "local-board") {
    return localizedText({ en: "Board", "zh-CN": "董事会" }, uiLanguage);
  }
  if (currentUserId && userId === currentUserId) {
    return localizedText({ en: "You", "zh-CN": "你" }, uiLanguage);
  }
  return uiLanguage === "zh-CN" ? `用户 ${userId.slice(0, 5)}` : `user ${userId.slice(0, 5)}`;
}

function formatParticipantLabel(participant: ActivityParticipant, options: ActivityFormatOptions): string {
  const uiLanguage = resolveUiLanguage(options);
  if (participant.type === "agent") {
    const agentId = participant.agentId ?? "";
    return options.agentMap?.get(agentId)?.name ?? localizedText({ en: "agent", "zh-CN": "智能体" }, uiLanguage);
  }
  return formatUserLabel(participant.userId, options.currentUserId, uiLanguage);
}

function formatIssueReferenceLabel(reference: ActivityIssueReference, uiLanguage: UiLanguage = "en"): string {
  if (reference.identifier) return reference.identifier;
  if (reference.title) return reference.title;
  if (reference.id) return reference.id.slice(0, 8);
  return localizedText({ en: "issue", "zh-CN": "任务" }, uiLanguage);
}

function formatChangedEntityLabel(
  singular: string,
  plural: string,
  singularZh: string,
  pluralZh: string,
  labels: string[],
  uiLanguage: UiLanguage,
): string {
  if (uiLanguage === "zh-CN") {
    if (labels.length <= 0) return pluralZh;
    return `${labels.length === 1 ? singularZh : pluralZh} ${labels.join("、")}`;
  }
  if (labels.length <= 0) return plural;
  if (labels.length === 1) return `${singular} ${labels[0]}`;
  return `${labels.length} ${plural}`;
}

function formatIssueUpdatedVerb(details: ActivityDetails, uiLanguage: UiLanguage): string | null {
  if (!details) return null;
  const previous = asRecord(details._previous) ?? {};
  if (details.status !== undefined) {
    const from = previous.status;
    if (uiLanguage === "zh-CN") {
      return from
        ? `将状态从 ${humanizeValue(from)} 改为 ${humanizeValue(details.status)}`
        : `将状态改为 ${humanizeValue(details.status)}`;
    }
    return from
      ? `changed status from ${humanizeValue(from)} to ${humanizeValue(details.status)} on`
      : `changed status to ${humanizeValue(details.status)} on`;
  }
  if (details.priority !== undefined) {
    const from = previous.priority;
    if (uiLanguage === "zh-CN") {
      return from
        ? `将优先级从 ${humanizeValue(from)} 改为 ${humanizeValue(details.priority)}`
        : `将优先级改为 ${humanizeValue(details.priority)}`;
    }
    return from
      ? `changed priority from ${humanizeValue(from)} to ${humanizeValue(details.priority)} on`
      : `changed priority to ${humanizeValue(details.priority)} on`;
  }
  return null;
}

function formatIssueUpdatedAction(details: ActivityDetails, uiLanguage: UiLanguage): string | null {
  if (!details) return null;
  const previous = asRecord(details._previous) ?? {};
  const parts: string[] = [];

  if (details.status !== undefined) {
    const from = previous.status;
    parts.push(
      uiLanguage === "zh-CN"
        ? from
          ? `将状态从 ${humanizeValue(from)} 改为 ${humanizeValue(details.status)}`
          : `将状态改为 ${humanizeValue(details.status)}`
        : from
          ? `changed the status from ${humanizeValue(from)} to ${humanizeValue(details.status)}`
          : `changed the status to ${humanizeValue(details.status)}`,
    );
  }
  if (details.priority !== undefined) {
    const from = previous.priority;
    parts.push(
      uiLanguage === "zh-CN"
        ? from
          ? `将优先级从 ${humanizeValue(from)} 改为 ${humanizeValue(details.priority)}`
          : `将优先级改为 ${humanizeValue(details.priority)}`
        : from
          ? `changed the priority from ${humanizeValue(from)} to ${humanizeValue(details.priority)}`
          : `changed the priority to ${humanizeValue(details.priority)}`,
    );
  }
  if (details.assigneeAgentId !== undefined || details.assigneeUserId !== undefined) {
    parts.push(
      details.assigneeAgentId || details.assigneeUserId
        ? localizedText({ en: "assigned the issue", "zh-CN": "分配了任务" }, uiLanguage)
        : localizedText({ en: "unassigned the issue", "zh-CN": "取消了任务分配" }, uiLanguage),
    );
  }
  if (details.title !== undefined) {
    parts.push(localizedText({ en: "updated the title", "zh-CN": "更新了标题" }, uiLanguage));
  }
  if (details.description !== undefined) {
    parts.push(localizedText({ en: "updated the description", "zh-CN": "更新了描述" }, uiLanguage));
  }

  return parts.length > 0 ? parts.join(uiLanguage === "zh-CN" ? "，" : ", ") : null;
}

function formatStructuredIssueChange(input: {
  action: string;
  details: ActivityDetails;
  options: ActivityFormatOptions;
  forIssueDetail: boolean;
}): string | null {
  const details = input.details;
  if (!details) return null;
  const uiLanguage = resolveUiLanguage(input.options);

  if (input.action === "issue.blockers_updated") {
    const added = readIssueReferences(details, "addedBlockedByIssues").map((reference) => formatIssueReferenceLabel(reference, uiLanguage));
    const removed = readIssueReferences(details, "removedBlockedByIssues").map((reference) => formatIssueReferenceLabel(reference, uiLanguage));
    if (added.length > 0 && removed.length === 0) {
      const changed = formatChangedEntityLabel("blocker", "blockers", "阻塞任务", "阻塞任务", added, uiLanguage);
      if (uiLanguage === "zh-CN") return input.forIssueDetail ? `添加了${changed}` : `添加了${changed}`;
      return input.forIssueDetail ? `added ${changed}` : `added ${changed} to`;
    }
    if (removed.length > 0 && added.length === 0) {
      const changed = formatChangedEntityLabel("blocker", "blockers", "阻塞任务", "阻塞任务", removed, uiLanguage);
      if (uiLanguage === "zh-CN") return input.forIssueDetail ? `移除了${changed}` : `移除了${changed}`;
      return input.forIssueDetail ? `removed ${changed}` : `removed ${changed} from`;
    }
    return uiLanguage === "zh-CN"
      ? "更新了阻塞项"
      : (input.forIssueDetail ? "updated blockers" : "updated blockers on");
  }

  if (input.action === "issue.reviewers_updated" || input.action === "issue.approvers_updated") {
    const added = readParticipants(details, "addedParticipants").map((participant) => formatParticipantLabel(participant, input.options));
    const removed = readParticipants(details, "removedParticipants").map((participant) => formatParticipantLabel(participant, input.options));
    const singular = input.action === "issue.reviewers_updated" ? "reviewer" : "approver";
    const plural = input.action === "issue.reviewers_updated" ? "reviewers" : "approvers";
    const singularZh = input.action === "issue.reviewers_updated" ? "评审人" : "审批人";
    const pluralZh = singularZh;
    if (added.length > 0 && removed.length === 0) {
      const changed = formatChangedEntityLabel(singular, plural, singularZh, pluralZh, added, uiLanguage);
      if (uiLanguage === "zh-CN") return input.forIssueDetail ? `添加了${changed}` : `添加了${changed}`;
      return input.forIssueDetail ? `added ${changed}` : `added ${changed} to`;
    }
    if (removed.length > 0 && added.length === 0) {
      const changed = formatChangedEntityLabel(singular, plural, singularZh, pluralZh, removed, uiLanguage);
      if (uiLanguage === "zh-CN") return input.forIssueDetail ? `移除了${changed}` : `移除了${changed}`;
      return input.forIssueDetail ? `removed ${changed}` : `removed ${changed} from`;
    }
    return uiLanguage === "zh-CN"
      ? `更新了${pluralZh}`
      : (input.forIssueDetail ? `updated ${plural}` : `updated ${plural} on`);
  }

  return null;
}

export function formatActivityVerb(
  action: string,
  details?: Record<string, unknown> | null,
  options: ActivityFormatOptions = {},
): string {
  const uiLanguage = resolveUiLanguage(options);
  if (action === "issue.updated") {
    const issueUpdatedVerb = formatIssueUpdatedVerb(details, uiLanguage);
    if (issueUpdatedVerb) return issueUpdatedVerb;
  }

  const structuredChange = formatStructuredIssueChange({
    action,
    details,
    options,
    forIssueDetail: false,
  });
  if (structuredChange) return structuredChange;

  const copy = ACTIVITY_ROW_VERBS[action];
  return copy ? localizedText(copy, uiLanguage) : action.replace(/[._]/g, " ");
}

export function formatIssueActivityAction(
  action: string,
  details?: Record<string, unknown> | null,
  options: ActivityFormatOptions = {},
): string {
  const uiLanguage = resolveUiLanguage(options);
  if (action === "issue.updated") {
    const issueUpdatedAction = formatIssueUpdatedAction(details, uiLanguage);
    if (issueUpdatedAction) return issueUpdatedAction;
  }

  const structuredChange = formatStructuredIssueChange({
    action,
    details,
    options,
    forIssueDetail: true,
  });
  if (structuredChange) return structuredChange;

  if (
    (action === "issue.document_created" || action === "issue.document_updated" || action === "issue.document_deleted") &&
    details
  ) {
    const key = typeof details.key === "string"
      ? details.key
      : localizedText({ en: "document", "zh-CN": "文档" }, uiLanguage);
    const title = typeof details.title === "string" && details.title ? ` (${details.title})` : "";
    return `${localizedText(ISSUE_ACTIVITY_LABELS[action] ?? { en: action, "zh-CN": action }, uiLanguage)} ${key}${title}`;
  }

  return localizedText(ISSUE_ACTIVITY_LABELS[action] ?? { en: action.replace(/[._]/g, " "), "zh-CN": action.replace(/[._]/g, " ") }, uiLanguage);
}
