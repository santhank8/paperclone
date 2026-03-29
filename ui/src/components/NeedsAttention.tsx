import { useMemo } from "react";
import { Link } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { heartbeatsApi, type FailedRunForIssue } from "../api/heartbeats";
import { issuesApi } from "../api/issues";
import { agentsApi } from "../api/agents";
import { queryKeys } from "../lib/queryKeys";
import { cn, relativeTime, issueUrl } from "../lib/utils";
import { StatusIcon } from "./StatusIcon";
import { PriorityIcon } from "./PriorityIcon";
import { Identity } from "./Identity";
import {
  AlertTriangle,
  XCircle,
  ShieldCheck,
  ArrowRight,
  OctagonAlert,
} from "lucide-react";
import type { Agent, Issue } from "@paperclipai/shared";

interface NeedsAttentionProps {
  companyId: string;
}

interface AttentionItem {
  id: string;
  kind: "blocked" | "failed_run" | "approval";
  title: string;
  subtitle: string;
  href: string;
  priority?: string;
  time: string;
  agentName?: string;
}

const KIND_CONFIG = {
  blocked: {
    icon: OctagonAlert,
    accent: "text-red-500",
    bg: "bg-red-500/8",
    border: "border-red-500/20",
    label: "Blocked",
  },
  failed_run: {
    icon: XCircle,
    accent: "text-red-500",
    bg: "bg-red-500/8",
    border: "border-red-500/20",
    label: "Failed",
  },
  approval: {
    icon: ShieldCheck,
    accent: "text-primary",
    bg: "bg-primary/8",
    border: "border-primary/20",
    label: "Approval",
  },
} as const;

export function NeedsAttention({ companyId }: NeedsAttentionProps) {
  const { data: issues } = useQuery({
    queryKey: queryKeys.issues.list(companyId),
    queryFn: () => issuesApi.list(companyId),
    enabled: !!companyId,
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(companyId),
    queryFn: () => agentsApi.list(companyId),
    enabled: !!companyId,
  });

  const { data: failedRuns } = useQuery({
    queryKey: queryKeys.failedRuns(companyId),
    queryFn: () => heartbeatsApi.failedRunsForCompany(companyId),
    enabled: !!companyId,
  });

  const agentMap = useMemo(() => {
    const map = new Map<string, Agent>();
    for (const a of agents ?? []) map.set(a.id, a);
    return map;
  }, [agents]);

  const items = useMemo<AttentionItem[]>(() => {
    const result: AttentionItem[] = [];

    // Blocked issues
    for (const issue of issues ?? []) {
      if (issue.status !== "blocked") continue;
      const agent = issue.assigneeAgentId
        ? agentMap.get(issue.assigneeAgentId)
        : null;
      result.push({
        id: `blocked-${issue.id}`,
        kind: "blocked",
        title: issue.title,
        subtitle: issue.identifier ?? issue.id.slice(0, 8),
        href: `/issues/${issueUrl(issue)}`,
        priority: issue.priority,
        time: relativeTime(issue.updatedAt),
        agentName: agent?.name,
      });
    }

    // Failed runs (last 24h, deduplicate by agent)
    const seenAgents = new Set<string>();
    for (const run of failedRuns ?? []) {
      if (seenAgents.has(run.agentId)) continue;
      seenAgents.add(run.agentId);
      result.push({
        id: `failed-${run.id}`,
        kind: "failed_run",
        title: run.error?.slice(0, 120) ?? "Run failed",
        subtitle: run.agentName,
        href: `/runs/${run.id}`,
        time: relativeTime(run.finishedAt ?? run.createdAt),
        agentName: run.agentName,
      });
    }

    // Pending approval issues
    for (const issue of issues ?? []) {
      if (issue.status !== "todo" && issue.status !== "backlog") continue;
      // Issues with agents in pending_approval status
      if (issue.assigneeAgentId) {
        const agent = agentMap.get(issue.assigneeAgentId);
        if (agent?.status === "pending_approval") {
          result.push({
            id: `approval-${issue.id}`,
            kind: "approval",
            title: `${agent.name} pending hire approval`,
            subtitle: issue.identifier ?? issue.id.slice(0, 8),
            href: "/approvals",
            priority: issue.priority,
            time: relativeTime(issue.updatedAt),
            agentName: agent.name,
          });
        }
      }
    }

    // Sort: blocked first, then failed, then approvals; within each group by time
    result.sort((a, b) => {
      const kindOrder = { blocked: 0, failed_run: 1, approval: 2 };
      return kindOrder[a.kind] - kindOrder[b.kind];
    });

    return result.slice(0, 8);
  }, [issues, failedRuns, agentMap]);

  if (items.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Needs Attention
        </h3>
        <span className="text-xs font-mono text-primary bg-primary/10 px-1.5 py-0.5">
          {items.length}
        </span>
      </div>
      <div className="grid gap-1">
        {items.map((item) => {
          const config = KIND_CONFIG[item.kind];
          const Icon = config.icon;
          return (
            <Link
              key={item.id}
              to={item.href}
              className={cn(
                "group flex items-center gap-3 px-3 py-2.5",
                "border border-border hover:border-border/80",
                "bg-card hover:bg-accent/30 transition-colors",
                "no-underline text-inherit",
              )}
            >
              <span className={cn("shrink-0", config.accent)}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-2">
                  <span className={cn("text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5", config.bg, config.accent)}>
                    {config.label}
                  </span>
                  {item.priority && <PriorityIcon priority={item.priority} />}
                  <span className="text-xs font-mono text-muted-foreground">
                    {item.subtitle}
                  </span>
                </span>
                <span className="text-sm truncate block mt-0.5">
                  {item.title}
                </span>
              </span>
              {item.agentName && (
                <span className="hidden sm:inline-flex shrink-0">
                  <Identity name={item.agentName} size="xs" />
                </span>
              )}
              <span className="text-xs text-muted-foreground shrink-0">
                {item.time}
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-foreground transition-colors shrink-0" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
