export const FILE_MENTION_SCHEME = "paperclip-file://";

export interface ParsedFileMention {
  workspaceId: string;
  filePath: string;
}

export function buildFileMentionHref(workspaceId: string, filePath: string): string {
  return `${FILE_MENTION_SCHEME}${encodeURIComponent(workspaceId)}/${filePath}`;
}

export function parseFileMentionHref(href: string): ParsedFileMention | null {
  if (!href.startsWith(FILE_MENTION_SCHEME)) return null;
  const rest = href.slice(FILE_MENTION_SCHEME.length);
  const slashIdx = rest.indexOf("/");
  if (slashIdx <= 0) return null;
  const workspaceId = decodeURIComponent(rest.slice(0, slashIdx));
  const filePath = rest.slice(slashIdx + 1);
  if (!workspaceId || !filePath) return null;
  return { workspaceId, filePath };
}
