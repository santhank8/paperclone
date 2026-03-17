import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { schedulingApi } from "../api/scheduling";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Clock,
  Repeat,
  Zap,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
} from "lucide-react";
import { getCronOccurrences, describeCron, type UnifiedScheduledJob, type CronOccurrence } from "@paperclipai/shared";

// ── Helpers ──────────────────────────────────────────────────────────────

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getWeekStart(date: Date): Date {
  const day = date.getDay();
  return addDays(startOfDay(date), -(day + 6) % 7);
}

function getMonthStartGrid(date: Date): Date {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  // Start on Monday (consistent with week view)
  const day = first.getDay();
  return addDays(first, -((day + 6) % 7));
}

function formatDateLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatRelativeTime(ms: number | undefined): string {
  if (!ms) return "--";
  const diff = Date.now() - ms;
  const absDiff = Math.abs(diff);
  const future = diff < 0;
  if (absDiff < 60000) return future ? "soon" : "just now";
  if (absDiff < 3600000) {
    const m = Math.floor(absDiff / 60000);
    return future ? `in ${m}m` : `${m}m ago`;
  }
  if (absDiff < 86400000) {
    const h = Math.floor(absDiff / 3600000);
    return future ? `in ${h}h` : `${h}h ago`;
  }
  const d = Math.floor(absDiff / 86400000);
  return future ? `in ${d}d` : `${d}d ago`;
}

const SOURCE_COLORS = {
  openclaw: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30",
  paperclip: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30",
};

const STATUS_COLORS: Record<string, string> = {
  success: "text-green-500",
  error: "text-red-500",
  running: "text-blue-500",
};

const AGENT_COLORS = [
  "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  "bg-amber-500/20 text-amber-400 border-amber-500/30",
  "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "bg-rose-500/20 text-rose-400 border-rose-500/30",
  "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  "bg-orange-500/20 text-orange-400 border-orange-500/30",
  "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
];

function getAgentColor(agentId: string, allAgents: string[]): string {
  const idx = allAgents.indexOf(agentId);
  return AGENT_COLORS[idx >= 0 ? idx % AGENT_COLORS.length : 0];
}

type CalendarView = "agenda" | "week" | "month";
type SourceFilter = "all" | "openclaw" | "paperclip";
type StateFilter = "all" | "enabled" | "disabled";

interface DayJobSummary {
  job: UnifiedScheduledJob;
  runCount: number;
}

// ── Component ────────────────────────────────────────────────────────────

export function Scheduling() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();

  useEffect(() => {
    setBreadcrumbs([{ label: "Scheduling" }]);
  }, [setBreadcrumbs]);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.scheduling(selectedCompanyId!),
    queryFn: () => schedulingApi.listJobs(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 5_000,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ jobId, enabled }: { jobId: string; enabled: boolean }) =>
      schedulingApi.toggleJob(selectedCompanyId!, jobId, enabled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.scheduling(selectedCompanyId!) }),
  });

  const jobs = data?.jobs ?? [];

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [stateFilter, setStateFilter] = useState<StateFilter>("all");
  const [agentFilter, setAgentFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [calendarView, setCalendarView] = useState<CalendarView>("week");
  const [calendarDate, setCalendarDate] = useState(startOfDay(new Date()));
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));
  const [selectedJob, setSelectedJob] = useState<UnifiedScheduledJob | null>(null);

  const allAgentIds = useMemo(
    () => [...new Set(jobs.map((j) => j.agentId).filter(Boolean) as string[])],
    [jobs],
  );

  const allAgentNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const j of jobs) {
      if (j.agentId && j.agentName) map.set(j.agentId, j.agentName);
    }
    return map;
  }, [jobs]);

  const allProjects = useMemo(
    () => [...new Set(jobs.map((j) => j.projectName).filter(Boolean) as string[])].sort(),
    [jobs],
  );

  const filteredJobs = useMemo(() => {
    return jobs.filter((j) => {
      if (sourceFilter !== "all" && j.source !== sourceFilter) return false;
      if (stateFilter === "enabled" && !j.enabled) return false;
      if (stateFilter === "disabled" && j.enabled) return false;
      if (agentFilter !== "all" && j.agentId !== agentFilter) return false;
      if (projectFilter !== "all" && (j.projectName ?? "") !== projectFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (
          !j.name.toLowerCase().includes(q) &&
          !(j.agentName ?? "").toLowerCase().includes(q) &&
          !(j.command ?? "").toLowerCase().includes(q) &&
          !(j.issueIdentifier ?? "").toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [jobs, sourceFilter, stateFilter, agentFilter, projectFilter, searchQuery]);

  // Calendar occurrences
  const calendarRange = useMemo(() => {
    if (calendarView === "week") {
      const start = getWeekStart(calendarDate);
      return { start, end: addDays(start, 7) };
    }
    const start = getMonthStartGrid(calendarDate);
    return { start, end: addDays(start, 42) };
  }, [calendarView, calendarDate]);

  const dayJobMap = useMemo(() => {
    const map = new Map<string, DayJobSummary[]>();
    for (const job of filteredJobs) {
      if (!job.enabled || !job.cronExpr) continue;
      const occs = getCronOccurrences(
        job.cronExpr,
        calendarRange.start.getTime(),
        calendarRange.end.getTime(),
        500,
      );
      for (const occ of occs) {
        const existing = map.get(occ.dayKey);
        const entry = existing?.find((e) => e.job.id === job.id);
        if (entry) {
          entry.runCount++;
        } else {
          const arr = existing ?? [];
          arr.push({ job, runCount: 1 });
          if (!existing) map.set(occ.dayKey, arr);
        }
      }
    }
    return map;
  }, [filteredJobs, calendarRange]);

  const moveCalendar = useCallback(
    (dir: number) => {
      if (calendarView === "week") {
        setCalendarDate((d) => addDays(d, dir * 7));
      } else {
        setCalendarDate((d) => {
          const next = new Date(d);
          next.setMonth(next.getMonth() + dir);
          return next;
        });
      }
    },
    [calendarView],
  );

  if (!selectedCompanyId) {
    return <EmptyState icon={Clock} message="Select a company to view scheduling." />;
  }
  if (isLoading) return <PageSkeleton />;

  const openclawCount = jobs.filter((j) => j.source === "openclaw").length;
  const paperclipCount = jobs.filter((j) => j.source === "paperclip").length;
  const today = startOfDay(new Date());

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Scheduling</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {openclawCount} OpenClaw cron job{openclawCount !== 1 ? "s" : ""}
            {" + "}
            {paperclipCount} Paperclip recurring task{paperclipCount !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search jobs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 w-52 text-xs"
          />
        </div>

        {/* Source filter */}
        <div className="flex items-center rounded-md border border-border overflow-hidden">
          {(["all", "openclaw", "paperclip"] as const).map((s) => (
            <button
              key={s}
              className={cn(
                "px-2.5 py-1.5 text-xs font-medium transition-colors",
                sourceFilter === s ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50",
              )}
              onClick={() => setSourceFilter(s)}
            >
              {s === "all" ? "All" : s === "openclaw" ? "OpenClaw" : "Paperclip"}
            </button>
          ))}
        </div>

        {/* Agent filter */}
        <select
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
          className="h-8 px-2 text-xs rounded-md border border-border bg-background text-foreground"
        >
          <option value="all">All agents</option>
          {allAgentIds.map((id) => (
            <option key={id} value={id}>{allAgentNames.get(id) ?? id}</option>
          ))}
        </select>

        {/* Project filter */}
        {allProjects.length > 0 && (
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="h-8 px-2 text-xs rounded-md border border-border bg-background text-foreground"
          >
            <option value="all">All projects</option>
            {allProjects.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        )}

        {/* State filter */}
        <div className="flex items-center rounded-md border border-border overflow-hidden">
          {(["all", "enabled", "disabled"] as const).map((s) => (
            <button
              key={s}
              className={cn(
                "px-2.5 py-1.5 text-xs font-medium capitalize transition-colors",
                stateFilter === s ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50",
              )}
              onClick={() => setStateFilter(s)}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Calendar view */}
        <div className="flex items-center rounded-md border border-border overflow-hidden ml-auto">
          {(["agenda", "week", "month"] as const).map((v) => (
            <button
              key={v}
              className={cn(
                "px-2.5 py-1.5 text-xs font-medium capitalize transition-colors",
                calendarView === v ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50",
              )}
              onClick={() => setCalendarView(v)}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar navigation */}
      {calendarView !== "agenda" && (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" onClick={() => moveCalendar(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[140px] text-center">
            {calendarView === "week"
              ? `${formatDateLabel(getWeekStart(calendarDate))} - ${formatDateLabel(addDays(getWeekStart(calendarDate), 6))}`
              : calendarDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </span>
          <Button variant="ghost" size="icon-sm" onClick={() => moveCalendar(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => setCalendarDate(today)}>
            Today
          </Button>
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_420px] gap-4">
        {/* Left: Calendar + Job list */}
        <div className="space-y-3 min-w-0">
          {calendarView === "agenda" ? (
            <AgendaView jobs={filteredJobs} allAgentIds={allAgentIds} onSelect={setSelectedJob} selectedJobId={selectedJob?.id} />
          ) : calendarView === "week" ? (
            <WeekView
              startDate={getWeekStart(calendarDate)}
              dayJobMap={dayJobMap}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              today={today}
              allAgentIds={allAgentIds}
            />
          ) : (
            <MonthView
              date={calendarDate}
              dayJobMap={dayJobMap}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              today={today}
              allAgentIds={allAgentIds}
            />
          )}

          {/* Job list below calendar */}
          <div>
            {(() => {
              const isCalendarMode = calendarView === "week" || calendarView === "month";
              const selectedDayKey = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`;
              const daySpecificJobs = isCalendarMode
                ? (dayJobMap.get(selectedDayKey) ?? []).map((s) => s.job)
                : filteredJobs;
              const displayJobs = isCalendarMode ? daySpecificJobs : filteredJobs;
              const headerLabel = isCalendarMode
                ? `${displayJobs.length} job${displayJobs.length !== 1 ? "s" : ""} on ${formatDateLabel(selectedDate)}`
                : `${displayJobs.length} scheduled job${displayJobs.length !== 1 ? "s" : ""}`;

              return (
                <>
            <h3 className="text-xs font-semibold text-muted-foreground mb-2">
              {headerLabel}
            </h3>
            <div className="space-y-1 max-h-[40vh] overflow-y-auto">
              {displayJobs.map((job) => (
                <button
                  key={job.id}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg border transition-colors",
                    selectedJob?.id === job.id
                      ? "border-primary/40 bg-primary/5"
                      : "border-border hover:border-foreground/20 hover:bg-accent/30",
                  )}
                  onClick={() => setSelectedJob(job)}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn("w-2 h-2 rounded-full shrink-0", job.enabled ? "bg-green-500" : "bg-gray-400")} />
                    <span className="text-sm font-medium truncate flex-1">{job.name}</span>
                    <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full border", SOURCE_COLORS[job.source])}>
                      {job.source === "openclaw" ? "OpenClaw" : "Paperclip"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    {job.agentName && (
                      <span className={cn("px-1.5 py-0.5 rounded border text-[10px]", getAgentColor(job.agentId!, allAgentIds))}>
                        {job.agentName}
                      </span>
                    )}
                    <span className="font-mono">{job.cronExpr}</span>
                    <span className="ml-auto">{job.scheduleText}</span>
                  </div>
                </button>
              ))}
            </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* Right: Full detail panel (sticky) */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          {selectedJob ? (
            <DetailPanel
              job={selectedJob}
              onToggle={(enabled) => {
                if (selectedJob.source === "openclaw") {
                  toggleMutation.mutate({ jobId: selectedJob.id, enabled });
                }
              }}
            />
          ) : (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <Clock className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Select a job to see details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Agenda View ──────────────────────────────────────────────────────────

function AgendaView({
  jobs,
  allAgentIds,
  onSelect,
  selectedJobId,
}: {
  jobs: UnifiedScheduledJob[];
  allAgentIds: string[];
  onSelect: (j: UnifiedScheduledJob) => void;
  selectedJobId?: string;
}) {
  const upcoming = useMemo(() => {
    const now = Date.now();
    const range = 7 * 24 * 60 * 60 * 1000;
    const items: Array<{ job: UnifiedScheduledJob; atMs: number }> = [];

    for (const job of jobs) {
      if (!job.enabled || !job.cronExpr) continue;
      const occs = getCronOccurrences(job.cronExpr, now, now + range, 50);
      for (const occ of occs) {
        items.push({ job, atMs: occ.atMs });
      }
    }

    return items.sort((a, b) => a.atMs - b.atMs).slice(0, 200);
  }, [jobs]);

  return (
    <div className="rounded-lg border border-border max-h-[60vh] overflow-y-auto">
      {upcoming.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">No upcoming scheduled jobs</div>
      ) : (
        <div className="divide-y divide-border">
          {upcoming.map((item, i) => {
            const d = new Date(item.atMs);
            return (
              <button
                key={`${item.job.id}-${i}`}
                className="w-full text-left px-3 py-2 hover:bg-accent/30 transition-colors flex items-center gap-3"
                onClick={() => onSelect(item.job)}
              >
                <span className="text-xs text-muted-foreground font-mono w-32 shrink-0">
                  {d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}{" "}
                  {d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-full shrink-0",
                    item.job.source === "openclaw" ? "bg-cyan-500" : "bg-purple-500",
                  )}
                />
                <span className="text-sm truncate flex-1">{item.job.name}</span>
                {item.job.agentName && (
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded border", getAgentColor(item.job.agentId!, allAgentIds))}>
                    {item.job.agentName}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Week View ────────────────────────────────────────────────────────────

function WeekView({
  startDate,
  dayJobMap,
  selectedDate,
  onSelectDate,
  today,
  allAgentIds,
}: {
  startDate: Date;
  dayJobMap: Map<string, DayJobSummary[]>;
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  today: Date;
  allAgentIds: string[];
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(startDate, i));
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="grid grid-cols-7 gap-1.5">
      {days.map((day, i) => {
        const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
        const summaries = dayJobMap.get(key) ?? [];
        const isToday = isSameDay(day, today);
        const isSelected = isSameDay(day, selectedDate);

        return (
          <button
            key={key}
            className={cn(
              "rounded-lg border p-2 min-h-[140px] text-left transition-colors flex flex-col",
              isSelected ? "border-primary/40 bg-primary/5" : "border-border hover:border-foreground/20",
            )}
            onClick={() => onSelectDate(day)}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className={cn("text-[10px] font-medium", isToday ? "text-primary" : "text-muted-foreground")}>
                {dayNames[i]}
              </span>
              <span className={cn("text-xs font-semibold", isToday ? "text-primary" : "text-foreground")}>
                {day.getDate()}
              </span>
            </div>
            <div className="flex-1 space-y-0.5 overflow-hidden">
              {summaries.slice(0, 5).map((s) => (
                <div
                  key={s.job.id}
                  className={cn(
                    "text-[9px] px-1 py-0.5 rounded border truncate",
                    s.job.source === "openclaw"
                      ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-600 dark:text-cyan-400"
                      : "bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400",
                  )}
                >
                  {s.job.name}
                </div>
              ))}
              {summaries.length > 5 && (
                <span className="text-[9px] text-muted-foreground">+{summaries.length - 5} more</span>
              )}
            </div>
            {summaries.length > 0 && (
              <div className="text-[9px] text-muted-foreground mt-1 pt-1 border-t border-border/50">
                {summaries.reduce((sum, s) => sum + s.runCount, 0)} runs
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Month View ───────────────────────────────────────────────────────────

function MonthView({
  date,
  dayJobMap,
  selectedDate,
  onSelectDate,
  today,
  allAgentIds,
}: {
  date: Date;
  dayJobMap: Map<string, DayJobSummary[]>;
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  today: Date;
  allAgentIds: string[];
}) {
  const gridStart = getMonthStartGrid(date);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const currentMonth = date.getMonth();
  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {dayLabels.map((d) => (
          <div key={d} className="text-center text-[10px] text-muted-foreground font-medium py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day) => {
          const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
          const summaries = dayJobMap.get(key) ?? [];
          const isCurrentMonth = day.getMonth() === currentMonth;
          const isToday = isSameDay(day, today);
          const isSelected = isSameDay(day, selectedDate);

          return (
            <button
              key={key}
              className={cn(
                "rounded-md border p-1 min-h-[80px] text-left transition-colors flex flex-col",
                !isCurrentMonth && "opacity-40",
                isSelected ? "border-primary/40 bg-primary/5" : "border-border/50 hover:border-border",
              )}
              onClick={() => onSelectDate(day)}
            >
              <span className={cn("text-[10px] font-medium", isToday ? "text-primary font-bold" : "text-muted-foreground")}>
                {day.getDate()}
              </span>
              <div className="flex-1 space-y-0.5 mt-0.5 overflow-hidden">
                {summaries.slice(0, 3).map((s) => (
                  <div
                    key={s.job.id}
                    className={cn(
                      "text-[8px] px-0.5 rounded truncate",
                      s.job.source === "openclaw" ? "text-cyan-500" : "text-purple-500",
                    )}
                  >
                    {s.job.name}
                  </div>
                ))}
                {summaries.length > 3 && (
                  <span className="text-[8px] text-muted-foreground">+{summaries.length - 3}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Detail Panel ─────────────────────────────────────────────────────────

function DetailField({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">{label}</span>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

function DetailPanel({
  job,
  onToggle,
}: {
  job: UnifiedScheduledJob;
  onToggle: (enabled: boolean) => void;
}) {
  const [promptExpanded, setPromptExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          {job.source === "openclaw" ? (
            <Zap className="h-4 w-4 text-cyan-500 shrink-0" />
          ) : (
            <Repeat className="h-4 w-4 text-purple-500 shrink-0" />
          )}
          <h3 className="text-sm font-semibold flex-1 truncate">{job.name}</h3>
          <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border shrink-0", SOURCE_COLORS[job.source])}>
            {job.source === "openclaw" ? "OpenClaw" : "Paperclip"}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          <span className={cn("w-2 h-2 rounded-full", job.enabled ? "bg-green-500" : "bg-gray-400")} />
          <span className="text-xs text-muted-foreground">{job.enabled ? "Enabled" : "Disabled"}</span>
          {job.lastStatus && (
            <>
              <span className="text-muted-foreground">·</span>
              <span className={cn("text-xs font-medium capitalize", STATUS_COLORS[job.lastStatus] ?? "text-muted-foreground")}>
                {job.lastStatus}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-4 max-h-[calc(100vh-14rem)] overflow-y-auto">
        {/* Schedule section */}
        <div>
          <h4 className="text-[11px] font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Schedule</h4>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
            <DetailField label="Cron Expression">
              <p className="font-mono text-sm">{job.cronExpr || "--"}</p>
            </DetailField>
            <DetailField label="Human Readable">
              <p className="text-sm">{job.scheduleText}</p>
            </DetailField>
            {job.timezone && (
              <DetailField label="Timezone">
                <p>{job.timezone}</p>
              </DetailField>
            )}
          </div>
        </div>

        {/* Timing section */}
        <div className="border-t border-border pt-3">
          <h4 className="text-[11px] font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Timing</h4>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
            <DetailField label="Last Run">
              <p>{job.lastRunAt ? new Date(job.lastRunAt).toLocaleString() : "--"}</p>
              {job.lastRunAt && <p className="text-muted-foreground">{formatRelativeTime(job.lastRunAt)}</p>}
            </DetailField>
            <DetailField label="Next Run">
              <p className="text-primary">{job.nextRunAt ? new Date(job.nextRunAt).toLocaleString() : "--"}</p>
              {job.nextRunAt && <p className="text-muted-foreground">{formatRelativeTime(job.nextRunAt)}</p>}
            </DetailField>
            {job.lastDurationMs != null && (
              <DetailField label="Last Duration">
                <p>{(job.lastDurationMs / 1000).toFixed(1)}s</p>
              </DetailField>
            )}
            {job.lastError && (
              <DetailField label="Last Error" full>
                <p className="text-red-500 text-xs bg-red-500/10 rounded p-1.5 font-mono">{job.lastError}</p>
              </DetailField>
            )}
          </div>
        </div>

        {/* Agent section */}
        {job.agentName && (
          <div className="border-t border-border pt-3">
            <h4 className="text-[11px] font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Agent</h4>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <DetailField label="Agent">
                <p className="text-sm font-medium">{job.agentName}</p>
              </DetailField>
              {job.model && (
                <DetailField label="Model">
                  <p className="font-mono">{job.model}</p>
                </DetailField>
              )}
              {job.sessionTarget && (
                <DetailField label="Session">
                  <p className="capitalize">{job.sessionTarget}</p>
                </DetailField>
              )}
              {job.wakeMode && (
                <DetailField label="Wake Mode">
                  <p className="capitalize">{job.wakeMode}</p>
                </DetailField>
              )}
              {job.deliveryMode && (
                <DetailField label="Delivery">
                  <p className="capitalize">{job.deliveryMode}</p>
                </DetailField>
              )}
              {job.payloadKind && (
                <DetailField label="Payload Type">
                  <p className="font-mono">{job.payloadKind}</p>
                </DetailField>
              )}
            </div>
          </div>
        )}

        {/* Prompt / Command section (the full text) */}
        {(job.fullPrompt || job.command) && (
          <div className="border-t border-border pt-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                {job.source === "openclaw" ? "Prompt / Message" : "Description"}
              </h4>
              {job.fullPrompt && job.fullPrompt.length > 300 && (
                <button
                  className="text-[10px] text-primary hover:underline"
                  onClick={() => setPromptExpanded(!promptExpanded)}
                >
                  {promptExpanded ? "Collapse" : "Expand"}
                </button>
              )}
            </div>
            <div
              className={cn(
                "text-xs font-mono bg-muted/50 rounded-lg p-3 whitespace-pre-wrap break-words leading-relaxed border border-border/50",
                !promptExpanded && "max-h-[200px] overflow-hidden relative",
              )}
            >
              {job.fullPrompt || job.command}
              {!promptExpanded && job.fullPrompt && job.fullPrompt.length > 300 && (
                <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-muted/80 to-transparent" />
              )}
            </div>
          </div>
        )}

        {/* Paperclip-specific section */}
        {job.source === "paperclip" && (
          <div className="border-t border-border pt-3">
            <h4 className="text-[11px] font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Paperclip Issue</h4>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              {job.issueIdentifier && (
                <DetailField label="Identifier">
                  <Link to={`/issues/${job.issueId}`} className="text-primary hover:underline flex items-center gap-1 text-sm font-medium">
                    {job.issueIdentifier} <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </DetailField>
              )}
              {job.issueStatus && (
                <DetailField label="Status">
                  <p className="capitalize">{job.issueStatus}</p>
                </DetailField>
              )}
              {job.priority && (
                <DetailField label="Priority">
                  <p className="capitalize">{job.priority}</p>
                </DetailField>
              )}
              {job.projectName && (
                <DetailField label="Project">
                  <p>{job.projectName}</p>
                </DetailField>
              )}
              {job.spawnCount != null && (
                <DetailField label="Tasks Spawned">
                  <p className="text-sm font-medium">{job.spawnCount}</p>
                </DetailField>
              )}
            </div>
          </div>
        )}

        {/* Metadata */}
        {(job.createdAt || job.updatedAt) && (
          <div className="border-t border-border pt-3">
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              {job.createdAt && (
                <div>Created: {new Date(job.createdAt).toLocaleDateString()}</div>
              )}
              {job.updatedAt && (
                <div>Updated: {new Date(job.updatedAt).toLocaleDateString()}</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Actions footer */}
      <div className="px-4 py-2.5 border-t border-border bg-muted/20 flex items-center gap-2">
        {job.source === "openclaw" && (
          <Button
            variant={job.enabled ? "outline" : "default"}
            size="sm"
            className="text-xs"
            onClick={() => onToggle(!job.enabled)}
          >
            {job.enabled ? "Disable" : "Enable"}
          </Button>
        )}
        {job.issueId && (
          <Link to={`/issues/${job.issueId}`}>
            <Button variant="outline" size="sm" className="text-xs">
              Open Issue <ArrowUpRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
