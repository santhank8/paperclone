import type { CompanyAssignableUser } from "@paperclipai/shared";

export interface AssigneeSelection {
  assigneeAgentId: string | null;
  assigneeUserId: string | null;
}

export interface AssigneeOption {
  id: string;
  label: string;
  searchText?: string;
}

interface CommentAssigneeSuggestionInput {
  assigneeAgentId?: string | null;
  assigneeUserId?: string | null;
}

interface CommentAssigneeSuggestionComment {
  authorAgentId?: string | null;
  authorUserId?: string | null;
}

type AssigneeUserIdentity = Pick<CompanyAssignableUser, "userId" | "name" | "email">;
export type AssigneeUserDirectory = Map<string, Pick<CompanyAssignableUser, "name" | "email">>;

export function assigneeValueFromSelection(selection: Partial<AssigneeSelection>): string {
  if (selection.assigneeAgentId) return `agent:${selection.assigneeAgentId}`;
  if (selection.assigneeUserId) return `user:${selection.assigneeUserId}`;
  return "";
}

export function suggestedCommentAssigneeValue(
  issue: CommentAssigneeSuggestionInput,
  comments: CommentAssigneeSuggestionComment[] | null | undefined,
  currentUserId: string | null | undefined,
  currentAgentId?: string | null | undefined,
): string {
  if (comments && comments.length > 0 && (currentUserId || currentAgentId)) {
    for (let i = comments.length - 1; i >= 0; i--) {
      const comment = comments[i];
      if (comment.authorAgentId && comment.authorAgentId !== currentAgentId) {
        return assigneeValueFromSelection({ assigneeAgentId: comment.authorAgentId });
      }
      if (comment.authorUserId && comment.authorUserId !== currentUserId) {
        return assigneeValueFromSelection({ assigneeUserId: comment.authorUserId });
      }
    }
  }

  return assigneeValueFromSelection(issue);
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

function conciseAssignableUserLabel(user: Pick<CompanyAssignableUser, "name" | "email">): string {
  const name = user.name.trim();
  const email = user.email.trim();
  if (name && email && name.toLowerCase() !== email.toLowerCase()) {
    return `${name} (${email})`;
  }
  return name || email;
}

function displayAssignableUserLabel(user: Pick<CompanyAssignableUser, "name" | "email">): string | null {
  const name = user.name.trim();
  const email = user.email.trim();
  return name || email || null;
}

export function createAssigneeUserDirectory(users: AssigneeUserIdentity[]): AssigneeUserDirectory {
  return new Map(
    users.map((user) => [
      user.userId,
      {
        name: user.name,
        email: user.email,
      },
    ]),
  );
}

export function companyUserAssigneeOptions(
  users: AssigneeUserIdentity[],
  currentUserId: string | null | undefined,
): AssigneeOption[] {
  return users
    .filter((user) => user.userId !== currentUserId)
    .map((user) => ({
      id: assigneeValueFromSelection({ assigneeUserId: user.userId }),
      label: conciseAssignableUserLabel(user),
      searchText: `${user.name} ${user.email} human ${user.userId}`.trim(),
    }));
}

export function formatAssigneeUserLabel(
  userId: string | null | undefined,
  currentUserId: string | null | undefined,
  usersById?: AssigneeUserDirectory | null,
): string | null {
  if (!userId) return null;
  if (currentUserId && userId === currentUserId) return "Me";
  if (userId === "local-board") return "Board";
  const knownUser = usersById?.get(userId);
  const knownLabel = knownUser ? displayAssignableUserLabel(knownUser) : null;
  if (knownLabel) return knownLabel;
  return userId.slice(0, 5);
}
