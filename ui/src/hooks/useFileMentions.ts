import { useQuery } from "@tanstack/react-query";
import { filesApi } from "../api/files";
import type { MentionOption } from "../components/MarkdownEditor";
import { useMemo } from "react";

/** "gtm-strategy/HISPANIC_MARKET_GTM.md" → "Hispanic Market GTM" */
function friendlyFileName(filePath: string): string {
  const basename = filePath.split("/").pop() || filePath;
  const withoutExt = basename.replace(/\.[^.]+$/, "");
  return withoutExt
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

async function fetchAllFileMentions(): Promise<MentionOption[]> {
  const workspaces = await filesApi.listWorkspaces();
  const projectWorkspaces = workspaces.filter((w) => w.source === "project");
  const options: MentionOption[] = [];

  await Promise.all(
    projectWorkspaces.map(async (ws) => {
      try {
        const files = await filesApi.listFiles(ws.id);
        for (const file of files) {
          if (file.type !== "file") continue;
          options.push({
            id: `file:${ws.id}/${file.path}`,
            name: `${friendlyFileName(file.path)} (${ws.label})`,
            kind: "file",
            fileWorkspaceId: ws.id,
            filePath: file.path,
          });
        }
      } catch {
        // workspace not accessible, skip
      }
    }),
  );

  return options;
}

export function useFileMentions(): MentionOption[] {
  const { data } = useQuery({
    queryKey: ["files", "mentions"],
    queryFn: fetchAllFileMentions,
    staleTime: 5 * 60 * 1000,
  });

  return useMemo(() => data ?? [], [data]);
}
