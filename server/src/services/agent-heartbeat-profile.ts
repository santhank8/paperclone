import type { AgentRole, CompanyRuntimePolicy } from "@paperclipai/shared";

const DEFAULT_HEARTBEAT_INTERVALS_BY_ROLE: Record<AgentRole, number> = {
  ceo: 120,
  cto: 120,
  cmo: 300,
  cfo: 300,
  engineer: 240,
  designer: 300,
  pm: 240,
  qa: 180,
  devops: 180,
  researcher: 300,
  general: 300,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function isValidIntervalSec(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 30 && value <= 86_400;
}

function companyIntervalOverrideForRole(
  role: AgentRole | string | null | undefined,
  companyRuntimePolicy?: CompanyRuntimePolicy | null,
): number | null {
  if (!role) return null;
  const intervalsByRole = companyRuntimePolicy?.heartbeat?.intervalsByRole;
  if (!intervalsByRole) return null;
  const candidate = intervalsByRole[role as AgentRole];
  return isValidIntervalSec(candidate) ? candidate : null;
}

export function defaultHeartbeatIntervalSecForRole(
  role: AgentRole | string | null | undefined,
  companyRuntimePolicy?: CompanyRuntimePolicy | null,
): number {
  const override = companyIntervalOverrideForRole(role, companyRuntimePolicy);
  if (override !== null) return override;
  if (!role) return DEFAULT_HEARTBEAT_INTERVALS_BY_ROLE.general;
  if (role in DEFAULT_HEARTBEAT_INTERVALS_BY_ROLE) {
    return DEFAULT_HEARTBEAT_INTERVALS_BY_ROLE[role as AgentRole];
  }
  return DEFAULT_HEARTBEAT_INTERVALS_BY_ROLE.general;
}

export function applyAgentHeartbeatProfileDefaults(
  role: AgentRole | string | null | undefined,
  runtimeConfig: unknown,
  companyRuntimePolicy?: CompanyRuntimePolicy | null,
): Record<string, unknown> {
  const nextRuntimeConfig = { ...(asRecord(runtimeConfig) ?? {}) };
  const nextHeartbeat = { ...(asRecord(nextRuntimeConfig.heartbeat) ?? {}) };

  if (typeof nextHeartbeat.enabled !== "boolean") nextHeartbeat.enabled = true;
  if (typeof nextHeartbeat.cooldownSec !== "number") nextHeartbeat.cooldownSec = 10;
  if (!isValidIntervalSec(nextHeartbeat.intervalSec)) {
    nextHeartbeat.intervalSec = defaultHeartbeatIntervalSecForRole(role, companyRuntimePolicy);
  }
  if (typeof nextHeartbeat.wakeOnDemand !== "boolean") nextHeartbeat.wakeOnDemand = true;
  if (typeof nextHeartbeat.maxConcurrentRuns !== "number" || !Number.isFinite(nextHeartbeat.maxConcurrentRuns) || nextHeartbeat.maxConcurrentRuns <= 0) {
    nextHeartbeat.maxConcurrentRuns = 1;
  }

  nextRuntimeConfig.heartbeat = nextHeartbeat;
  return nextRuntimeConfig;
}

export function applyCompanyHeartbeatPolicyToRuntimeConfig(
  role: AgentRole | string | null | undefined,
  runtimeConfig: unknown,
  companyRuntimePolicy?: CompanyRuntimePolicy | null,
): Record<string, unknown> {
  const nextRuntimeConfig = applyAgentHeartbeatProfileDefaults(role, runtimeConfig, companyRuntimePolicy);
  const nextHeartbeat = { ...(asRecord(nextRuntimeConfig.heartbeat) ?? {}) };
  nextHeartbeat.intervalSec = defaultHeartbeatIntervalSecForRole(role, companyRuntimePolicy);
  nextRuntimeConfig.heartbeat = nextHeartbeat;
  return nextRuntimeConfig;
}
