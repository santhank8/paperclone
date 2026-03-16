import type { ProjectWorkspace } from "@paperclipai/shared";

export function hasWorkspaceLocalFolder(workspace: ProjectWorkspace | null | undefined) {
  return Boolean(workspace?.cwd && workspace.cwd !== "/__paperclip_repo_only__");
}

export function getWorkspaceHealthLabel(workspace: ProjectWorkspace | null | undefined) {
  if (!workspace) return "No workspace";
  if (!hasWorkspaceLocalFolder(workspace)) {
    return workspace.repoUrl ? "Repo only" : "No local folder";
  }
  const health = workspace.health;
  if (!health?.cwdExists) return "Path missing";
  if (!health.cwdIsDirectory) return "Not a folder";
  if (health.gitRepo === false) return "Not a git repo";
  if (health.gitRepo === true) return "Ready";
  return "Local folder";
}

export function getWorkspaceHealthTone(workspace: ProjectWorkspace | null | undefined) {
  if (!workspace) return "warning" as const;
  if (!hasWorkspaceLocalFolder(workspace)) return workspace.repoUrl ? "muted" as const : "warning" as const;
  const health = workspace.health;
  if (!health?.cwdExists || !health.cwdIsDirectory || health.gitRepo === false) return "warning" as const;
  if (health.gitRepo === true) return "healthy" as const;
  return "muted" as const;
}

export function getWorkspaceExecutionWarning(workspace: ProjectWorkspace | null | undefined) {
  if (!workspace) return "No primary workspace configured for execution.";
  if (!hasWorkspaceLocalFolder(workspace)) {
    return workspace.repoUrl
      ? "Primary workspace has a repo reference but no local folder, so execution may fall back to the agent home."
      : "Primary workspace has no local folder, so execution may fall back to the agent home.";
  }
  const health = workspace.health;
  if (!health?.cwdExists) return "Primary workspace local folder does not exist on disk.";
  if (!health.cwdIsDirectory) return "Primary workspace path exists but is not a directory.";
  if (health.gitRepo === false) return "Primary workspace local folder is not a git repo.";
  return null;
}

export function getWorkspaceDisplayTarget(workspace: ProjectWorkspace | null | undefined) {
  if (!workspace) return "No workspace configured";
  if (hasWorkspaceLocalFolder(workspace)) return workspace.cwd!;
  if (workspace.repoUrl) return workspace.repoUrl;
  return workspace.name;
}
