import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { agentsApi } from "../api/agents";
import { officeApi } from "../api/office";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { OfficeAreaRect } from "../components/office/OfficeArea";
import { OfficeAgentAvatar } from "../components/office/OfficeAgent";
import { OfficeConfigPanel } from "../components/office/OfficeConfigPanel";
import { useOfficePositions } from "../components/office/useOfficePositions";
import { Building2, Settings, ArrowUpRight, User } from "lucide-react";
import { AgentIcon } from "../components/AgentIconPicker";
import { StatusIcon } from "../components/StatusIcon";
import { Link, useNavigate } from "@/lib/router";
import { issuesApi } from "../api/issues";
import { Button } from "@/components/ui/button";
import { DEFAULT_OFFICE_CONFIG, AGENT_ROLE_LABELS } from "@paperclipai/shared";
import type { Agent, OfficeConfig } from "@paperclipai/shared";
import { agentUrl } from "../lib/utils";

export function Office() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();

  const { data: agents, isLoading: agentsLoading } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 5_000,
  });

  const { data: officeConfig, isLoading: configLoading } = useQuery({
    queryKey: queryKeys.officeConfig(selectedCompanyId!),
    queryFn: () => officeApi.getConfig(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const updateConfig = useMutation({
    mutationFn: (config: OfficeConfig) => officeApi.updateConfig(selectedCompanyId!, config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.officeConfig(selectedCompanyId!) });
    },
  });

  const config = officeConfig ?? DEFAULT_OFFICE_CONFIG;
  const activeAgents = useMemo(
    () => (agents ?? []).filter((a) => a.status !== "terminated"),
    [agents],
  );
  const positions = useOfficePositions(activeAgents, config);

  // Pan & zoom state (same pattern as OrgChart)
  const containerRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [configOpen, setConfigOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [contextMenu, setContextMenu] = useState<{ agent: Agent; x: number; y: number } | null>(null);

  useEffect(() => {
    setBreadcrumbs([{ label: "Office" }]);
  }, [setBreadcrumbs]);

  // Close context menu on click anywhere or Escape
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("click", close);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("click", close); window.removeEventListener("keydown", onKey); };
  }, [contextMenu]);

  // Center the office — retry until container has size
  const hasInitialized = useRef(false);
  useEffect(() => {
    if (hasInitialized.current) return;
    const container = containerRef.current;
    if (!container) return;

    const tryFit = () => {
      const containerW = container.clientWidth;
      const containerH = container.clientHeight;
      if (containerW < 100 || containerH < 100) return false; // not ready

      const scaleX = (containerW - 40) / config.canvasWidth;
      const scaleY = (containerH - 40) / config.canvasHeight;
      const fitZoom = Math.min(scaleX, scaleY, 1.2);

      const chartW = config.canvasWidth * fitZoom;
      const chartH = config.canvasHeight * fitZoom;

      setZoom(fitZoom);
      setPan({
        x: (containerW - chartW) / 2,
        y: Math.max(10, (containerH - chartH) / 2),
      });
      hasInitialized.current = true;
      return true;
    };

    if (!tryFit()) {
      const timer = setTimeout(tryFit, 100);
      return () => clearTimeout(timer);
    }
  }, [config, agents]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest("[data-office-agent]")) return;
      setDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    },
    [pan],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setPan({ x: dragStart.current.panX + dx, y: dragStart.current.panY + dy });
    },
    [dragging],
  );

  const handleMouseUp = useCallback(() => {
    setDragging(false);
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const newZoom = Math.min(Math.max(zoom * factor, 0.3), 2);

      const scale = newZoom / zoom;
      setPan({
        x: mouseX - scale * (mouseX - pan.x),
        y: mouseY - scale * (mouseY - pan.y),
      });
      setZoom(newZoom);
    },
    [zoom, pan],
  );

  if (!selectedCompanyId) {
    return <EmptyState icon={Building2} message="Select a company to view the office." />;
  }

  if (agentsLoading || configLoading) {
    return <PageSkeleton variant="org-chart" />;
  }

  if (!agents || agents.length === 0) {
    return <EmptyState icon={Building2} message="No agents found. Create agents to see them in the office." />;
  }

  const positionMap = new Map(positions.map((p) => [p.agentId, p]));

  return (
    <>
      <div className={`flex gap-0 h-[calc(100vh-4rem)] ${selectedAgent ? "" : ""}`}>
      <div
        ref={containerRef}
        className={`flex-1 min-w-0 overflow-hidden relative bg-muted/20 border border-border rounded-lg ${selectedAgent ? "rounded-r-none border-r-0" : ""}`}
        style={{ cursor: dragging ? "grabbing" : "grab" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {/* Top controls */}
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setConfigOpen(true)}
          >
            <Settings className="h-3 w-3 mr-1" />
            Configure
          </Button>
          <div className="flex flex-col gap-1 ml-1">
            <button
              className="w-7 h-7 flex items-center justify-center bg-background border border-border rounded text-sm hover:bg-accent transition-colors"
              onClick={() => {
                const newZoom = Math.min(zoom * 1.2, 2);
                const container = containerRef.current;
                if (container) {
                  const cx = container.clientWidth / 2;
                  const cy = container.clientHeight / 2;
                  const scale = newZoom / zoom;
                  setPan({ x: cx - scale * (cx - pan.x), y: cy - scale * (cy - pan.y) });
                }
                setZoom(newZoom);
              }}
              aria-label="Zoom in"
            >
              +
            </button>
            <button
              className="w-7 h-7 flex items-center justify-center bg-background border border-border rounded text-sm hover:bg-accent transition-colors"
              onClick={() => {
                const newZoom = Math.max(zoom * 0.8, 0.3);
                const container = containerRef.current;
                if (container) {
                  const cx = container.clientWidth / 2;
                  const cy = container.clientHeight / 2;
                  const scale = newZoom / zoom;
                  setPan({ x: cx - scale * (cx - pan.x), y: cy - scale * (cy - pan.y) });
                }
                setZoom(newZoom);
              }}
              aria-label="Zoom out"
            >
              &minus;
            </button>
            <button
              className="w-7 h-7 flex items-center justify-center bg-background border border-border rounded text-[10px] hover:bg-accent transition-colors"
              onClick={() => {
                if (!containerRef.current) return;
                const cW = containerRef.current.clientWidth;
                const cH = containerRef.current.clientHeight;
                const scaleX = (cW - 40) / config.canvasWidth;
                const scaleY = (cH - 40) / config.canvasHeight;
                const fitZoom = Math.min(scaleX, scaleY, 1);
                const chartW = config.canvasWidth * fitZoom;
                const chartH = config.canvasHeight * fitZoom;
                setZoom(fitZoom);
                setPan({ x: (cW - chartW) / 2, y: (cH - chartH) / 2 });
              }}
              title="Fit to screen"
              aria-label="Fit to screen"
            >
              Fit
            </button>
          </div>
        </div>

        {/* Agent count */}
        <div className="absolute top-3 left-3 z-10 text-xs text-muted-foreground bg-background/80 backdrop-blur-sm rounded px-2 py-1 border border-border">
          {activeAgents.length} agent{activeAgents.length !== 1 ? "s" : ""} in office
        </div>

        {/* Canvas */}
        <div
          className="absolute inset-0"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
          }}
        >
          {/* Areas */}
          {config.areas.map((area) => (
            <OfficeAreaRect key={area.id} {...area} />
          ))}

          {/* Agents */}
          {activeAgents.map((agent) => {
            const pos = positionMap.get(agent.id);
            if (!pos) return null;
            return (
              <OfficeAgentAvatar
                key={agent.id}
                agent={agent}
                x={pos.x}
                y={pos.y}
                onSelect={setSelectedAgent}
                onRightClick={(a, pos) => setContextMenu({ agent: a, ...pos })}
                selected={selectedAgent?.id === agent.id}
              />
            );
          })}
        </div>
      </div>

      {/* Context menu (floating, outside canvas transform) */}
      {contextMenu && (
        <AgentContextMenu
          agent={contextMenu.agent}
          x={contextMenu.x}
          y={contextMenu.y}
          companyId={selectedCompanyId!}
        />
      )}

      {/* Right: Agent detail panel */}
      {selectedAgent && (
        <AgentDetailSidebar agent={selectedAgent} onClose={() => setSelectedAgent(null)} />
      )}
      </div>

      <OfficeConfigPanel
        open={configOpen}
        onOpenChange={setConfigOpen}
        config={config}
        onSave={(c) => updateConfig.mutate(c)}
      />

      {/* Shake animation keyframes */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-2px); }
          75% { transform: translateX(2px); }
        }
      `}</style>
    </>
  );
}

// ── Agent Context Menu (right-click) ────────────────────────────────────

function AgentContextMenu({ agent, x, y, companyId }: { agent: Agent; x: number; y: number; companyId: string }) {
  const navigate = useNavigate();

  const { data: issues } = useQuery({
    queryKey: [...queryKeys.issues.list(companyId), "agent-context", agent.id],
    queryFn: () => issuesApi.list(companyId, { assigneeAgentId: agent.id }),
    staleTime: 10_000,
  });

  const recentIssues = (issues ?? [])
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 10);

  // Clamp position to viewport
  const menuX = Math.min(x, window.innerWidth - 280);
  const menuY = Math.min(y, window.innerHeight - 400);

  return (
    <div
      className="fixed z-50 w-[260px] rounded-lg border border-border bg-card shadow-xl py-1 animate-in fade-in zoom-in-95 duration-100"
      style={{ left: menuX, top: menuY }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-border">
        <p className="text-xs font-semibold truncate">{agent.name}</p>
        <p className="text-[10px] text-muted-foreground capitalize">{agent.role}</p>
      </div>

      {/* Quick actions */}
      <div className="py-1 border-b border-border">
        <button
          className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent/50 flex items-center gap-2"
          onClick={() => navigate(agentUrl(agent))}
        >
          <User className="h-3 w-3 text-muted-foreground" />
          View Profile
        </button>
      </div>

      {/* Recent issues */}
      <div className="py-1">
        <p className="px-3 py-1 text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
          Recent Tasks ({recentIssues.length})
        </p>
        {recentIssues.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">No tasks assigned</p>
        ) : (
          <div className="max-h-[240px] overflow-y-auto">
            {recentIssues.map((issue) => (
              <button
                key={issue.id}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent/50 flex items-center gap-2"
                onClick={() => navigate(`/issues/${issue.identifier ?? issue.id}`)}
              >
                <span className="shrink-0" onClick={(e) => e.stopPropagation()}>
                  <StatusIcon status={issue.status} />
                </span>
                <span className="text-muted-foreground font-mono text-[10px] shrink-0">
                  {issue.identifier ?? issue.id.slice(0, 6)}
                </span>
                <span className="truncate">{issue.title}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Agent Detail Sidebar ────────────────────────────────────────────────

const statusColors: Record<string, string> = {
  running: "text-cyan-500 bg-cyan-500/15",
  active: "text-green-500 bg-green-500/15",
  paused: "text-yellow-500 bg-yellow-500/15",
  idle: "text-gray-400 bg-gray-500/15",
  error: "text-red-500 bg-red-500/15",
  pending_approval: "text-purple-500 bg-purple-500/15",
  terminated: "text-gray-500 bg-gray-500/15",
};

const roleLabels = AGENT_ROLE_LABELS as Record<string, string>;

function AgentDetailSidebar({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const ringColor = statusColors[agent.status] ?? "text-gray-400 bg-gray-500/15";

  return (
    <div className="w-[320px] shrink-0 h-full border border-border rounded-r-lg bg-card overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
          <AgentIcon icon={agent.icon} className="h-5 w-5 text-foreground/70" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold truncate">{agent.name}</h3>
          <p className="text-xs text-muted-foreground">{agent.title ?? roleLabels[agent.role] ?? agent.role}</p>
        </div>
        <button className="text-muted-foreground hover:text-foreground text-lg leading-none" onClick={onClose}>
          x
        </button>
      </div>

      {/* Status */}
      <div className="px-4 py-3 border-b border-border">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${ringColor}`}>
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "currentColor" }} />
          {agent.status}
        </span>
      </div>

      {/* Details */}
      <div className="px-4 py-3 space-y-3 text-xs">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Role</span>
            <p className="mt-0.5 capitalize">{roleLabels[agent.role] ?? agent.role}</p>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Adapter</span>
            <p className="mt-0.5 font-mono">{agent.adapterType}</p>
          </div>
          {agent.lastHeartbeatAt && (
            <div className="col-span-2">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Last Active</span>
              <p className="mt-0.5">{new Date(agent.lastHeartbeatAt).toLocaleString()}</p>
            </div>
          )}
          <div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Budget</span>
            <p className="mt-0.5">${(agent.budgetMonthlyCents / 100).toFixed(2)}/mo</p>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Spent</span>
            <p className="mt-0.5">${(agent.spentMonthlyCents / 100).toFixed(2)}/mo</p>
          </div>
        </div>

        {agent.capabilities && (
          <div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Capabilities</span>
            <p className="mt-0.5 text-xs leading-relaxed whitespace-pre-wrap">{agent.capabilities}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 py-3 border-t border-border">
        <Link to={agentUrl(agent)}>
          <Button variant="outline" size="sm" className="w-full text-xs">
            View Full Profile <ArrowUpRight className="h-3 w-3 ml-1" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
