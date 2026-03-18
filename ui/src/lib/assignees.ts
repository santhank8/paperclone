export interface AssigneeSelection {
  assigneeAgentId: string | null;
  assigneeUserId: string | null;
}

export interface AssigneeOption {
  id: string;
  label: string;
  searchText?: string;
}

export function assigneeValueFromSelection(selection: Partial<AssigneeSelection>): string {
  if (selection.assigneeAgentId) return `agent:${selection.assigneeAgentId}`;
  if (selection.assigneeUserId) return `user:${selection.assigneeUserId}`;
  return "";
}

export function parseAssigneeValue(value: string): AssigneeSelection {
  if (!value) {
    return { assigneeAgentId: null, assigneeUserId: null };
  }
  if (value.startsWith("agent:")) {
    const assigneeAgentId = value.slice("agent:".length);
    return { assigneeAgentId: assigneeAgentId || null, assigneeUserId: null };
  }
  if (value.startsWith("user:")) {
    const assigneeUserId = value.slice("user:".length);
    return { assigneeAgentId: null, assigneeUserId: assigneeUserId || null };
  }
  // Backward compatibility for older drafts/defaults that stored a raw agent id.
  return { assigneeAgentId: value, assigneeUserId: null };
}

export function currentUserAssigneeOption(currentUserId: string | null | undefined): AssigneeOption[] {
  if (!currentUserId) return [];
  return [{
    id: assigneeValueFromSelection({ assigneeUserId: currentUserId }),
    label: "Me",
    searchText: currentUserId === "local-board" ? "me board human local-board" : `me human ${currentUserId}`,
  }];
}

export function humanMemberAssigneeOptions(
  members: Array<{ id: string; name: string | null; email: string | null }>,
  currentUserId: string | null | undefined,
): AssigneeOption[] {
  return members
    .filter((m) => m.id !== currentUserId)
    .map((m) => ({
      id: assigneeValueFromSelection({ assigneeUserId: m.id }),
      label: m.name ?? m.email ?? m.id.slice(0, 8),
      searchText: `${m.name ?? ""} ${m.email ?? ""} human`,
    }));
}

export function formatAssigneeUserLabel(
  userId: string | null | undefined,
  currentUserId: string | null | undefined,
  members?: Array<{ id: string; name: string | null; email: string | null }>,
): string | null {
  if (!userId) return null;
  if (currentUserId && userId === currentUserId) return "Me";
  if (userId === "local-board") return "Board";
  const member = members?.find((m) => m.id === userId);
  if (member) return member.name ?? member.email ?? userId.slice(0, 5);
  return userId.slice(0, 5);
}
