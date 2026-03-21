import { useMemo, useState } from "react";
import { NavLink, useLocation } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Plus } from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { useSidebar } from "../context/SidebarContext";
import { agentsApi } from "../api/agents";
import { heartbeatsApi } from "../api/heartbeats";
import { queryKeys } from "../lib/queryKeys";
import { cn, agentRouteRef, agentUrl } from "../lib/utils";
import { AgentIcon } from "./AgentIconPicker";
import { BudgetSidebarMarker } from "./BudgetSidebarMarker";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { Agent } from "@paperclipai/shared";

/* ---- Tree data structure ---- */

interface AgentTreeNode {
  agent: Agent;
  children: AgentTreeNode[];
}

/** Build a hierarchical tree from a flat list of agents using `reportsTo`. */
function buildAgentTree(agents: Agent[]): AgentTreeNode[] {
  const byId = new Map(agents.map((a) => [a.id, a]));
  const childrenOf = new Map<string | null, Agent[]>();
  for (const a of agents) {
    const parent = a.reportsTo && byId.has(a.reportsTo) ? a.reportsTo : null;
    const list = childrenOf.get(parent) ?? [];
    list.push(a);
    childrenOf.set(parent, list);
  }

  function buildNode(agent: Agent): AgentTreeNode {
    const children = (childrenOf.get(agent.id) ?? []).map(buildNode);
    return { agent, children };
  }

  return (childrenOf.get(null) ?? []).map(buildNode);
}

/** Walk the tree to aggregate live run counts from all descendants. */
function aggregateLiveCounts(
  nodes: AgentTreeNode[],
  directCounts: Map<string, number>,
): Map<string, number> {
  const aggregated = new Map<string, number>();

  function walk(node: AgentTreeNode): number {
    let total = directCounts.get(node.agent.id) ?? 0;
    for (const child of node.children) {
      total += walk(child);
    }
    aggregated.set(node.agent.id, total);
    return total;
  }

  for (const root of nodes) walk(root);
  return aggregated;
}

/* ---- Recursive tree item ---- */

function AgentTreeItem({
  node,
  depth,
  activeAgentId,
  liveCountByAgent,
  aggregatedLiveCounts,
  isMobile,
  setSidebarOpen,
}: {
  node: AgentTreeNode;
  depth: number;
  activeAgentId: string | null;
  liveCountByAgent: Map<string, number>;
  aggregatedLiveCounts: Map<string, number>;
  isMobile: boolean;
  setSidebarOpen: (open: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const { agent } = node;
  const directCount = liveCountByAgent.get(agent.id) ?? 0;
  const aggregatedCount = aggregatedLiveCounts.get(agent.id) ?? 0;
  const hasChildren = node.children.length > 0;
  // Cap visual indentation at 3 levels to prevent overflow in narrow sidebar
  const visualDepth = Math.min(depth, 3);

  return (
    <div>
      <div
        className="flex items-center"
        style={{ paddingLeft: `${12 + visualDepth * 14}px` }}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="flex items-center justify-center h-4 w-4 shrink-0 mr-0.5 rounded hover:bg-accent/50 transition-colors"
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            <ChevronRight
              className={cn(
                "h-2.5 w-2.5 text-muted-foreground/60 transition-transform duration-150",
                expanded && "rotate-90"
              )}
            />
          </button>
        ) : (
          <span className="w-4 mr-0.5 shrink-0" />
        )}
        <NavLink
          to={agentUrl(agent)}
          onClick={() => {
            if (isMobile) setSidebarOpen(false);
          }}
          className={cn(
            "flex items-center gap-2 flex-1 min-w-0 py-1.5 pr-3 text-[13px] font-medium transition-colors rounded-sm",
            activeAgentId === agentRouteRef(agent)
              ? "bg-accent text-foreground"
              : "text-foreground/80 hover:bg-accent/50 hover:text-foreground"
          )}
        >
          <AgentIcon icon={agent.icon} className="shrink-0 h-3.5 w-3.5 text-muted-foreground" />
          <span className="flex-1 truncate">{agent.name}</span>
          {(agent.pauseReason === "budget" || directCount > 0 || (!expanded && aggregatedCount > 0)) && (
            <span className="ml-auto flex items-center gap-1.5 shrink-0">
              {agent.pauseReason === "budget" && (
                <BudgetSidebarMarker title="Agent paused by budget" />
              )}
              {directCount > 0 ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" />
                  </span>
                  <span className="text-[11px] font-medium text-cyan-600 dark:text-cyan-400">
                    {directCount} live
                  </span>
                </>
              ) : !expanded && aggregatedCount > 0 ? (
                <span className="text-[11px] font-medium text-cyan-600/60 dark:text-cyan-400/60">
                  {aggregatedCount} active
                </span>
              ) : null}
            </span>
          )}
        </NavLink>
      </div>
      {hasChildren && expanded && (
        <div>
          {node.children.map((child) => (
            <AgentTreeItem
              key={child.agent.id}
              node={child}
              depth={depth + 1}
              activeAgentId={activeAgentId}
              liveCountByAgent={liveCountByAgent}
              aggregatedLiveCounts={aggregatedLiveCounts}
              isMobile={isMobile}
              setSidebarOpen={setSidebarOpen}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---- Main sidebar section ---- */

export function SidebarAgents() {
  const [open, setOpen] = useState(true);
  const { selectedCompanyId } = useCompany();
  const { openNewAgent } = useDialog();
  const { isMobile, setSidebarOpen } = useSidebar();
  const location = useLocation();

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: liveRuns } = useQuery({
    queryKey: queryKeys.liveRuns(selectedCompanyId!),
    queryFn: () => heartbeatsApi.liveRunsForCompany(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 10_000,
  });

  const liveCountByAgent = useMemo(() => {
    const counts = new Map<string, number>();
    for (const run of liveRuns ?? []) {
      counts.set(run.agentId, (counts.get(run.agentId) ?? 0) + 1);
    }
    return counts;
  }, [liveRuns]);

  const agentTree = useMemo(() => {
    const filtered = (agents ?? []).filter(
      (a: Agent) => a.status !== "terminated"
    );
    return buildAgentTree(filtered);
  }, [agents]);

  const aggregatedLiveCounts = useMemo(
    () => aggregateLiveCounts(agentTree, liveCountByAgent),
    [agentTree, liveCountByAgent],
  );

  const agentMatch = location.pathname.match(/^\/(?:[^/]+\/)?agents\/([^/]+)/);
  const activeAgentId = agentMatch?.[1] ?? null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="group">
        <div className="flex items-center px-3 py-1.5">
          <CollapsibleTrigger className="flex items-center gap-1 flex-1 min-w-0">
            <ChevronRight
              className={cn(
                "h-3 w-3 text-muted-foreground/60 transition-transform opacity-0 group-hover:opacity-100",
                open && "rotate-90"
              )}
            />
            <span className="text-[10px] font-medium uppercase tracking-widest font-mono text-muted-foreground/60">
              Agents
            </span>
          </CollapsibleTrigger>
          <button
            onClick={(e) => {
              e.stopPropagation();
              openNewAgent();
            }}
            className="flex items-center justify-center h-4 w-4 rounded text-muted-foreground/60 hover:text-foreground hover:bg-accent/50 transition-colors"
            aria-label="New agent"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </div>

      <CollapsibleContent>
        <div className="flex flex-col gap-0.5 mt-0.5">
          {agentTree.map((node) => (
            <AgentTreeItem
              key={node.agent.id}
              node={node}
              depth={0}
              activeAgentId={activeAgentId}
              liveCountByAgent={liveCountByAgent}
              aggregatedLiveCounts={aggregatedLiveCounts}
              isMobile={isMobile}
              setSidebarOpen={setSidebarOpen}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
