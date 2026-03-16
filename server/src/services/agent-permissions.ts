export type NormalizedAgentPermissions = Record<string, unknown> & {
  canCreateAgents: boolean;
  canManageTasks: boolean;
};

export function defaultPermissionsForRole(role: string): NormalizedAgentPermissions {
  return {
    canCreateAgents: role === "ceo",
    canManageTasks: role === "ceo",
  };
}

export function normalizeAgentPermissions(
  permissions: unknown,
  role: string,
): NormalizedAgentPermissions {
  const defaults = defaultPermissionsForRole(role);
  if (typeof permissions !== "object" || permissions === null || Array.isArray(permissions)) {
    return defaults;
  }

  const record = permissions as Record<string, unknown>;
  return {
    canCreateAgents:
      typeof record.canCreateAgents === "boolean"
        ? record.canCreateAgents
        : defaults.canCreateAgents,
    canManageTasks:
      typeof record.canManageTasks === "boolean"
        ? record.canManageTasks
        : defaults.canManageTasks,
  };
}

export function mergeAgentPermissions(
  existingPermissions: unknown,
  patch: { canCreateAgents: boolean; canManageTasks?: boolean },
  role: string,
): NormalizedAgentPermissions {
  const existing = normalizeAgentPermissions(existingPermissions, role);
  return normalizeAgentPermissions(
    {
      ...existing,
      canCreateAgents: patch.canCreateAgents,
      ...(typeof patch.canManageTasks === "boolean" ? { canManageTasks: patch.canManageTasks } : {}),
    },
    role,
  );
}
