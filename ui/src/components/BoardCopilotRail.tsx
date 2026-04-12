import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, PanelRightClose, PanelRightOpen } from "lucide-react";
import type { Agent, IssueComment } from "@paperclipai/shared";
import { useLocation } from "@/lib/router";
import { useCompany } from "../context/CompanyContext";
import { useToast } from "../context/ToastContext";
import { activityApi } from "../api/activity";
import { copilotApi } from "../api/copilot";
import { heartbeatsApi } from "../api/heartbeats";
import { issuesApi } from "../api/issues";
import { authApi } from "../api/auth";
import { agentsApi } from "../api/agents";
import { buildCopilotRouteContext, extractContextIssueRef } from "../lib/copilot-route-context";
import { extractIssueTimelineEvents } from "../lib/issue-timeline-events";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { IssueChatThread } from "./IssueChatThread";

const STORAGE_KEY = "paperclip:board-copilot-visible";
const CONTEXT_BLOCK_PREFIX = "<!-- paperclip:board-copilot-context";

function readPreference() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === null ? true : raw === "true";
  } catch {
    return true;
  }
}

function writePreference(value: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // Ignore storage failures in restricted browser contexts.
  }
}

function stripCopilotContext(body: string) {
  if (!body.startsWith(CONTEXT_BLOCK_PREFIX)) return body;
  const markerEnd = body.indexOf("-->");
  if (markerEnd < 0) return body;
  return body.slice(markerEnd + 3).replace(/^\s+/, "");
}

function contextLabel(pageKind: string, entityType?: string | null, entityId?: string | null) {
  if (entityType && entityId) {
    return `${entityType.replace(/_/g, " ")}: ${entityId}`;
  }
  return pageKind.replace(/_/g, " ");
}

export function BoardCopilotRail() {
  const { selectedCompanyId } = useCompany();
  const { pushToast } = useToast();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [visible, setVisible] = useState(readPreference);

  const routeContext = useMemo(
    () => buildCopilotRouteContext(location.pathname, location.search),
    [location.pathname, location.search],
  );
  const contextIssueRef = useMemo(
    () => extractContextIssueRef(location.pathname, location.search),
    [location.pathname, location.search],
  );
  const copilotEnabledForRoute = Boolean(selectedCompanyId) && routeContext.pageKind !== "instance";

  const threadQuery = useQuery({
    queryKey: [...queryKeys.copilot.thread(selectedCompanyId ?? "__none__"), contextIssueRef ?? "__none__"],
    queryFn: () =>
      copilotApi.getThread(selectedCompanyId!, {
        contextIssueId: contextIssueRef,
      }),
    enabled: copilotEnabledForRoute,
  });

  const threadIssueId = threadQuery.data?.issueId ?? null;

  const commentsQuery = useQuery({
    queryKey: queryKeys.issues.comments(threadIssueId ?? "__none__"),
    queryFn: () => issuesApi.listComments(threadIssueId!),
    enabled: Boolean(threadIssueId),
    refetchInterval: 4000,
  });

  const runsQuery = useQuery({
    queryKey: queryKeys.issues.runs(threadIssueId ?? "__none__"),
    queryFn: () => activityApi.runsForIssue(threadIssueId!),
    enabled: Boolean(threadIssueId),
    refetchInterval: 5000,
  });

  const activityQuery = useQuery({
    queryKey: queryKeys.issues.activity(threadIssueId ?? "__none__"),
    queryFn: () => activityApi.forIssue(threadIssueId!),
    enabled: Boolean(threadIssueId),
    refetchInterval: 5000,
  });

  const liveRunsQuery = useQuery({
    queryKey: queryKeys.issues.liveRuns(threadIssueId ?? "__none__"),
    queryFn: () => heartbeatsApi.liveRunsForIssue(threadIssueId!),
    enabled: Boolean(threadIssueId),
    refetchInterval: 3000,
  });

  const activeRunQuery = useQuery({
    queryKey: queryKeys.issues.activeRun(threadIssueId ?? "__none__"),
    queryFn: () => heartbeatsApi.activeRunForIssue(threadIssueId!),
    enabled: Boolean(threadIssueId),
    refetchInterval: 3000,
  });

  const agentsQuery = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId ?? "__none__"),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: copilotEnabledForRoute,
  });

  const sessionQuery = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
    enabled: copilotEnabledForRoute,
  });

  const sendMessage = useMutation({
    mutationFn: async (body: string) => {
      if (!selectedCompanyId) throw new Error("No company selected");
      return copilotApi.sendMessage(selectedCompanyId, {
        body,
        context: routeContext,
      });
    },
    onSuccess: async (result) => {
      if (result.wakeup.warning) {
        pushToast({
          title: "Copilot wakeup warning",
          body: result.wakeup.warning,
          tone: "warn",
        });
      }
      if (!threadIssueId) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.issues.comments(threadIssueId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.issues.activity(threadIssueId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.issues.runs(threadIssueId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.issues.liveRuns(threadIssueId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.issues.activeRun(threadIssueId) }),
      ]);
    },
    onError: (error) => {
      pushToast({
        title: "Unable to send copilot message",
        body: error instanceof Error ? error.message : "Request failed",
        tone: "error",
      });
    },
  });

  const cancelRun = useMutation({
    mutationFn: (runId: string) => heartbeatsApi.cancel(runId),
    onSuccess: async () => {
      if (!threadIssueId) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.issues.liveRuns(threadIssueId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.issues.activeRun(threadIssueId) }),
      ]);
    },
  });

  const agentMap = useMemo(() => {
    const map = new Map<string, Agent>();
    for (const agent of agentsQuery.data ?? []) {
      map.set(agent.id, agent);
    }
    return map;
  }, [agentsQuery.data]);

  const timelineEvents = useMemo(
    () => extractIssueTimelineEvents(activityQuery.data),
    [activityQuery.data],
  );

  const comments = useMemo(
    () =>
      (commentsQuery.data ?? []).map((comment: IssueComment) => ({
        ...comment,
        body: stripCopilotContext(comment.body),
      })),
    [commentsQuery.data],
  );

  const currentUserId = sessionQuery.data?.user?.id ?? sessionQuery.data?.session?.userId ?? null;
  const runningRun =
    activeRunQuery.data?.status === "running"
      ? activeRunQuery.data
      : (liveRunsQuery.data ?? []).find((run) => run.status === "running") ?? null;

  if (!copilotEnabledForRoute) return null;

  return (
    <aside
      className={cn(
        "hidden md:flex border-l border-border bg-card flex-col shrink-0 overflow-hidden transition-[width] duration-200 ease-in-out",
        visible ? "w-[420px]" : "w-12",
      )}
    >
      {!visible ? (
        <div className="flex h-full items-start justify-center pt-2">
          <Button
            variant="ghost"
            size="icon-xs"
            title="Open board copilot"
            onClick={() => {
              setVisible(true);
              writePreference(true);
            }}
          >
            <PanelRightOpen className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex h-full min-w-[420px] flex-col">
          <div className="border-b border-border px-3 py-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Board Copilot</span>
              <Button
                variant="ghost"
                size="icon-xs"
                className="ml-auto"
                title="Collapse board copilot"
                onClick={() => {
                  setVisible(false);
                  writePreference(false);
                }}
              >
                <PanelRightClose className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Context: {contextLabel(routeContext.pageKind, routeContext.entityType, routeContext.entityId)}
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-3">
              {threadQuery.isLoading ? (
                <p className="text-xs text-muted-foreground">Preparing copilot thread…</p>
              ) : threadQuery.error ? (
                <p className="text-xs text-destructive">
                  {threadQuery.error instanceof Error ? threadQuery.error.message : "Failed to load copilot thread"}
                </p>
              ) : !threadIssueId ? (
                <p className="text-xs text-muted-foreground">No thread available.</p>
              ) : (
                <IssueChatThread
                  comments={comments}
                  linkedRuns={runsQuery.data ?? []}
                  timelineEvents={timelineEvents}
                  liveRuns={liveRunsQuery.data ?? []}
                  activeRun={activeRunQuery.data ?? null}
                  companyId={selectedCompanyId}
                  issueStatus={threadQuery.data?.issueStatus}
                  agentMap={agentMap}
                  currentUserId={currentUserId}
                  draftKey={`paperclip:board-copilot-draft:${threadIssueId}`}
                  emptyMessage="Ask the board copilot to review this page, summarize status, or clean up board state."
                  submitHotkey="enter"
                  onAdd={async (body) => {
                    await sendMessage.mutateAsync(body);
                  }}
                  onCancelRun={runningRun ? async () => cancelRun.mutateAsync(runningRun.id) : undefined}
                />
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </aside>
  );
}
