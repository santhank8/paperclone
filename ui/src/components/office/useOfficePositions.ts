import { useMemo } from "react";
import type { Agent, OfficeConfig, OfficeAgentPosition, OfficeMovementRule } from "@paperclipai/shared";

/**
 * Evaluate movement rules and compute agent positions within office areas.
 * Rules are evaluated in priority order (highest first). First match wins.
 */
export function useOfficePositions(
  agents: Agent[],
  config: OfficeConfig,
): OfficeAgentPosition[] {
  return useMemo(() => {
    const sortedRules = [...config.movementRules].sort((a, b) => b.priority - a.priority);
    const areaAgentCounts = new Map<string, number>();

    return agents.map((agent) => {
      const targetAreaId = resolveArea(agent, sortedRules, config.defaultAreaId);
      const area = config.areas.find((a) => a.id === targetAreaId) ?? config.areas[0];
      if (!area) {
        return { agentId: agent.id, areaId: targetAreaId, x: 0, y: 0 };
      }

      const index = areaAgentCounts.get(area.id) ?? 0;
      areaAgentCounts.set(area.id, index + 1);

      // Grid layout within area with padding
      const padding = 20;
      const avatarSize = 56;
      const cols = Math.max(1, Math.floor((area.width - padding * 2) / (avatarSize + 12)));
      const row = Math.floor(index / cols);
      const col = index % cols;

      // Slight hash-based offset for organic feel
      const hash = simpleHash(agent.id);
      const offsetX = (hash % 7) - 3;
      const offsetY = ((hash >> 4) % 7) - 3;

      return {
        agentId: agent.id,
        areaId: area.id,
        x: area.x + padding + col * (avatarSize + 12) + offsetX,
        y: area.y + 36 + padding + row * (avatarSize + 16) + offsetY,
      };
    });
  }, [agents, config]);
}

function resolveArea(
  agent: Agent,
  rules: OfficeMovementRule[],
  defaultAreaId: string,
): string {
  for (const rule of rules) {
    if (matchesCondition(agent, rule.condition)) {
      return rule.targetAreaId;
    }
  }
  return defaultAreaId;
}

function matchesCondition(
  agent: Agent,
  condition: OfficeMovementRule["condition"],
): boolean {
  const checks: boolean[] = [];

  if (condition.status?.length) {
    checks.push(condition.status.includes(agent.status));
  }
  if (condition.role?.length) {
    checks.push(condition.role.includes(agent.role));
  }
  if (condition.adapterType?.length) {
    checks.push(condition.adapterType.includes(agent.adapterType));
  }

  // All specified conditions must match (AND logic)
  return checks.length > 0 && checks.every(Boolean);
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}
