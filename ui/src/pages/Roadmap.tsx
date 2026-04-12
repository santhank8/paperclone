import { useEffect, useMemo, useState } from "react";
import type { Goal, Issue } from "@paperclipai/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Flag, Pause, Play, Plus } from "lucide-react";
import { Link } from "@/lib/router";
import { companiesApi } from "../api/companies";
import { goalsApi } from "../api/goals";
import { issuesApi } from "../api/issues";
import { roadmapApi, type RoadmapItem } from "../api/roadmap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "../components/EmptyState";
import { MarkdownBody } from "../components/MarkdownBody";
import { PageSkeleton } from "../components/PageSkeleton";
import { StatusBadge } from "../components/StatusBadge";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { queryKeys } from "../lib/queryKeys";
import { formatIssueStatusLabel } from "../lib/issue-status-labels";
import { timeAgo } from "../lib/timeAgo";
import { cn } from "../lib/utils";

const ROADMAP_ID_REGEX = /\bRM-(?:\d{4}-Q[1-4]-\d{2}|UNPLANNED)\b/gi;
const UNPLANNED_ROADMAP_ID = "RM-UNPLANNED";
const UNPLANNED_ROADMAP_TITLE = "Unplanned / Interrupts";
const ISSUE_PREVIEW_LIMIT = 6;
const ROADMAP_CONTRACT_EXPANDED_STORAGE_KEY = "paperclip.roadmap.contractExpanded";

type EpicFilterState = "all" | "in_progress" | "blocked" | "done" | "not_started";
type EpicState = Exclude<EpicFilterState, "all">;
type QuickFilter = "all" | "active" | "blocked" | "unplanned";

interface EpicTone {
  badge: string;
  dot: string;
}

const EPIC_TONES: EpicTone[] = [
  {
    badge: "border-cyan-300 bg-cyan-50 text-cyan-800 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200",
    dot: "bg-cyan-500 dark:bg-cyan-400",
  },
  {
    badge: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
    dot: "bg-emerald-500 dark:bg-emerald-400",
  },
  {
    badge: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
    dot: "bg-amber-500 dark:bg-amber-400",
  },
  {
    badge: "border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200",
    dot: "bg-violet-500 dark:bg-violet-400",
  },
  {
    badge: "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200",
    dot: "bg-rose-500 dark:bg-rose-400",
  },
  {
    badge: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200",
    dot: "bg-sky-500 dark:bg-sky-400",
  },
];

const EMPTY_LINKED_ISSUE_SUMMARY: LinkedIssueSummary = {
  total: 0,
  active: 0,
  doneEquivalent: 0,
  blocked: 0,
  inProgress: 0,
  completionPct: 0,
};

interface TimelineItem extends RoadmapItem {
  sectionTitle: string;
  sectionIndex: number;
}

interface LinkedIssueSummary {
  total: number;
  active: number;
  doneEquivalent: number;
  blocked: number;
  inProgress: number;
  completionPct: number;
}

interface IssueLinkage {
  byRoadmapId: Map<string, Issue[]>;
  unmapped: Issue[];
  unknownTagged: Map<string, string[]>;
}

function extractRoadmapIds(text: string): string[] {
  const ids = new Set<string>();
  for (const match of text.matchAll(ROADMAP_ID_REGEX)) {
    const value = match[0]?.toUpperCase();
    if (value) ids.add(value);
  }
  return [...ids];
}

function issueRoadmapIds(issue: Issue): string[] {
  const blob = `${issue.title}\n${issue.description ?? ""}`;
  return extractRoadmapIds(blob);
}

function sortIssuesByUpdated(issues: Issue[]): Issue[] {
  return [...issues].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function summarizeLinkedIssues(issues: Issue[]): LinkedIssueSummary {
  if (issues.length === 0) {
    return {
      total: 0,
      active: 0,
      doneEquivalent: 0,
      blocked: 0,
      inProgress: 0,
      completionPct: 0,
    };
  }

  let doneEquivalent = 0;
  let blocked = 0;
  let inProgress = 0;

  for (const issue of issues) {
    if (issue.status === "done" || issue.status === "cancelled") {
      doneEquivalent += 1;
    }
    if (issue.status === "blocked") {
      blocked += 1;
    }
    if (issue.status === "in_progress" || issue.status === "in_review") {
      inProgress += 1;
    }
  }

  const active = issues.length - doneEquivalent;
  const completionPct = Math.round((doneEquivalent / issues.length) * 100);

  return {
    total: issues.length,
    active,
    doneEquivalent,
    blocked,
    inProgress,
    completionPct,
  };
}

function timelineBarTone(summary: LinkedIssueSummary, paused: boolean): string {
  if (summary.total > 0 && summary.doneEquivalent === summary.total) {
    return "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200";
  }
  if (paused) {
    return "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200";
  }
  if (summary.total === 0) {
    return "border-border bg-muted text-muted-foreground";
  }
  if (summary.blocked > 0) {
    return "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200";
  }
  if (summary.inProgress > 0) {
    return "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200";
  }
  return "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200";
}

function laneStatusLabel(summary: LinkedIssueSummary, paused: boolean): string {
  if (summary.total > 0 && summary.doneEquivalent === summary.total) return "Complete";
  if (paused) return "Paused";
  if (summary.total === 0) return "Empty";
  if (summary.blocked > 0) return `${summary.blocked} blocked`;
  return `${summary.active} open`;
}

function isUnplannedRoadmapItem(item: { id: string }): boolean {
  return item.id.toUpperCase() === UNPLANNED_ROADMAP_ID;
}

function resolveGroupingGoal(goalId: string | null | undefined, goalById: Map<string, Goal>): Goal | null {
  if (!goalId) return null;

  const chain: Goal[] = [];
  const seen = new Set<string>();
  let currentId: string | null | undefined = goalId;

  while (currentId && !seen.has(currentId)) {
    seen.add(currentId);
    const goal = goalById.get(currentId);
    if (!goal) break;
    chain.push(goal);
    currentId = goal.parentId;
  }

  for (let index = chain.length - 1; index >= 0; index -= 1) {
    if (chain[index]?.level !== "company") {
      return chain[index] ?? null;
    }
  }

  return chain[chain.length - 1] ?? null;
}

function compactGoalLabel(goal: Goal): string {
  const normalized = goal.title.replace(/\s+/g, " ").trim();
  if (normalized.length <= 56) return normalized;

  const sentence = normalized.split(/[.:]/)[0]?.trim();
  if (sentence && sentence.length > 0 && sentence.length <= 56) {
    return sentence;
  }

  return `${normalized.slice(0, 53).trimEnd()}...`;
}

function hashValue(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function epicTone(roadmapId: string): EpicTone {
  return EPIC_TONES[hashValue(roadmapId) % EPIC_TONES.length] ?? EPIC_TONES[0];
}

function epicState(summary: LinkedIssueSummary): EpicState {
  if (summary.total === 0) return "not_started";
  if (summary.blocked > 0) return "blocked";
  if (summary.doneEquivalent === summary.total) return "done";
  return "in_progress";
}

function issueIsDone(issue: Issue): boolean {
  return issue.status === "done" || issue.status === "cancelled";
}

function issueIsBlocked(issue: Issue): boolean {
  return issue.status === "blocked";
}

function roadmapLinkage(issues: Issue[], roadmapIds: Set<string>): IssueLinkage {
  const byRoadmapId = new Map<string, Issue[]>();
  const unmapped: Issue[] = [];
  const unknownTagged = new Map<string, string[]>();

  for (const issue of issues) {
    const ids = issueRoadmapIds(issue);
    const matchedIds = ids.filter((id) => roadmapIds.has(id));
    const unknownIds = ids.filter((id) => !roadmapIds.has(id));

    if (unknownIds.length > 0) {
      unknownTagged.set(issue.id, unknownIds);
    }

    if (matchedIds.length === 0) {
      unmapped.push(issue);
      continue;
    }

    for (const id of matchedIds) {
      const bucket = byRoadmapId.get(id);
      if (bucket) {
        bucket.push(issue);
      } else {
        byRoadmapId.set(id, [issue]);
      }
    }
  }

  for (const [id, linked] of byRoadmapId.entries()) {
    byRoadmapId.set(id, sortIssuesByUpdated(linked));
  }

  return {
    byRoadmapId,
    unmapped: sortIssuesByUpdated(unmapped),
    unknownTagged,
  };
}

function issueRef(issue: Issue): string {
  return issue.identifier ?? issue.id.slice(0, 8);
}

function issuePath(issue: Issue): string {
  return `/issues/${issue.identifier ?? issue.id}`;
}

export function Roadmap() {
  const { selectedCompanyId } = useCompany();
  const { openNewIssue } = useDialog();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const [selectedRoadmapId, setSelectedRoadmapId] = useState<string | null>(null);
  const [isRenamingSelectedItem, setIsRenamingSelectedItem] = useState(false);
  const [renameDraftTitle, setRenameDraftTitle] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [epicQuery, setEpicQuery] = useState("");
  const [epicStateFilter, setEpicStateFilter] = useState<EpicFilterState>("all");
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [showRoadmapContract, setShowRoadmapContract] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(ROADMAP_CONTRACT_EXPANDED_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    setBreadcrumbs([{ label: "Roadmap" }]);
  }, [setBreadcrumbs]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(ROADMAP_CONTRACT_EXPANDED_STORAGE_KEY, showRoadmapContract ? "1" : "0");
    } catch {
      // Ignore storage errors and keep UI functional.
    }
  }, [showRoadmapContract]);

  const roadmapQuery = useQuery({
    queryKey: queryKeys.roadmap(selectedCompanyId),
    queryFn: () => roadmapApi.get(selectedCompanyId),
    enabled: !!selectedCompanyId,
  });

  const issuesQuery = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId ?? ""),
    queryFn: () => issuesApi.list(selectedCompanyId!, { includeClosed: true }),
    enabled: !!selectedCompanyId,
  });

  const goalsQuery = useQuery({
    queryKey: queryKeys.goals.list(selectedCompanyId ?? ""),
    queryFn: () => goalsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const pausedEpicsQuery = useQuery({
    queryKey: queryKeys.companies.roadmapEpics(selectedCompanyId ?? ""),
    queryFn: () => companiesApi.listRoadmapEpics(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const pausedEpicIds = useMemo(
    () => new Set((pausedEpicsQuery.data?.pausedEpicIds ?? []).map((id) => id.toUpperCase())),
    [pausedEpicsQuery.data?.pausedEpicIds],
  );
  const isEpicPaused = (roadmapId: string) => pausedEpicIds.has(roadmapId.toUpperCase());

  const toggleEpicPauseMutation = useMutation({
    mutationFn: async ({ roadmapId, pause }: { roadmapId: string; pause: boolean }) => {
      if (!selectedCompanyId) throw new Error("No selected company");
      if (pause) {
        return companiesApi.pauseRoadmapEpic(selectedCompanyId, roadmapId);
      }
      return companiesApi.resumeRoadmapEpic(selectedCompanyId, roadmapId);
    },
    onSuccess: async () => {
      if (!selectedCompanyId) return;
      await queryClient.invalidateQueries({ queryKey: queryKeys.companies.roadmapEpics(selectedCompanyId) });
    },
  });

  const renameEpicMutation = useMutation({
    mutationFn: async ({ roadmapId, title }: { roadmapId: string; title: string }) => {
      return roadmapApi.renameItem(roadmapId, title, selectedCompanyId);
    },
    onSuccess: async (payload) => {
      if (selectedCompanyId) {
        if (payload?.roadmap && payload?.index) {
          queryClient.setQueryData(queryKeys.roadmap(selectedCompanyId), {
            roadmap: payload.roadmap,
            index: payload.index,
          });
        } else {
          await queryClient.invalidateQueries({ queryKey: queryKeys.roadmap(selectedCompanyId) });
        }
      }
      setRenameError(null);
      setIsRenamingSelectedItem(false);
    },
    onError: (error) => {
      setRenameError(error instanceof Error ? error.message : "Failed to rename roadmap item.");
    },
  });

  const issues = issuesQuery.data ?? [];
  const goals = goalsQuery.data ?? [];

  const timelineItems = useMemo<TimelineItem[]>(() => {
    if (!roadmapQuery.data) return [];
    return roadmapQuery.data.roadmap.sections.flatMap((section, sectionIndex) =>
      section.items.map((item) => ({
        ...item,
        sectionTitle: section.title,
        sectionIndex,
      })),
    );
  }, [roadmapQuery.data]);

  const displayTimelineItems = useMemo<TimelineItem[]>(() => {
    if (!roadmapQuery.data) return timelineItems;
    if (timelineItems.some((item) => item.id.toUpperCase() === UNPLANNED_ROADMAP_ID)) {
      return timelineItems;
    }

    const fallbackSectionIndex = Math.max(0, roadmapQuery.data.roadmap.sections.length - 1);
    return [
      ...timelineItems,
      {
        id: UNPLANNED_ROADMAP_ID,
        title: UNPLANNED_ROADMAP_TITLE,
        fields: [
          {
            key: "Purpose",
            value: "Execution work that does not cleanly map to a strategic roadmap item yet.",
          },
        ],
        sectionTitle: roadmapQuery.data.roadmap.sections[fallbackSectionIndex]?.title ?? "Roadmap",
        sectionIndex: fallbackSectionIndex,
      },
    ];
  }, [roadmapQuery.data, timelineItems]);

  const knownRoadmapIds = useMemo(
    () => new Set(displayTimelineItems.map((item) => item.id.toUpperCase())),
    [displayTimelineItems],
  );

  const goalById = useMemo(
    () => new Map(goals.map((goal) => [goal.id, goal])),
    [goals],
  );

  const linkage = useMemo(
    () => roadmapLinkage(issues, knownRoadmapIds),
    [issues, knownRoadmapIds],
  );

  const summaryByRoadmapId = useMemo(() => {
    const map = new Map<string, LinkedIssueSummary>();
    for (const item of displayTimelineItems) {
      map.set(item.id, summarizeLinkedIssues(linkage.byRoadmapId.get(item.id) ?? []));
    }
    return map;
  }, [displayTimelineItems, linkage.byRoadmapId]);

  const groupingGoalByRoadmapId = useMemo(() => {
    const map = new Map<string, Goal | null>();
    for (const item of displayTimelineItems) {
      const counts = new Map<string, number>();
      for (const issue of linkage.byRoadmapId.get(item.id) ?? []) {
        const groupingGoal = resolveGroupingGoal(issue.goal?.id ?? issue.goalId ?? null, goalById);
        if (!groupingGoal) continue;
        counts.set(groupingGoal.id, (counts.get(groupingGoal.id) ?? 0) + 1);
      }

      let selectedGoal: Goal | null = null;
      let selectedCount = -1;
      for (const [goalId, count] of counts.entries()) {
        if (count > selectedCount) {
          selectedGoal = goalById.get(goalId) ?? null;
          selectedCount = count;
        }
      }
      map.set(item.id, selectedGoal);
    }
    return map;
  }, [displayTimelineItems, linkage.byRoadmapId, goalById]);

  const sectionOptions = useMemo(
    () => [...new Set(displayTimelineItems.map((item) => item.sectionTitle))],
    [displayTimelineItems],
  );

  useEffect(() => {
    if (sectionFilter !== "all" && !sectionOptions.includes(sectionFilter)) {
      setSectionFilter("all");
    }
  }, [sectionFilter, sectionOptions]);

  const filteredTimelineItems = useMemo(() => {
    const query = epicQuery.trim().toLowerCase();

    const filtered = displayTimelineItems.filter((item) => {
      const summary = summaryByRoadmapId.get(item.id) ?? EMPTY_LINKED_ISSUE_SUMMARY;
      const state = epicState(summary);
      const isUnplanned = isUnplannedRoadmapItem(item);

      if (epicStateFilter !== "all" && state !== epicStateFilter) return false;
      if (sectionFilter !== "all" && item.sectionTitle !== sectionFilter) return false;
      if (quickFilter === "active" && state !== "in_progress") return false;
      if (quickFilter === "blocked" && state !== "blocked") return false;
      if (quickFilter === "unplanned" && !isUnplanned) return false;
      if (query.length > 0) {
        const haystack = `${item.id} ${item.title} ${item.sectionTitle}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      return true;
    });
    return filtered;
  }, [displayTimelineItems, epicQuery, epicStateFilter, sectionFilter, summaryByRoadmapId, quickFilter]);

  const hasManualFilters = useMemo(
    () =>
      quickFilter !== "all" ||
      epicQuery.trim().length > 0 ||
      epicStateFilter !== "all" ||
      sectionFilter !== "all",
    [quickFilter, epicQuery, epicStateFilter, sectionFilter],
  );

  function clearFilters() {
    setQuickFilter("all");
    setEpicQuery("");
    setEpicStateFilter("all");
    setSectionFilter("all");
  }

  const isDefaultOverview =
    quickFilter === "all" &&
    epicQuery.trim().length === 0 &&
    epicStateFilter === "all" &&
    sectionFilter === "all";

  const filteredInterruptLane = useMemo(
    () => filteredTimelineItems.find((item) => isUnplannedRoadmapItem(item)) ?? null,
    [filteredTimelineItems],
  );
  const filteredRoadmapItems = useMemo(
    () => filteredTimelineItems.filter((item) => !isUnplannedRoadmapItem(item)),
    [filteredTimelineItems],
  );
  const primaryRoadmapItems = useMemo(() => {
    if (!isDefaultOverview) return filteredRoadmapItems;
    return filteredRoadmapItems.filter((item) => {
      const state = epicState(summaryByRoadmapId.get(item.id) ?? EMPTY_LINKED_ISSUE_SUMMARY);
      return state === "in_progress" || state === "blocked";
    });
  }, [filteredRoadmapItems, isDefaultOverview, summaryByRoadmapId]);
  const collapsedPlannedItems = useMemo(() => {
    if (!isDefaultOverview) return [];
    return filteredRoadmapItems.filter((item) => {
      const state = epicState(summaryByRoadmapId.get(item.id) ?? EMPTY_LINKED_ISSUE_SUMMARY);
      return state === "not_started";
    });
  }, [filteredRoadmapItems, isDefaultOverview, summaryByRoadmapId]);
  const collapsedDoneItems = useMemo(() => {
    if (!isDefaultOverview) return [];
    return filteredRoadmapItems.filter((item) => {
      const state = epicState(summaryByRoadmapId.get(item.id) ?? EMPTY_LINKED_ISSUE_SUMMARY);
      return state === "done";
    });
  }, [filteredRoadmapItems, isDefaultOverview, summaryByRoadmapId]);
  const selectionCandidates = useMemo(() => {
    if (quickFilter === "unplanned") {
      return filteredInterruptLane ? [filteredInterruptLane] : [];
    }
    return [
      ...primaryRoadmapItems,
      ...collapsedPlannedItems,
      ...collapsedDoneItems,
      ...(filteredInterruptLane ? [filteredInterruptLane] : []),
    ];
  }, [quickFilter, filteredInterruptLane, primaryRoadmapItems, collapsedPlannedItems, collapsedDoneItems]);

  useEffect(() => {
    if (selectionCandidates.length === 0) {
      setSelectedRoadmapId(null);
      return;
    }
    if (selectedRoadmapId && selectionCandidates.some((item) => item.id === selectedRoadmapId)) {
      return;
    }
    setSelectedRoadmapId(selectionCandidates[0]?.id ?? null);
  }, [selectionCandidates, selectedRoadmapId]);

  const selectedTimelineItem = filteredTimelineItems.find((item) => item.id === selectedRoadmapId) ?? null;
  const selectedTimelineItemIsUnplanned = selectedTimelineItem?.id.toUpperCase() === UNPLANNED_ROADMAP_ID;

  useEffect(() => {
    if (!selectedTimelineItem || selectedTimelineItemIsUnplanned) {
      setIsRenamingSelectedItem(false);
      setRenameDraftTitle("");
      setRenameError(null);
      return;
    }
    setRenameDraftTitle(selectedTimelineItem.title);
    setRenameError(null);
  }, [selectedTimelineItem?.id, selectedTimelineItem?.title, selectedTimelineItemIsUnplanned]);

  if (!selectedCompanyId) {
    return <EmptyState icon={Flag} message="Select a company to view its roadmap." />;
  }

  if (roadmapQuery.isLoading) {
    return <PageSkeleton variant="list" />;
  }

  if (roadmapQuery.error) {
    return (
      <EmptyState
        icon={Flag}
        message={roadmapQuery.error instanceof Error ? roadmapQuery.error.message : "Failed to load roadmap."}
      />
    );
  }

  if (!roadmapQuery.data) {
    return <EmptyState icon={Flag} message="Roadmap is not available yet." />;
  }

  const { roadmap, index } = roadmapQuery.data;
  const selectedItem = selectedTimelineItem;
  const selectedIssues = selectedItem ? (linkage.byRoadmapId.get(selectedItem.id) ?? []) : [];
  const selectedSummary = selectedItem
    ? (summaryByRoadmapId.get(selectedItem.id) ?? EMPTY_LINKED_ISSUE_SUMMARY)
    : EMPTY_LINKED_ISSUE_SUMMARY;
  const selectedEpicPaused = selectedItem ? isEpicPaused(selectedItem.id) : false;
  const selectedEpicComplete = selectedSummary.total > 0 && selectedSummary.doneEquivalent === selectedSummary.total;
  const selectedTone = selectedItem ? epicTone(selectedItem.id) : null;
  const selectedIsUnplanned = selectedItem?.id.toUpperCase() === UNPLANNED_ROADMAP_ID;
  const selectedGroupingGoal = selectedItem ? groupingGoalByRoadmapId.get(selectedItem.id) ?? null : null;
  const selectedStatus =
    selectedSummary.total === 0
      ? "planned"
      : selectedSummary.blocked > 0
        ? "blocked"
        : selectedSummary.active > 0
          ? "in_progress"
          : "done";
  const selectedOpenIssues = selectedIssues.filter((issue) => !issueIsDone(issue));
  const selectedPreviewIssues = selectedOpenIssues;
  const selectedOverviewField = selectedItem
    ? selectedItem.fields.find((field) => {
        const normalizedKey = field.key.trim().toLowerCase();
        return normalizedKey === "purpose" || normalizedKey === "outcome" || normalizedKey === "scope";
      }) ??
      selectedItem.fields.find((field) => {
        const normalizedKey = field.key.trim().toLowerCase();
        return normalizedKey !== "linked tickets" && normalizedKey !== "status";
      })
    : null;
  const selectedDetailFields = selectedItem
    ? selectedItem.fields.filter((field) => {
        const normalizedKey = field.key.trim().toLowerCase();
        if (normalizedKey === "linked tickets" || normalizedKey === "status") return false;
        if (!selectedOverviewField) return true;
        return field.key !== selectedOverviewField.key || field.value !== selectedOverviewField.value;
      })
    : [];

  const strategicRoadmapItems = displayTimelineItems.filter((item) => !isUnplannedRoadmapItem(item));
  const activeLaneCount = strategicRoadmapItems.reduce((count, item) => {
    const state = epicState(summaryByRoadmapId.get(item.id) ?? EMPTY_LINKED_ISSUE_SUMMARY);
    return state === "in_progress" ? count + 1 : count;
  }, 0);
  const blockedLaneCount = strategicRoadmapItems.reduce((count, item) => {
    const state = epicState(summaryByRoadmapId.get(item.id) ?? EMPTY_LINKED_ISSUE_SUMMARY);
    return state === "blocked" ? count + 1 : count;
  }, 0);
  const nextSectionIndex = roadmap.sections.findIndex((section) => section.title.toLowerCase().includes("next"));
  const nextLaneCount = nextSectionIndex >= 0
    ? strategicRoadmapItems.reduce((count, item) => {
        if (item.sectionIndex !== nextSectionIndex) return count;
        const state = epicState(summaryByRoadmapId.get(item.id) ?? EMPTY_LINKED_ISSUE_SUMMARY);
        return state === "done" ? count : count + 1;
      }, 0)
    : 0;
  const interruptIssueCount = summaryByRoadmapId.get(UNPLANNED_ROADMAP_ID)?.total ?? 0;

  const sectionCount = Math.max(1, roadmap.sections.length);
  const timelineColumns = `repeat(${sectionCount}, minmax(8rem, 1fr))`;
  const rowColumns = "minmax(17rem, 22rem) minmax(34rem, 1fr)";

  const canShowIssueLinkage = Boolean(selectedCompanyId);
  const unmappedIssues = linkage.unmapped;
  const canRenameSelectedItem = Boolean(selectedItem && !selectedIsUnplanned);
  const trimmedRenameDraft = renameDraftTitle.trim();
  const renameSaveDisabled =
    !selectedItem ||
    !canRenameSelectedItem ||
    trimmedRenameDraft.length === 0 ||
    trimmedRenameDraft === selectedItem.title ||
    renameEpicMutation.isPending;

  function startRenamingSelectedItem() {
    if (!selectedItem || selectedIsUnplanned) return;
    setRenameDraftTitle(selectedItem.title);
    setRenameError(null);
    setIsRenamingSelectedItem(true);
  }

  function cancelRenamingSelectedItem() {
    setIsRenamingSelectedItem(false);
    setRenameDraftTitle(selectedItem?.title ?? "");
    setRenameError(null);
  }

  function saveRenamedSelectedItem() {
    if (!selectedItem || renameSaveDisabled) return;
    void renameEpicMutation.mutate({
      roadmapId: selectedItem.id,
      title: trimmedRenameDraft,
    });
  }

  const renderTimelineRows = (items: TimelineItem[]) => (
    <>
      {items.map((item) => {
        const summary = summaryByRoadmapId.get(item.id) ?? EMPTY_LINKED_ISSUE_SUMMARY;
        const selected = item.id === selectedRoadmapId;
        const tone = epicTone(item.id);
        const paused = isEpicPaused(item.id);
        const complete = summary.total > 0 && summary.doneEquivalent === summary.total;
        const isUnplanned = isUnplannedRoadmapItem(item);
        const groupingGoal = groupingGoalByRoadmapId.get(item.id) ?? null;
        const barLeft = `calc((100% / ${sectionCount}) * ${item.sectionIndex} + 0.25rem)`;
        const barWidth = `calc(100% / ${sectionCount} - 0.5rem)`;

        return (
          <div key={item.id} className="grid gap-3" style={{ gridTemplateColumns: rowColumns }}>
            <button
              type="button"
              onClick={() => setSelectedRoadmapId(item.id)}
              className={cn(
                "relative overflow-hidden rounded-md border px-3 py-2 text-left transition-colors",
                selected
                  ? "border-foreground/50 bg-accent/45 shadow-sm ring-1 ring-foreground/20"
                  : isUnplanned
                    ? "border-amber-300/70 bg-amber-50/50 hover:bg-amber-50 dark:border-amber-800/70 dark:bg-amber-950/25 dark:hover:bg-amber-950/35"
                    : "border-border bg-background hover:bg-accent/20",
              )}
            >
              {selected && <span className={cn("absolute left-0 top-0 h-full w-1.5", tone.dot)} />}
              <div className="flex items-center gap-2">
                <span className={cn("h-2.5 w-2.5 rounded-full", tone.dot)} />
                <span className={cn("rounded border px-1.5 py-0.5 font-mono text-[11px]", tone.badge)}>
                  {item.id}
                </span>
                {paused && !complete && (
                  <span className="inline-flex items-center gap-1 rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200">
                    <Pause className="h-3 w-3" />
                    Paused
                  </span>
                )}
                <span className="text-sm font-medium leading-tight whitespace-normal">{item.title}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted-foreground">{laneStatusLabel(summary, paused)}</span>
                {groupingGoal && (
                  <span
                    className="inline-flex max-w-[18rem] items-center rounded-full border border-border bg-muted/30 px-2 py-0.5 text-muted-foreground"
                    title={groupingGoal.title}
                  >
                    {compactGoalLabel(groupingGoal)}
                  </span>
                )}
              </div>
            </button>

            <div className={cn("relative h-12 rounded-md border bg-muted/20", selected && "border-foreground/30")}>
              <div className="absolute inset-0 grid" style={{ gridTemplateColumns: timelineColumns }}>
                {roadmap.sections.map((section, indexPos) => (
                  <div
                    key={`${item.id}:${section.title}`}
                    className={cn("border-l border-border/60", indexPos === 0 && "border-l-0")}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => setSelectedRoadmapId(item.id)}
                className={cn(
                  "absolute top-1 bottom-1 inline-flex items-center gap-2 rounded-md border px-2 text-xs font-medium transition-shadow",
                  timelineBarTone(summary, paused),
                  selected && "ring-2 ring-foreground/15",
                )}
                style={{ left: barLeft, width: barWidth }}
                title={`${item.id} · ${item.title}`}
              >
                <span className={cn("h-2 w-2 rounded-full shrink-0", tone.dot)} />
                <span>{laneStatusLabel(summary, paused)}</span>
              </button>
            </div>
          </div>
        );
      })}
    </>
  );

  return (
    <div className="space-y-4">
      <section className="border border-border bg-card px-4 py-3 md:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold">{roadmap.title}</h2>
              {roadmap.status && <StatusBadge status={roadmap.status} />}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {activeLaneCount} active · {blockedLaneCount} blocked · {nextLaneCount} next · {interruptIssueCount} interrupts
              {roadmap.lastUpdated ? ` · updated ${roadmap.lastUpdated}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {roadmap.contract.length > 0 && (
              <button
                type="button"
                onClick={() => setShowRoadmapContract((current) => !current)}
                className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent/40 hover:text-foreground"
              >
                {showRoadmapContract ? "Hide Rules" : "Show Rules"}
              </button>
            )}
          </div>
        </div>
        {showRoadmapContract && roadmap.contract.length > 0 && (
          <ol className="mt-3 list-decimal space-y-1 rounded-md border border-border bg-muted/20 p-3 pl-7 text-sm text-foreground/90">
            {roadmap.contract.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ol>
        )}
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2.1fr)_340px]">
        <section className="border border-border bg-card p-4 md:p-5">
          {!canShowIssueLinkage && (
            <p className="text-sm text-muted-foreground">
              Select a company to see issue linkage for each roadmap item.
            </p>
          )}

          {issuesQuery.error && (
            <p className="text-sm text-destructive">
              {issuesQuery.error instanceof Error ? issuesQuery.error.message : "Failed to load issues."}
            </p>
          )}

          {displayTimelineItems.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={epicQuery}
                  onChange={(event) => {
                    setQuickFilter("all");
                    setEpicQuery(event.target.value);
                  }}
                  placeholder="Search roadmap lanes"
                  aria-label="Filter epics"
                  className="min-w-[18rem] flex-1"
                />
                <button
                  type="button"
                  onClick={() => setQuickFilter("all")}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs",
                    quickFilter === "all"
                      ? "border-foreground/30 bg-accent/40 text-foreground"
                      : "border-border text-muted-foreground hover:bg-accent/30 hover:text-foreground",
                  )}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setQuickFilter("active")}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs",
                    quickFilter === "active"
                      ? "border-foreground/30 bg-accent/40 text-foreground"
                      : "border-border text-muted-foreground hover:bg-accent/30 hover:text-foreground",
                  )}
                >
                  Active
                </button>
                <button
                  type="button"
                  onClick={() => setQuickFilter("blocked")}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs",
                    quickFilter === "blocked"
                      ? "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
                      : "border-border text-muted-foreground hover:bg-accent/30 hover:text-foreground",
                  )}
                >
                  Blocked
                </button>
                <button
                  type="button"
                  onClick={() => setQuickFilter("unplanned")}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs",
                    quickFilter === "unplanned"
                      ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                      : "border-border text-muted-foreground hover:bg-accent/30 hover:text-foreground",
                  )}
                >
                  Unplanned
                </button>
                <details className="rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground">
                  <summary className="cursor-pointer select-none">Filters</summary>
                  <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(10rem,1fr)_minmax(10rem,1fr)_auto]">
                    <select
                      className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                      value={epicStateFilter}
                      onChange={(event) => {
                        setQuickFilter("all");
                        setEpicStateFilter(event.target.value as EpicFilterState);
                      }}
                      aria-label="Epic status filter"
                    >
                      <option value="all">All states</option>
                      <option value="in_progress">In progress</option>
                      <option value="blocked">Blocked</option>
                      <option value="done">Done</option>
                      <option value="not_started">No linked issues</option>
                    </select>
                    <select
                      className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                      value={sectionFilter}
                      onChange={(event) => {
                        setQuickFilter("all");
                        setSectionFilter(event.target.value);
                      }}
                      aria-label="Epic section filter"
                    >
                      <option value="all">All sections</option>
                      {sectionOptions.map((title) => (
                        <option key={title} value={title}>
                          {title}
                        </option>
                      ))}
                    </select>
                    <div className="h-8" />
                  </div>
                </details>
                {hasManualFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="px-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          )}

          {displayTimelineItems.length === 0 ? (
            <div className="mt-4">
              <EmptyState icon={Flag} message="Roadmap items are not defined yet." />
            </div>
          ) : filteredTimelineItems.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No roadmap epics match the current filters.
            </p>
          ) : (
            <div className="mt-4">
              {filteredInterruptLane && (
                <button
                  type="button"
                  onClick={() => setSelectedRoadmapId(filteredInterruptLane.id)}
                  className={cn(
                    "mb-3 flex w-full items-center justify-between rounded-md border px-3 py-2 text-left transition-colors",
                    selectedRoadmapId === filteredInterruptLane.id
                      ? "border-amber-300 bg-amber-50/70 ring-1 ring-amber-300/40 dark:border-amber-800 dark:bg-amber-950/30"
                      : "border-amber-300/60 bg-amber-50/40 hover:bg-amber-50/60 dark:border-amber-800/70 dark:bg-amber-950/20 dark:hover:bg-amber-950/30",
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                        Interrupts
                      </span>
                      <span className="rounded border border-amber-300 px-1.5 py-0.5 font-mono text-[11px] text-amber-800 dark:border-amber-800 dark:text-amber-200">
                        {filteredInterruptLane.id}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-foreground">{filteredInterruptLane.title}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      {summaryByRoadmapId.get(filteredInterruptLane.id)?.total ?? 0} interrupt issues
                    </p>
                    <p className="text-xs text-amber-800/80 dark:text-amber-200/80">
                      {laneStatusLabel(
                        summaryByRoadmapId.get(filteredInterruptLane.id) ?? EMPTY_LINKED_ISSUE_SUMMARY,
                        isEpicPaused(filteredInterruptLane.id),
                      )}
                    </p>
                  </div>
                </button>
              )}
              <div className="overflow-x-auto">
                <div className="min-w-[860px] space-y-3">
                  <div className="grid gap-3" style={{ gridTemplateColumns: rowColumns }}>
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Roadmap item</div>
                    <div className="grid gap-1" style={{ gridTemplateColumns: timelineColumns }}>
                      {roadmap.sections.map((section) => (
                        <div key={section.title} className="rounded-sm border border-border bg-muted/40 px-2 py-1 text-[11px] font-medium text-muted-foreground">
                          {section.title}
                        </div>
                      ))}
                    </div>
                  </div>

                  {primaryRoadmapItems.length > 0 ? (
                    <div className="space-y-2">{renderTimelineRows(primaryRoadmapItems)}</div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No strategic lanes require attention in the current view.</p>
                  )}

                  {collapsedPlannedItems.length > 0 && (
                    <details className="rounded-md border border-border bg-background/40">
                      <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-muted-foreground">
                        Planned Lanes ({collapsedPlannedItems.length})
                      </summary>
                      <div className="border-t border-border p-3">
                        <div className="space-y-2">{renderTimelineRows(collapsedPlannedItems)}</div>
                      </div>
                    </details>
                  )}

                  {collapsedDoneItems.length > 0 && (
                    <details className="rounded-md border border-border bg-background/40">
                      <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-muted-foreground">
                        Complete Lanes ({collapsedDoneItems.length})
                      </summary>
                      <div className="border-t border-border p-3">
                        <div className="space-y-2">{renderTimelineRows(collapsedDoneItems)}</div>
                      </div>
                    </details>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="h-fit border border-border bg-card p-4 md:p-5 xl:sticky xl:top-16">
          {selectedItem ? (
            <>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("h-2.5 w-2.5 rounded-full", selectedTone?.dot)} />
                    <span className={cn("rounded border px-1.5 py-0.5 font-mono text-xs", selectedTone?.badge)}>
                      {selectedItem.id}
                    </span>
                    {selectedEpicPaused && !selectedEpicComplete && (
                      <span className="inline-flex items-center gap-1 rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200">
                        <Pause className="h-3 w-3" />
                        Paused
                      </span>
                    )}
                    {isRenamingSelectedItem && canRenameSelectedItem ? (
                      <div className="flex min-w-[16rem] flex-1 flex-wrap items-center gap-2">
                        <Input
                          value={renameDraftTitle}
                          onChange={(event) => {
                            setRenameDraftTitle(event.target.value);
                            if (renameError) setRenameError(null);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              saveRenamedSelectedItem();
                            }
                            if (event.key === "Escape") {
                              event.preventDefault();
                              cancelRenamingSelectedItem();
                            }
                          }}
                          aria-label="Epic title"
                          className="h-8 min-w-[16rem] flex-1"
                        />
                        <Button size="sm" onClick={saveRenamedSelectedItem} disabled={renameSaveDisabled}>
                          {renameEpicMutation.isPending ? "Saving..." : "Save"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelRenamingSelectedItem} disabled={renameEpicMutation.isPending}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <span className="text-sm font-medium leading-tight whitespace-normal">{selectedItem.title}</span>
                    )}
                  </div>
                  {!isRenamingSelectedItem && canRenameSelectedItem && (
                    <div className="mt-2">
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={startRenamingSelectedItem}>
                        Rename
                      </Button>
                    </div>
                  )}
                  {selectedGroupingGoal && (
                    <div className="mt-2">
                      <span
                        className="inline-flex max-w-full items-center rounded-full border border-border bg-muted/30 px-2 py-0.5 text-xs text-muted-foreground"
                        title={selectedGroupingGoal.title}
                      >
                        {compactGoalLabel(selectedGroupingGoal)}
                      </span>
                    </div>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {selectedSummary.total} linked · {selectedSummary.active} open · {selectedSummary.doneEquivalent} done
                    {selectedSummary.blocked > 0 ? ` · ${selectedSummary.blocked} blocked` : ""}
                  </p>
                  {renameError && (
                    <p className="mt-2 text-xs text-destructive">{renameError}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={selectedStatus} />
                  {selectedEpicComplete ? (
                    <span className="inline-flex items-center rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                      Epic complete
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant={selectedEpicPaused ? "default" : "ghost"}
                      disabled={toggleEpicPauseMutation.isPending}
                      onClick={() => {
                        void toggleEpicPauseMutation.mutate({
                          roadmapId: selectedItem.id,
                          pause: !selectedEpicPaused,
                        });
                      }}
                    >
                      {selectedEpicPaused ? (
                        <>
                          <Play className="mr-1 h-3.5 w-3.5" />
                          Resume
                        </>
                      ) : (
                        <>
                          <Pause className="mr-1 h-3.5 w-3.5" />
                          Pause
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
              {selectedEpicPaused && !selectedEpicComplete && (
                <p className="mt-2 rounded-md border border-slate-300 bg-slate-100 px-2.5 py-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200">
                  Execution wakeups for issues linked to this epic are held until you resume the epic.
                </p>
              )}
              {selectedIsUnplanned && (
                <p className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                  This lane tracks interrupt work. Backfill each issue to a planned roadmap item or promote a new roadmap item.
                </p>
              )}

              {selectedOverviewField && (
                <div className="mt-3 rounded-md border border-border bg-muted/20 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{selectedOverviewField.key}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{selectedOverviewField.value}</p>
                </div>
              )}

              {selectedDetailFields.length > 0 && (
                <details className="mt-3 rounded-md border border-border px-3 py-2">
                  <summary className="cursor-pointer text-xs font-medium text-muted-foreground">More details</summary>
                  <dl className="mt-3 grid gap-2 text-sm">
                    {selectedDetailFields.map((field) => (
                      <div key={`${selectedItem.id}:${field.key}`} className="flex flex-wrap gap-2">
                        <dt className="font-medium text-foreground/90">{field.key}:</dt>
                        <dd className="text-muted-foreground">{field.value}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              )}

              <div className="mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openNewIssue({
                    title: `[${selectedItem.id}] `,
                    description: `Roadmap Item ID: ${selectedItem.id}\nRoadmap Item: ${selectedItem.title}\n\nExit Criteria:\n- `,
                  })}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Create Linked Issue
                </Button>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Open Issues</h4>
                  <Link
                    to={`/issues?q=${encodeURIComponent(selectedItem.id)}`}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    View all
                  </Link>
                </div>
                {issuesQuery.isLoading ? (
                  <p className="mt-2 text-sm text-muted-foreground">Loading linked issues...</p>
                ) : selectedIssues.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    No issues linked yet. Include <span className="font-mono">{selectedItem.id}</span> in issue title or description.
                  </p>
                ) : selectedPreviewIssues.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">No open issues in this lane.</p>
                ) : (
                  <ul className="mt-2 divide-y divide-border border border-border">
                    {selectedPreviewIssues.slice(0, ISSUE_PREVIEW_LIMIT).map((issue) => (
                      <li key={issue.id}>
                        <Link to={issuePath(issue)} className="block px-3 py-2 hover:bg-accent/40">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium">{issue.title}</div>
                              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="font-mono">{issueRef(issue)}</span>
                                <span>{formatIssueStatusLabel(issue.status)}</span>
                                <span>{timeAgo(issue.updatedAt)}</span>
                              </div>
                            </div>
                            <StatusBadge status={issue.status} />
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                {selectedPreviewIssues.length > ISSUE_PREVIEW_LIMIT && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Showing {ISSUE_PREVIEW_LIMIT} of {selectedPreviewIssues.length} open issues.
                  </p>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Select a roadmap item to inspect linked execution work.</p>
          )}
        </section>
      </div>

      <details className="border border-border bg-card p-4 md:p-5">
        <summary className="cursor-pointer text-sm font-medium">Roadmap Admin</summary>
        <div className="mt-4 space-y-5">
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Roadmap Source</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              <span className="font-mono">{roadmap.path}</span>
            </p>
          </section>

          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Unmapped Issues</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Issues without a valid roadmap ID are execution debt and should be triaged quickly.
            </p>

            {issuesQuery.isLoading ? (
              <p className="mt-3 text-sm text-muted-foreground">Loading issues...</p>
            ) : unmappedIssues.length === 0 ? (
              <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">
                Every loaded issue is mapped to a roadmap item.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-border border border-border">
                {unmappedIssues.slice(0, 12).map((issue) => {
                  const unknownIds = linkage.unknownTagged.get(issue.id) ?? [];
                  return (
                    <li key={issue.id}>
                      <Link to={issuePath(issue)} className="block px-3 py-2 hover:bg-accent/40">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{issue.title}</div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span className="font-mono">{issueRef(issue)}</span>
                              <span>{timeAgo(issue.updatedAt)}</span>
                              {unknownIds.length > 0 ? (
                                <span className="text-amber-700 dark:text-amber-300">
                                  Unknown ID: {unknownIds.join(", ")}
                                </span>
                              ) : (
                                <span>No roadmap ID detected</span>
                              )}
                            </div>
                          </div>
                          <StatusBadge status={issue.status} />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}

            {unmappedIssues.length > 12 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Showing 12 of {unmappedIssues.length} unmapped issues.
              </p>
            )}
          </section>

          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Roadmap Index</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Source: <span className="font-mono">{index.path}</span>
            </p>
            {index.links.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm">
                {index.links.map((link) => (
                  <li key={`${link.label}:${link.path}`} className="text-muted-foreground">
                    <span className="font-medium text-foreground/90">{link.label}</span>
                    <span className="mx-2 text-border">-</span>
                    <span className="font-mono text-xs">{link.path}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Raw Roadmap Markdown</h3>
            <div className="mt-3">
              <MarkdownBody>{roadmap.markdown}</MarkdownBody>
            </div>
          </section>
        </div>
      </details>
    </div>
  );
}
