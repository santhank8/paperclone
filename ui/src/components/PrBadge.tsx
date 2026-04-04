import type { IssueWorkProduct } from "@paperclipai/shared";
import { GitPullRequest } from "lucide-react";
import { extractPrNumber } from "../lib/pr-utils";
import { cn } from "../lib/utils";

interface PrBadgeProps {
  workProducts: IssueWorkProduct[] | undefined;
  className?: string;
}

export function PrBadge({ workProducts, className }: PrBadgeProps) {
  const prs = (workProducts ?? []).filter((wp) => wp.type === "pull_request");
  if (prs.length === 0) return null;

  const primary = prs.find((pr) => pr.isPrimary) ?? prs[0];
  const prNumber = extractPrNumber(primary);
  const label = prNumber ? `#${prNumber}` : primary.title.slice(0, 20);
  const rest = prs.length - 1;

  const content = (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs text-muted-foreground shrink-0",
        className,
      )}
    >
      <GitPullRequest className="h-3 w-3" />
      {label}
      {rest > 0 && (
        <span className="opacity-60">+{rest}</span>
      )}
    </span>
  );

  if (primary.url) {
    return (
      <a
        href={primary.url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex no-underline hover:text-foreground transition-colors"
        onClick={(e) => e.stopPropagation()}
        title={primary.title}
      >
        {content}
      </a>
    );
  }

  return content;
}
