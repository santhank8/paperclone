export interface UnifiedScheduledJob {
  id: string;
  name: string;
  source: "openclaw" | "paperclip";
  enabled: boolean;
  cronExpr: string;
  scheduleText: string;
  agentId?: string;
  agentName?: string;
  lastRunAt?: number;
  nextRunAt?: number;
  lastStatus?: "success" | "error" | "running";
  lastError?: string;
  // OpenClaw-specific
  command?: string;
  fullPrompt?: string;
  model?: string;
  timezone?: string;
  payloadKind?: string;
  sessionTarget?: string;
  wakeMode?: string;
  deliveryMode?: string;
  lastDurationMs?: number;
  createdAt?: number;
  updatedAt?: number;
  // Paperclip-specific
  issueId?: string;
  issueIdentifier?: string;
  issueStatus?: string;
  priority?: string;
  projectName?: string;
  spawnCount?: number;
}

export interface RunHistoryEntry {
  jobId: string;
  status: string;
  deliveryStatus?: string;
  timestamp?: number;
  startedAtMs?: number;
  durationMs?: number;
  error?: string;
}
