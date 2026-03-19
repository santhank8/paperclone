import type { IssueWorkProduct } from "@paperclipai/shared";
import { GitPullRequest } from "lucide-react";
import { extractPrNumber } from "../lib/pr-utils";
import { cn } from "../lib/utils";

function statusStyle(status: string): string {
  switch (status) {
    case "merged":
      return "bg-purple-500/15 border-purple-500/30 text-purple-600 dark:text-purple-400";
    case "active":
    case "ready_for_review":
    case "draft":
    case "approved":
      return "bg-violet-500/10 border-violet-500/30 text-violet-600 dark:text-violet-400";
    case "closed":
    case "failed":
    case "changes_requested":
    case "archived":
      return "bg-muted border-border text-muted-foreground";
    default:
      return "bg-violet-500/10 border-violet-500/30 text-violet-600 dark:text-violet-400";
  }
}

interface PrBadgeProps {
  workProducts: IssueWorkProduct[] | undefined;
  className?: string;
}

export function PrBadge({ workProducts, className }: PrBadgeProps) {
  const prs = (workProducts ?? []).filter((wp) => wp.type === "pull_request");
  if (prs.length === 0) return null;

  const primary = prs.find((pr) => pr.isPrimary) ?? prs[0];
  const prNumber = extractPrNumber(primary);
  const label = prNumber ? `PR #${prNumber}` : primary.title.slice(0, 20);
  const rest = prs.length - 1;

  const badge = (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium shrink-0",
        statusStyle(primary.status),
        className,
      )}
    >
      <GitPullRequest className="h-3 w-3" />
      {label}
      {rest > 0 && (
        <span className="text-current opacity-60">+{rest}</span>
      )}
    </span>
  );

  if (primary.url) {
    return (
      <a
        href={primary.url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex no-underline"
        onClick={(e) => e.stopPropagation()}
        title={primary.title}
      >
        {badge}
      </a>
    );
  }

  return badge;
}
