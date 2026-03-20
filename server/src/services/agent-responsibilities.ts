import {
  agentResponsibilitySchema,
  type AgentResponsibility,
} from "@paperclipai/shared";

export function normalizeAgentResponsibilities(value: unknown): AgentResponsibility[] {
  if (!Array.isArray(value)) return [];
  const normalized: AgentResponsibility[] = [];
  for (const raw of value) {
    const parsed = agentResponsibilitySchema.safeParse(raw);
    if (parsed.success) {
      normalized.push(parsed.data);
    }
  }
  return normalized;
}

export function listEnabledAgentResponsibilities(value: unknown): AgentResponsibility[] {
  return normalizeAgentResponsibilities(value).filter((entry) => entry.enabled);
}
