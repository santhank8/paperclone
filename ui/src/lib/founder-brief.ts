// Normalizes the founder brief snapshot so the UI can render safely even when some signals are missing.
import type {
  VirtualOrgFeedbackPulse,
  VirtualOrgFounderActionItem,
  VirtualOrgFounderBrief,
  VirtualOrgProductPulse,
} from "@paperclipai/virtual-org-types";

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function normalizeStatus(value: unknown): VirtualOrgProductPulse["status"] {
  return value === "healthy" || value === "watch" || value === "risk" || value === "unavailable"
    ? value
    : "unavailable";
}

function normalizeActionItems(value: unknown): VirtualOrgFounderActionItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const priority = record.priority === "high" || record.priority === "medium" || record.priority === "low"
        ? record.priority
        : "medium";
      const source = record.source === "revenue" || record.source === "product" || record.source === "feedback"
        ? record.source
        : "product";
      return {
        id: asString(record.id),
        title: asString(record.title),
        summary: asString(record.summary),
        recommendedAction: asString(record.recommendedAction),
        priority,
        source,
      } satisfies VirtualOrgFounderActionItem;
    })
    .filter((item): item is VirtualOrgFounderActionItem => item !== null && item.title.length > 0);
}

function normalizeProductPulse(value: unknown): VirtualOrgProductPulse {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const importantEventCounts = Array.isArray(record.importantEventCounts)
    ? record.importantEventCounts
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const event = item as Record<string, unknown>;
        return {
          eventName: asString(event.eventName),
          count: asNumber(event.count),
        };
      })
      .filter((item): item is { eventName: string; count: number } => item !== null && item.eventName.length > 0)
    : [];

  return {
    status: normalizeStatus(record.status),
    checkedAt: record.checkedAt === null ? null : asString(record.checkedAt) || null,
    eventCount: asNumber(record.eventCount),
    activeUserTotal: asNumber(record.activeUserTotal),
    onboardingEvent: record.onboardingEvent === null ? null : asString(record.onboardingEvent) || null,
    onboardingEventCount: asNumber(record.onboardingEventCount),
    importantEventCounts,
    summary: asString(record.summary, "Product usage preview is not available on this sync."),
  };
}

function normalizeFeedbackPulse(value: unknown): VirtualOrgFeedbackPulse {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const highlights = Array.isArray(record.highlights)
    ? record.highlights
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const highlight = item as Record<string, unknown>;
        return {
          postedAt: asString(highlight.postedAt),
          channelName: highlight.channelName === null ? null : asString(highlight.channelName) || null,
          channelBucket: highlight.channelBucket === "customer_feedback" || highlight.channelBucket === "tech_issues" || highlight.channelBucket === "other"
            ? highlight.channelBucket
            : "other",
          authorLabel: highlight.authorLabel === null ? null : asString(highlight.authorLabel) || null,
          text: asString(highlight.text),
          categories: Array.isArray(highlight.categories)
            ? highlight.categories.filter((category): category is string => typeof category === "string")
            : [],
        };
      })
      .filter((item): item is VirtualOrgFeedbackPulse["highlights"][number] => item !== null && item.text.length > 0)
    : [];

  return {
    status: normalizeStatus(record.status),
    checkedAt: record.checkedAt === null ? null : asString(record.checkedAt) || null,
    channelId: record.channelId === null ? null : asString(record.channelId) || null,
    channelsReviewed: asNumber(record.channelsReviewed),
    channelsWithMessages: asNumber(record.channelsWithMessages),
    messageCount: asNumber(record.messageCount),
    customerMessageCount: asNumber(record.customerMessageCount),
    customerFeedbackMessages: asNumber(record.customerFeedbackMessages),
    techIssueMessages: asNumber(record.techIssueMessages),
    bugMentions: asNumber(record.bugMentions),
    featureRequestMentions: asNumber(record.featureRequestMentions),
    churnRiskMentions: asNumber(record.churnRiskMentions),
    praiseMentions: asNumber(record.praiseMentions),
    supportMentions: asNumber(record.supportMentions),
    summary: asString(record.summary, "Customer feedback pulse is not available on this sync."),
    highlights,
  };
}

export function normalizeFounderBrief(
  value: Partial<VirtualOrgFounderBrief> | null | undefined,
): VirtualOrgFounderBrief | null {
  if (!value) return null;
  return {
    generatedAt: asString(value.generatedAt),
    headline: asString(value.headline),
    summary: asString(value.summary),
    productPulse: normalizeProductPulse(value.productPulse),
    feedbackPulse: normalizeFeedbackPulse(value.feedbackPulse),
    actionItems: normalizeActionItems(value.actionItems),
  };
}
