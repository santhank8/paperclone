export const PLUGIN_ID = "connector-slack";
export const PLUGIN_VERSION = "0.1.0";

export const WEBHOOK_KEYS = {
  slackEvents: "slack-events",
  slackInteractive: "slack-interactive",
  slackCommands: "slack-commands",
} as const;

export const JOB_KEYS = {
  healthCheck: "slack-health-check",
} as const;

export const SLOT_IDS = {
  settingsPage: "connector-slack-settings",
} as const;

export const EXPORT_NAMES = {
  settingsPage: "SettingsPage",
} as const;

/** Paperclip issue statuses mapped to Slack display. */
export const STATUS_DISPLAY: Record<string, { emoji: string; label: string }> = {
  backlog: { emoji: "📋", label: "Backlog" },
  todo: { emoji: "📝", label: "To Do" },
  in_progress: { emoji: "🔨", label: "In Progress" },
  in_review: { emoji: "👀", label: "In Review" },
  blocked: { emoji: "🔴", label: "Blocked" },
  done: { emoji: "✅", label: "Done" },
  cancelled: { emoji: "❌", label: "Cancelled" },
};

export const PRIORITY_DISPLAY: Record<string, { emoji: string; label: string }> = {
  critical: { emoji: "🔥", label: "Critical" },
  high: { emoji: "🔺", label: "High" },
  medium: { emoji: "🔹", label: "Medium" },
  low: { emoji: "🔽", label: "Low" },
};

/** Slack reaction → Paperclip status mapping */
export const REACTION_STATUS_MAP: Record<string, string> = {
  white_check_mark: "done",
  rocket: "in_progress",
  red_circle: "blocked",
  eyes: "in_review",
  "no_entry_sign": "cancelled",
};

/** State key namespaces */
export const STATE_NAMESPACE = "slack";

/** State keys */
export const STATE_KEYS = {
  threadTs: "thread-ts",
  channelId: "channel-id",
  messageTs: "message-ts",
} as const;
