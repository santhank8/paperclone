import { useMemo } from "react";
import { Link } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { agentsApi, type OrgNode } from "../api/agents";
import { queryKeys } from "../lib/queryKeys";
import { cn, agentUrl } from "../lib/utils";
import { Network } from "lucide-react";

interface MiniOrgChartProps {
  companyId: string;
}

const STATUS_DOT: Record<string, string> = {
  running: "bg-primary animate-pulse-amber",
  active: "bg-green-400",
  idle: "bg-yellow-400",
  paused: "bg-yellow-400",
  error: "bg-red-400",
  pending_approval: "bg-violet-400",
  terminated: "bg-neutral-500",
};

function AgentNode({ node, depth }: { node: OrgNode; depth: number }) {
  const dotColor = STATUS_DOT[node.status] ?? "bg-muted-foreground";
  return (
    <div>
      <Link
        to={agentUrl(node as any)}
        className={cn(
          "flex items-center gap-2 py-1 px-2 -mx-2",
          "hover:bg-accent/40 transition-colors no-underline text-inherit",
          depth > 0 && "ml-4",
        )}
      >
        {/* Connector line for children */}
        {depth > 0 && (
          <span className="w-2 border-t border-border shrink-0" />
        )}
        <span className={cn("h-2 w-2 rounded-full shrink-0", dotColor)} />
        <span className="text-sm truncate">{node.name}</span>
        <span className="text-[10px] text-muted-foreground font-mono truncate ml-auto">
          {node.role}
        </span>
      </Link>
      {node.reports.length > 0 && (
        <div className="border-l border-border/50 ml-3">
          {node.reports.map((child) => (
            <AgentNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function MiniOrgChart({ companyId }: MiniOrgChartProps) {
  const { data: org } = useQuery({
    queryKey: queryKeys.org(companyId),
    queryFn: () => agentsApi.org(companyId),
    enabled: !!companyId,
  });

  const roots = useMemo(() => {
    if (!org) return [];
    // org may be an array or single root
    return Array.isArray(org) ? org : [org];
  }, [org]);

  if (roots.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Org Chart
          </h3>
        </div>
        <Link
          to="/org"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors no-underline"
        >
          Full view &rarr;
        </Link>
      </div>
      <div className="border border-border overflow-hidden">
        <div className="p-3 max-h-[320px] overflow-y-auto">
          {roots.map((root) => (
            <AgentNode key={root.id} node={root} depth={0} />
          ))}
        </div>
        {/* Status legend */}
        <div className="border-t border-border px-3 py-2 flex flex-wrap gap-x-4 gap-y-1">
          {[
            { label: "Running", color: "bg-primary" },
            { label: "Active", color: "bg-green-400" },
            { label: "Idle", color: "bg-yellow-400" },
            { label: "Error", color: "bg-red-400" },
          ].map((s) => (
            <span key={s.label} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span className={cn("h-1.5 w-1.5 rounded-full", s.color)} />
              {s.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
