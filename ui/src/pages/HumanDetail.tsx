import { useEffect, useMemo, useCallback, useRef, useState } from "react";
import { useParams, useNavigate, Navigate } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  User,
  Plus,
  Copy,
  MoreHorizontal,
  Briefcase,
  DollarSign,
  Users,
} from "lucide-react";
import { accessApi } from "../api/access";
import { agentsApi } from "../api/agents";
import { issuesApi } from "../api/issues";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useDialog } from "../context/DialogContext";
import { useSidebar } from "../context/SidebarContext";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { Identity } from "../components/Identity";
import { EntityRow } from "../components/EntityRow";
import { PageTabBar } from "../components/PageTabBar";
import { StatusBadge } from "../components/StatusBadge";
import { ChartCard, PriorityChart, IssueStatusChart } from "../components/ActivityCharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Field } from "../components/agent-config-primitives";
import { cn } from "../lib/utils";

type HumanDetailView = "dashboard" | "configuration";

function parseHumanDetailView(value: string | null): HumanDetailView {
  if (value === "configuration") return "configuration";
  return "dashboard";
}

function formatHourlyRate(cents: number | null | undefined): string {
  if (cents == null) return "—";
  const dollars = cents / 100;
  return `$${dollars % 1 === 0 ? dollars.toFixed(0) : dollars.toFixed(2)}/hr`;
}

/* ---- Profile Configuration Form ---- */

type HumanMember = {
  id: string;
  name: string | null;
  email: string | null;
  membershipRole: string | null;
  jobTitle: string | null;
  supervisorUserId: string | null;
  supervisorAgentId: string | null;
  hourlyRateCents: number | null;
};

/** Encodes supervisor as "user:xxx", "agent:xxx", or "" */
function encodeSupervisorRef(member: Pick<HumanMember, "supervisorAgentId" | "supervisorUserId">): string {
  if (member.supervisorAgentId) return `agent:${member.supervisorAgentId}`;
  if (member.supervisorUserId) return `user:${member.supervisorUserId}`;
  return "";
}

function HumanConfigurationPage({
  member,
  companyId,
  allMembers,
  allAgents,
  canManage,
  onDirtyChange,
  onSaveActionChange,
  onCancelActionChange,
  onSavingChange,
}: {
  member: HumanMember;
  companyId: string;
  allMembers: HumanMember[];
  allAgents: Array<{ id: string; name: string; role: string; status: string }>;
  canManage: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onSaveActionChange: (save: (() => void) | null) => void;
  onCancelActionChange: (cancel: (() => void) | null) => void;
  onSavingChange: (saving: boolean) => void;
}) {
  const queryClient = useQueryClient();

  const [jobTitle, setJobTitle] = useState(member.jobTitle ?? "");
  const [supervisorRef, setSupervisorRef] = useState(() => encodeSupervisorRef(member));
  const [hourlyRate, setHourlyRate] = useState(
    member.hourlyRateCents != null ? String(member.hourlyRateCents / 100) : "",
  );
  const [saveError, setSaveError] = useState<string | null>(null);

  const originalRef = useRef({
    jobTitle: member.jobTitle ?? "",
    supervisorRef: encodeSupervisorRef(member),
    hourlyRate: member.hourlyRateCents != null ? String(member.hourlyRateCents / 100) : "",
  });

  const isDirty =
    jobTitle !== originalRef.current.jobTitle ||
    supervisorRef !== originalRef.current.supervisorRef ||
    hourlyRate !== originalRef.current.hourlyRate;

  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const rateRaw = parseFloat(hourlyRate);
      const hourlyRateCents =
        hourlyRate.trim() === "" || isNaN(rateRaw) ? null : Math.round(rateRaw * 100);
      const supervisorUserId = supervisorRef.startsWith("user:") ? supervisorRef.slice(5) : null;
      const supervisorAgentId = supervisorRef.startsWith("agent:") ? supervisorRef.slice(6) : null;
      return accessApi.updateHumanMemberProfile(companyId, member.id, {
        jobTitle: jobTitle.trim() || null,
        supervisorUserId,
        supervisorAgentId,
        hourlyRateCents,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.access.humanMembers(companyId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.org(companyId) });
      setSaveError(null);
      originalRef.current = { jobTitle, supervisorRef, hourlyRate };
      onDirtyChange(false);
      onSavingChange(false);
    },
    onError: (err) => {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
      onSavingChange(false);
    },
  });

  const doSave = useCallback(() => {
    onSavingChange(true);
    saveMutation.mutate();
  }, [saveMutation, onSavingChange]);

  const doCancel = useCallback(() => {
    setJobTitle(originalRef.current.jobTitle);
    setSupervisorRef(originalRef.current.supervisorRef);
    setHourlyRate(originalRef.current.hourlyRate);
    setSaveError(null);
  }, []);

  useEffect(() => {
    onSaveActionChange(doSave);
    onCancelActionChange(doCancel);
    return () => {
      onSaveActionChange(null);
      onCancelActionChange(null);
    };
  }, [doSave, doCancel, onSaveActionChange, onCancelActionChange]);

  const otherMembers = allMembers.filter((m) => m.id !== member.id);
  const activeAgents = allAgents.filter((a) => a.status !== "terminated");

  // Resolve display name for read-only supervisor view
  const supervisorDisplayName = useMemo(() => {
    if (member.supervisorAgentId) {
      const a = allAgents.find((a) => a.id === member.supervisorAgentId);
      return a ? `${a.name} (Agent)` : null;
    }
    if (member.supervisorUserId) {
      const u = allMembers.find((m) => m.id === member.supervisorUserId);
      return u ? (u.name ?? u.email ?? null) : null;
    }
    return null;
  }, [member, allMembers, allAgents]);

  if (!canManage) {
    return (
      <div className="max-w-3xl space-y-6">
        <div className="rounded-xl border border-border p-4 space-y-4">
          <ProfileReadRow label="Job Title" icon={Briefcase} value={member.jobTitle} />
          <ProfileReadRow label="Reports To" icon={Users} value={supervisorDisplayName} />
          <ProfileReadRow
            label="Hourly Rate"
            icon={DollarSign}
            value={formatHourlyRate(member.hourlyRateCents)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="rounded-xl border border-border p-4 space-y-4">
        <Field label="Job Title" hint="This person's role or title at the company">
          <Input
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="e.g. Senior Engineer"
            className="h-8 text-sm"
          />
        </Field>

        <Field label="Reports To" hint="Supervisor or manager — can be a human or an agent">
          <select
            value={supervisorRef}
            onChange={(e) => setSupervisorRef(e.target.value)}
            className="w-full h-8 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">— None —</option>
            {otherMembers.length > 0 && (
              <optgroup label="Humans">
                {otherMembers.map((m) => (
                  <option key={m.id} value={`user:${m.id}`}>
                    {m.name ?? m.email ?? m.id.slice(0, 8)}
                  </option>
                ))}
              </optgroup>
            )}
            {activeAgents.length > 0 && (
              <optgroup label="Agents">
                {activeAgents.map((a) => (
                  <option key={a.id} value={`agent:${a.id}`}>
                    {a.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </Field>

        <Field label="Hourly Rate ($/hr)" hint="Used for budget planning and cost tracking">
          <Input
            type="number"
            min="0"
            step="0.01"
            value={hourlyRate}
            onChange={(e) => setHourlyRate(e.target.value)}
            placeholder="e.g. 75.00"
            className="h-8 text-sm"
          />
        </Field>

        {saveError && <p className="text-xs text-destructive">{saveError}</p>}
      </div>

      <div>
        <h3 className="text-sm font-medium mb-2">Member Info</h3>
        <div className="rounded-xl border border-border divide-y divide-border px-4">
          <ProfileReadRow label="Email" icon={User} value={member.email} />
          <ProfileReadRow
            label="Member ID"
            icon={User}
            value={member.id.slice(0, 8)}
            mono
          />
          <ProfileReadRow
            label="Role"
            icon={User}
            value={member.membershipRole ?? "member"}
          />
        </div>
      </div>
    </div>
  );
}

function ProfileReadRow({
  label,
  icon: Icon,
  value,
  mono,
}: {
  label: string;
  icon?: typeof User;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 gap-4">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span
        className={cn(
          "text-sm text-right truncate",
          !value && "text-muted-foreground/60 italic",
          mono && "font-mono text-xs",
        )}
      >
        {value ?? "—"}
      </span>
    </div>
  );
}

/* ---- Dashboard Tab ---- */

function HumanDashboard({
  assignedIssues,
  userId,
}: {
  assignedIssues: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    identifier?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
  userId: string;
}) {
  const openIssues = assignedIssues.filter(
    (i) => i.status !== "done" && i.status !== "cancelled",
  );
  const closedIssues = assignedIssues.filter(
    (i) => i.status === "done" || i.status === "cancelled",
  );

  return (
    <div className="space-y-8">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="Open Issues" value={openIssues.length} />
        <StatCard label="Completed" value={closedIssues.length} />
        <StatCard
          label="Total Assigned"
          value={assignedIssues.length}
          className="hidden sm:block"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        <ChartCard title="Issues by Priority">
          <PriorityChart issues={assignedIssues} />
        </ChartCard>
        <ChartCard title="Issues by Status">
          <IssueStatusChart issues={assignedIssues} />
        </ChartCard>
      </div>

      {/* Assigned Issues */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Assigned Issues</h3>
          <a
            href={`/issues?assignee=__user:${userId}`}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            See All &rarr;
          </a>
        </div>
        {assignedIssues.length === 0 ? (
          <p className="text-sm text-muted-foreground">No assigned issues.</p>
        ) : (
          <div className="border border-border rounded-lg">
            {assignedIssues.slice(0, 10).map((issue) => (
              <EntityRow
                key={issue.id}
                identifier={issue.identifier ?? issue.id.slice(0, 8)}
                title={issue.title}
                to={`/issues/${issue.identifier ?? issue.id}`}
                trailing={<StatusBadge status={issue.status} />}
              />
            ))}
            {assignedIssues.length > 10 && (
              <div className="px-3 py-2 text-xs text-muted-foreground text-center border-t border-border">
                +{assignedIssues.length - 10} more issues
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-border p-4", className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold tabular-nums mt-1">{value}</p>
    </div>
  );
}

/* ---- Main export ---- */

export function HumanDetail() {
  const { userId, tab: urlTab } = useParams<{ userId: string; tab?: string }>();
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { openNewIssue } = useDialog();
  const { isMobile } = useSidebar();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const activeView = parseHumanDetailView(urlTab ?? null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [configDirty, setConfigDirty] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const saveConfigActionRef = useRef<(() => void) | null>(null);
  const cancelConfigActionRef = useRef<(() => void) | null>(null);
  const setSaveConfigAction = useCallback((fn: (() => void) | null) => { saveConfigActionRef.current = fn; }, []);
  const setCancelConfigAction = useCallback((fn: (() => void) | null) => { cancelConfigActionRef.current = fn; }, []);

  const { data: members, isLoading: isMembersLoading } = useQuery({
    queryKey: queryKeys.access.humanMembers(selectedCompanyId!),
    queryFn: () => accessApi.listHumanMembers(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: memberConfig } = useQuery({
    queryKey: queryKeys.access.humanMemberConfig(selectedCompanyId!),
    queryFn: () => accessApi.getHumanMemberConfig(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: allAgents = [] } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const member = useMemo(
    () => members?.find((m) => m.id === userId) ?? null,
    [members, userId],
  );

  const label = member?.name ?? member?.email ?? userId?.slice(0, 8) ?? "Human";

  const { data: assignedIssues = [], isLoading: isIssuesLoading } = useQuery({
    queryKey: ["issues", selectedCompanyId!, "assigned-to-user", userId!] as const,
    queryFn: () => issuesApi.list(selectedCompanyId!, { assigneeUserId: userId }),
    enabled: !!selectedCompanyId && !!userId,
  });

  const sortedIssues = useMemo(
    () =>
      [...assignedIssues].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    [assignedIssues],
  );

  useEffect(() => {
    const crumbs: { label: string; href?: string }[] = [
      { label: "Humans", href: "/humans" },
    ];
    if (activeView === "dashboard") {
      crumbs.push({ label });
    } else {
      crumbs.push({ label, href: `/humans/${userId}/dashboard` });
      crumbs.push({ label: "Configuration" });
    }
    setBreadcrumbs(crumbs);
  }, [setBreadcrumbs, label, activeView, userId]);

  const showConfigActionBar = activeView === "configuration" && (configDirty || configSaving);

  if (!selectedCompanyId) {
    return <EmptyState icon={User} message="Select a company to view this member." />;
  }

  if (isMembersLoading || isIssuesLoading) return <PageSkeleton variant="detail" />;

  if (!member && !isMembersLoading) {
    return <EmptyState icon={User} message="Member not found." />;
  }

  if (!urlTab) {
    return <Navigate to={`/humans/${userId}/dashboard`} replace />;
  }

  const roleLabel =
    member?.membershipRole === "owner"
      ? "Owner"
      : member?.membershipRole
        ? member.membershipRole.charAt(0).toUpperCase() + member.membershipRole.slice(1)
        : null;

  const canManage = memberConfig?.canManageMembers ?? false;

  return (
    <div className={cn("space-y-6", isMobile && showConfigActionBar && "pb-24")}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0 flex items-center justify-center h-12 w-12 rounded-lg bg-accent">
            <Identity name={label} size="sm" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl font-bold truncate">{label}</h2>
              {roleLabel && (
                <Badge variant="secondary" className="text-xs shrink-0">
                  {roleLabel}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {member?.jobTitle
                ? member.jobTitle
                : (member?.name && member?.email
                  ? member.email
                  : null) ?? "Human Member"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openNewIssue({ assigneeUserId: userId })}
          >
            <Plus className="h-3.5 w-3.5 sm:mr-1" />
            <span className="hidden sm:inline">Assign Task</span>
          </Button>

          <Popover open={moreOpen} onOpenChange={setMoreOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon-xs">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-44 p-1" align="end">
              <button
                className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50"
                onClick={() => {
                  navigator.clipboard.writeText(userId ?? "");
                  setMoreOpen(false);
                }}
              >
                <Copy className="h-3 w-3" />
                Copy Member ID
              </button>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Tab bar */}
      <Tabs
        value={activeView}
        onValueChange={(value) => navigate(`/humans/${userId}/${value}`)}
      >
        <PageTabBar
          items={[
            { value: "dashboard", label: "Dashboard" },
            { value: "configuration", label: "Configuration" },
          ]}
          value={activeView}
          onValueChange={(value) => navigate(`/humans/${userId}/${value}`)}
        />
      </Tabs>

      {/* Floating Save/Cancel bar — desktop */}
      {!isMobile && showConfigActionBar && (
        <div className="sticky top-6 z-10 float-right transition-opacity duration-150">
          <div className="flex items-center gap-2 bg-background/90 backdrop-blur-sm border border-border rounded-lg px-3 py-1.5 shadow-lg">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => cancelConfigActionRef.current?.()}
              disabled={configSaving}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => saveConfigActionRef.current?.()}
              disabled={configSaving}
            >
              {configSaving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      )}

      {/* Mobile bottom bar */}
      {isMobile && showConfigActionBar && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur-sm">
          <div
            className="flex items-center justify-end gap-2 px-3 py-2"
            style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)" }}
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={() => cancelConfigActionRef.current?.()}
              disabled={configSaving}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => saveConfigActionRef.current?.()}
              disabled={configSaving}
            >
              {configSaving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      )}

      {/* Tab content */}
      {activeView === "dashboard" && (
        <HumanDashboard assignedIssues={sortedIssues} userId={userId!} />
      )}

      {activeView === "configuration" && member && (
        <HumanConfigurationPage
          member={member}
          companyId={selectedCompanyId}
          allMembers={members ?? []}
          allAgents={allAgents}
          canManage={canManage}
          onDirtyChange={setConfigDirty}
          onSaveActionChange={setSaveConfigAction}
          onCancelActionChange={setCancelConfigAction}
          onSavingChange={setConfigSaving}
        />
      )}
    </div>
  );
}
