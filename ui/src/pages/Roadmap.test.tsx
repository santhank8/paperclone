// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Issue } from "@paperclipai/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Roadmap } from "./Roadmap";

const companyState = vi.hoisted(() => ({
  selectedCompanyId: "company-1",
}));

const dialogState = vi.hoisted(() => ({
  openNewIssue: vi.fn(),
}));

const breadcrumbsState = vi.hoisted(() => ({
  setBreadcrumbs: vi.fn(),
}));

const mockRoadmapApi = vi.hoisted(() => ({
  get: vi.fn(),
  renameItem: vi.fn(),
}));

const mockIssuesApi = vi.hoisted(() => ({
  list: vi.fn(),
}));

const mockGoalsApi = vi.hoisted(() => ({
  list: vi.fn(),
}));

const mockCompaniesApi = vi.hoisted(() => ({
  listRoadmapEpics: vi.fn(),
  pauseRoadmapEpic: vi.fn(),
  resumeRoadmapEpic: vi.fn(),
}));

vi.mock("../context/CompanyContext", () => ({
  useCompany: () => companyState,
}));

vi.mock("../context/DialogContext", () => ({
  useDialog: () => dialogState,
}));

vi.mock("../context/BreadcrumbContext", () => ({
  useBreadcrumbs: () => breadcrumbsState,
}));

vi.mock("../api/roadmap", () => ({
  roadmapApi: mockRoadmapApi,
}));

vi.mock("../api/issues", () => ({
  issuesApi: mockIssuesApi,
}));

vi.mock("../api/goals", () => ({
  goalsApi: mockGoalsApi,
}));

vi.mock("../api/companies", () => ({
  companiesApi: mockCompaniesApi,
}));

vi.mock("../components/MarkdownBody", () => ({
  MarkdownBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/lib/router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...props}>{children}</a>
  ),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function createIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: "issue-1",
    identifier: "COMA-1",
    companyId: "company-1",
    projectId: null,
    projectWorkspaceId: null,
    goalId: null,
    parentId: null,
    title: "Issue linked to roadmap item",
    description: "Roadmap Item ID: RM-2026-Q2-01",
    status: "todo",
    priority: "medium",
    assigneeAgentId: null,
    assigneeUserId: null,
    createdByAgentId: null,
    createdByUserId: null,
    issueNumber: 1,
    requestDepth: 0,
    billingCode: null,
    assigneeAdapterOverrides: null,
    executionWorkspaceId: null,
    executionWorkspacePreference: null,
    executionWorkspaceSettings: null,
    checkoutRunId: null,
    executionRunId: null,
    executionAgentNameKey: null,
    executionLockedAt: null,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    hiddenAt: null,
    createdAt: new Date("2026-04-12T00:00:00.000Z"),
    updatedAt: new Date("2026-04-12T00:00:00.000Z"),
    labels: [],
    labelIds: [],
    myLastTouchAt: null,
    lastExternalCommentAt: null,
    isUnreadForMe: false,
    ...overrides,
  };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function waitForAssertion(assertion: () => void, attempts = 20) {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await flush();
    }
  }

  throw lastError;
}

function setNativeInputValue(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  const previous = input.value;
  valueSetter?.call(input, value);
  const tracker = (input as HTMLInputElement & { _valueTracker?: { setValue: (nextValue: string) => void } })
    ._valueTracker;
  tracker?.setValue(previous);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function renderRoadmap(container: HTMLDivElement) {
  const root = createRoot(container);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <Roadmap />
      </QueryClientProvider>,
    );
  });

  return { root, queryClient };
}

describe("Roadmap", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);

    dialogState.openNewIssue.mockReset();
    breadcrumbsState.setBreadcrumbs.mockReset();
    mockRoadmapApi.get.mockReset();
    mockRoadmapApi.renameItem.mockReset();
    mockIssuesApi.list.mockReset();
    mockGoalsApi.list.mockReset();
    mockCompaniesApi.listRoadmapEpics.mockReset();
    mockCompaniesApi.pauseRoadmapEpic.mockReset();
    mockCompaniesApi.resumeRoadmapEpic.mockReset();

    mockRoadmapApi.get.mockResolvedValue({
      index: { path: "doc/ROADMAP.md", markdown: "", links: [] },
      roadmap: {
        label: "2026 Q2 CEO Roadmap",
        path: "doc/plans/2026-04-11-roadmap.md",
        title: "2026 Q2 CEO Roadmap",
        status: "Active",
        owner: "CEO",
        lastUpdated: "2026-04-12",
        contract: [],
        markdown: "",
        sections: [
          {
            title: "Now",
            items: [
              {
                id: "RM-2026-Q2-01",
                title: "Time to first success under 5 minutes",
                fields: [
                  { key: "Outcome", value: "A fresh install reaches first task." },
                ],
              },
            ],
          },
        ],
      },
    });
    mockIssuesApi.list.mockResolvedValue([createIssue()]);
    mockGoalsApi.list.mockResolvedValue([]);
    mockCompaniesApi.listRoadmapEpics.mockResolvedValue({ pausedEpicIds: [] });
    mockCompaniesApi.pauseRoadmapEpic.mockResolvedValue({ roadmapId: "RM-2026-Q2-01", paused: true });
    mockCompaniesApi.resumeRoadmapEpic.mockResolvedValue({ roadmapId: "RM-2026-Q2-01", paused: false });
    mockRoadmapApi.renameItem.mockResolvedValue({
      item: { id: "RM-2026-Q2-01", title: "New epic title", fields: [] },
    });
  });

  afterEach(() => {
    container.remove();
  });

  it("allows renaming the selected roadmap item", async () => {
    const { root } = renderRoadmap(container);

    await waitForAssertion(() => {
      expect(container.textContent).toContain("Time to first success under 5 minutes");
      expect(container.textContent).toContain("Rename");
    });

    const renameButton = [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Rename"));
    expect(renameButton).toBeTruthy();

    act(() => {
      renameButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const input = container.querySelector('input[value="Time to first success under 5 minutes"]') as HTMLInputElement | null;
    expect(input).toBeTruthy();

    act(() => {
      if (!input) return;
      setNativeInputValue(input, "New epic title");
    });

    const saveButton = [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Save"));
    expect(saveButton).toBeTruthy();

    act(() => {
      saveButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitForAssertion(() => {
      expect(mockRoadmapApi.renameItem).toHaveBeenCalledWith("RM-2026-Q2-01", "New epic title", "company-1");
    });

    act(() => {
      root.unmount();
    });
  });
});
