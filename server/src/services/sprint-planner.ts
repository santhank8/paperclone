import type {
  SprintPlannerConfig,
  SprintPlannerSprint,
  SprintPlannerTask,
  SprintPlannerTicket,
  SprintPlannerStats,
  SprintPlannerKnowledgeItem,
  SprintPlannerActivityEntry,
  SprintPlannerCapacity,
} from "@paperclipai/shared";

/**
 * Sprint planner API client. Wraps the external sprint planner REST API.
 * READ operations span all teams; WRITE operations are scoped to the AI team.
 */
export function sprintPlannerService(config: SprintPlannerConfig) {
  const { apiUrl, token, aiTeamId } = config;

  const REQUEST_TIMEOUT_MS = 15_000;

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${apiUrl}${path}`, {
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(init?.headers as Record<string, string> | undefined),
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Sprint Planner API ${res.status}: ${body}`);
    }
    return res.json() as Promise<T>;
  }

  return {
    // ── READ (all teams) ──────────────────────────────────────────

    getCurrentSprint: (teamId?: string) =>
      request<SprintPlannerSprint>(
        `/api/sprints/current${teamId ? `?teamId=${encodeURIComponent(teamId)}` : ""}`,
      ),

    getSprintTasks: (sprintId: string, filters?: { status?: string; assigneeId?: string }) => {
      const params = new URLSearchParams({ sprintId });
      if (filters?.status) params.set("status", filters.status);
      if (filters?.assigneeId) params.set("assigneeId", filters.assigneeId);
      return request<SprintPlannerTask[]>(`/api/tasks?${params}`);
    },

    getTask: (taskId: string) =>
      request<SprintPlannerTask>(`/api/tasks/${encodeURIComponent(taskId)}`),

    getBacklog: () => request<SprintPlannerTask[]>("/api/tasks/backlog"),

    getSprintStats: (sprintId: string) =>
      request<SprintPlannerStats>(`/api/sprints/${encodeURIComponent(sprintId)}/stats`),

    searchKnowledge: (query: string) =>
      request<SprintPlannerKnowledgeItem[]>(
        `/api/knowledge?search=${encodeURIComponent(query)}`,
      ),

    getRetroNotes: (sprintId: string) =>
      request<SprintPlannerKnowledgeItem[]>(
        `/api/sprints/${encodeURIComponent(sprintId)}/retro`,
      ),

    getCapacity: (teamId: string) =>
      request<SprintPlannerCapacity>(
        `/api/teams/${encodeURIComponent(teamId)}/capacity`,
      ),

    getTickets: (filters?: { status?: string; priority?: string; category?: string }) => {
      const params = new URLSearchParams();
      if (filters?.status) params.set("status", filters.status);
      if (filters?.priority) params.set("priority", filters.priority);
      if (filters?.category) params.set("category", filters.category);
      const qs = params.toString();
      return request<SprintPlannerTicket[]>(`/api/tickets${qs ? `?${qs}` : ""}`);
    },

    getTicket: (ticketId: string) =>
      request<SprintPlannerTicket>(`/api/tickets/${encodeURIComponent(ticketId)}`),

    getActivityLog: (filters?: { userId?: string; action?: string; taskId?: string; pageSize?: number }) => {
      const params = new URLSearchParams();
      if (filters?.userId) params.set("userId", filters.userId);
      if (filters?.action) params.set("action", filters.action);
      if (filters?.taskId) params.set("taskId", filters.taskId);
      if (filters?.pageSize) params.set("pageSize", String(filters.pageSize));
      const qs = params.toString();
      return request<SprintPlannerActivityEntry[]>(`/api/activitylogs${qs ? `?${qs}` : ""}`);
    },

    // ── WRITE (AI team only) ──────────────────────────────────────

    createTask: (task: {
      title: string;
      description?: string;
      priority?: string;
      estimatedPoints?: number;
      sprintId?: string;
      epicId?: string;
    }) =>
      request<SprintPlannerTask>("/api/tasks", {
        method: "POST",
        body: JSON.stringify({ ...task, teamId: aiTeamId }),
      }),

    updateTaskStatus: (taskId: string, status: string, note?: string) =>
      request<SprintPlannerTask>(`/api/tasks/${encodeURIComponent(taskId)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, ...(note != null ? { note } : {}) }),
      }),

    addTaskComment: (taskId: string, content: string) =>
      request<{ id: string }>(`/api/tasks/${encodeURIComponent(taskId)}/comments`, {
        method: "POST",
        body: JSON.stringify({ content }),
      }),

    createTicket: (ticket: {
      title: string;
      description: string;
      priority?: string;
      category?: string;
      assigneeId?: string;
    }) =>
      request<SprintPlannerTicket>("/api/tickets", {
        method: "POST",
        body: JSON.stringify({ ...ticket, teamId: aiTeamId }),
      }),

    addTicketComment: (ticketId: string, content: string, isInternal?: boolean) =>
      request<{ id: string }>(`/api/tickets/${encodeURIComponent(ticketId)}/comments`, {
        method: "POST",
        body: JSON.stringify({ content, ...(isInternal != null ? { isInternal } : {}) }),
      }),

    createKnowledgeItem: (item: {
      title: string;
      content: string;
      category?: string;
      tags?: string[];
    }) =>
      request<SprintPlannerKnowledgeItem>("/api/knowledge", {
        method: "POST",
        body: JSON.stringify({
          ...item,
          // Sprint planner stores tags as comma-separated string
          tags: item.tags?.join(",") ?? "",
        }),
      }),
  };
}

export type SprintPlannerService = ReturnType<typeof sprintPlannerService>;
