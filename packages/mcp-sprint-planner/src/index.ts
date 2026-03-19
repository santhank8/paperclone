#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_URL = process.env.SPRINT_PLANNER_API_URL;
const TOKEN = process.env.SPRINT_PLANNER_SERVICE_TOKEN;
const AI_TEAM_ID = process.env.SPRINT_PLANNER_AI_TEAM_ID;

if (!API_URL || !TOKEN || !AI_TEAM_ID) {
  console.error(
    "Missing required env vars: SPRINT_PLANNER_API_URL, SPRINT_PLANNER_SERVICE_TOKEN, SPRINT_PLANNER_AI_TEAM_ID",
  );
  process.exit(1);
}

const REQUEST_TIMEOUT_MS = 15_000;

interface SprintPlannerTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  assigneeName: string | null;
  estimatedPoints: number | null;
  sprintId: string | null;
}

interface SprintPlannerTicket {
  id: string;
  title: string;
  status: string;
  priority: string;
  category: string;
  assigneeName: string | null;
  createdAt: string;
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Sprint Planner API ${res.status}: ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const server = new McpServer({
  name: "paperclip-sprint-planner",
  version: "0.1.0",
});

// ── READ TOOLS ──────────────────────────────────────────────────

server.tool(
  "get_current_sprint",
  "Get the active sprint for a team: goals, dates, task counts by status, velocity. Defaults to the AI team if no teamId provided.",
  {
    teamId: z.string().optional().describe("Team ID (defaults to AI team)"),
  },
  async ({ teamId }) => {
    const tid = teamId ?? AI_TEAM_ID;
    const sprint = await apiRequest<Record<string, unknown>>(
      `/api/sprints/current?teamId=${encodeURIComponent(tid)}`,
    );
    let stats = null;
    const sprintId = sprint?.id as string | undefined;
    if (sprintId) {
      stats = await apiRequest<Record<string, unknown>>(
        `/api/sprints/${encodeURIComponent(sprintId)}/stats`,
      ).catch(() => null);
    }
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ sprint, stats }, null, 2),
        },
      ],
    };
  },
);

server.tool(
  "search_sprint_tasks",
  "Search tasks by title, assignee, status, or sprint. Returns compact list: id, title, status, priority, assignee, points.",
  {
    sprintId: z.string().optional().describe("Filter by sprint ID"),
    status: z.string().optional().describe("Filter by status (e.g., 'todo', 'in-progress', 'done')"),
    assigneeId: z.string().optional().describe("Filter by assignee ID"),
    query: z.string().optional().describe("Text search in task titles"),
  },
  async ({ sprintId, status, assigneeId, query }) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (assigneeId) params.set("assigneeId", assigneeId);
    if (query) params.set("q", query);
    const qs = params.toString();

    if (sprintId) params.set("sprintId", sprintId);
    params.set("pageSize", "100");
    const page = await apiRequest<{ items: SprintPlannerTask[] }>(`/api/tasks?${params}`);
    const tasks = page.items;

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            tasks.map((t) => ({
              id: t.id,
              title: t.title,
              status: t.status,
              priority: t.priority,
              assigneeName: t.assigneeName,
              estimatedPoints: t.estimatedPoints,
              sprintId: t.sprintId,
            })),
            null,
            2,
          ),
        },
      ],
    };
  },
);

server.tool(
  "get_sprint_task",
  "Get full task detail: description, comments, activity log, assignee, sprint, epic.",
  {
    taskId: z.string().describe("Task ID"),
  },
  async ({ taskId }) => {
    const task = await apiRequest<Record<string, unknown>>(
      `/api/tasks/${encodeURIComponent(taskId)}`,
    );
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(task, null, 2),
        },
      ],
    };
  },
);

server.tool(
  "get_tickets",
  "List support tickets, filterable by status, priority, or category. Use to monitor the ticket queue for items you can help with.",
  {
    status: z.string().optional().describe("Filter by status (e.g., 'open', 'in-progress', 'resolved')"),
    priority: z.string().optional().describe("Filter by priority"),
    category: z.string().optional().describe("Filter by category"),
  },
  async ({ status, priority, category }) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (priority) params.set("priority", priority);
    if (category) params.set("category", category);
    const qs = params.toString();
    const tickets = await apiRequest<SprintPlannerTicket[]>(`/api/tickets${qs ? `?${qs}` : ""}`);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            tickets.map((t) => ({
              id: t.id,
              title: t.title,
              status: t.status,
              priority: t.priority,
              category: t.category,
              assigneeName: t.assigneeName,
              createdAt: t.createdAt,
            })),
            null,
            2,
          ),
        },
      ],
    };
  },
);

// ── WRITE TOOLS (AI team only) ──────────────────────────────────

server.tool(
  "create_sprint_task",
  "Create a new task in the AI team. Use this to track your Paperclip work in the sprint planner. Returns the created task with its ID.",
  {
    title: z.string().describe("Task title"),
    description: z.string().optional().describe("Task description (markdown)"),
    priority: z.enum(["critical", "high", "medium", "low"]).optional().describe("Priority (default: medium)"),
    estimatedPoints: z.number().optional().describe("Story point estimate"),
    sprintId: z.string().optional().describe("Sprint ID to add the task to"),
  },
  async ({ title, description, priority, estimatedPoints, sprintId }) => {
    const task = await apiRequest<Record<string, unknown>>("/api/tasks", {
      method: "POST",
      body: JSON.stringify({
        title,
        ...(description != null ? { description } : {}),
        ...(priority != null ? { priority } : {}),
        ...(estimatedPoints != null ? { estimatedPoints } : {}),
        ...(sprintId != null ? { sprintId } : {}),
        teamId: AI_TEAM_ID,
      }),
    });
    return {
      content: [
        {
          type: "text" as const,
          text: `Created task "${task.title}" (id: ${task.id})${task.sprintId ? ` in sprint ${task.sprintId}` : ""}`,
        },
      ],
    };
  },
);

server.tool(
  "update_sprint_task_status",
  "Update a task's status and optionally add a note. Use to sync your Paperclip issue progress to the sprint board.",
  {
    taskId: z.string().describe("Task ID to update"),
    status: z.string().describe("New status (e.g., 'todo', 'in-progress', 'review', 'done', 'blocked')"),
    note: z.string().optional().describe("Status change note"),
  },
  async ({ taskId, status, note }) => {
    const task = await apiRequest<Record<string, unknown>>(
      `/api/tasks/${encodeURIComponent(taskId)}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ status, ...(note != null ? { note } : {}) }),
      },
    );
    return {
      content: [
        {
          type: "text" as const,
          text: `Updated task "${task.title}" status to "${status}"`,
        },
      ],
    };
  },
);

server.tool(
  "create_ticket",
  "Create a support ticket. Use this to request human review, flag issues you can't resolve, or escalate blockers to the board.",
  {
    title: z.string().describe("Ticket title"),
    description: z.string().describe("Detailed description of the issue or request"),
    priority: z.enum(["critical", "high", "medium", "low"]).optional().describe("Priority (default: medium)"),
    category: z.string().optional().describe("Category (e.g., 'support', 'bug', 'review', 'general')"),
    assigneeId: z.string().optional().describe("Assignee user ID (for requesting specific human review)"),
  },
  async ({ title, description, priority, category, assigneeId }) => {
    const ticket = await apiRequest<Record<string, unknown>>("/api/tickets", {
      method: "POST",
      body: JSON.stringify({
        title,
        description,
        ...(priority != null ? { priority } : {}),
        ...(category != null ? { category } : {}),
        ...(assigneeId != null ? { assigneeId } : {}),
        teamId: AI_TEAM_ID,
      }),
    });
    return {
      content: [
        {
          type: "text" as const,
          text: `Created ticket "${ticket.title}" (id: ${ticket.id}, status: ${ticket.status})`,
        },
      ],
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("MCP sprint planner server error:", err);
  process.exit(1);
});
