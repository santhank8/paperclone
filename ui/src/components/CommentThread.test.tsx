// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import type { IssueComment } from "@paperclipai/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommentThread } from "./CommentThread";

let mockHash = "";

vi.mock("react-router-dom", () => ({
  Link: ({ children, className, ...props }: React.ComponentProps<"a">) => (
    <a className={className} {...props}>{children}</a>
  ),
  useLocation: () => ({ hash: mockHash }),
}));

vi.mock("./MarkdownBody", () => ({
  MarkdownBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("./MarkdownEditor", () => ({
  MarkdownEditor: ({ value, onChange }: { value?: string; onChange?: (value: string) => void }) => (
    <textarea value={value ?? ""} onChange={(event) => onChange?.(event.target.value)} />
  ),
}));

vi.mock("./Identity", () => ({
  Identity: ({ name }: { name: string }) => <span>{name}</span>,
}));

vi.mock("./InlineEntitySelector", () => ({
  InlineEntitySelector: () => null,
}));

vi.mock("./StatusBadge", () => ({
  StatusBadge: () => null,
}));

vi.mock("./AgentIconPicker", () => ({
  AgentIcon: () => null,
}));

vi.mock("./button", () => ({}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ComponentProps<"button">) => <button {...props}>{children}</button>,
}));

vi.mock("@/plugins/slots", () => ({
  PluginSlotOutlet: () => null,
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function createComment(id: string, createdAt: string): IssueComment {
  return {
    id,
    companyId: "company-1",
    issueId: "issue-1",
    authorAgentId: "agent-1",
    authorUserId: null,
    body: `comment ${id}`,
    createdAt,
    updatedAt: createdAt,
    runId: null,
    runAgentId: null,
    interruptedRunId: null,
    assigneeAgentId: null,
    assigneeUserId: null,
  };
}

describe("CommentThread initial positioning", () => {
  let container: HTMLDivElement;
  let calledIds: string[];

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    calledIds = [];
    mockHash = "";
    HTMLElement.prototype.scrollIntoView = function scrollIntoView() {
      calledIds.push(this.id);
    };
  });

  afterEach(() => {
    container.remove();
    vi.restoreAllMocks();
  });

  it("defaults to the latest comment on first entry when there is no hash", () => {
    const root = createRoot(container);

    act(() => {
      root.render(
        <CommentThread
          comments={[
            createComment("comment-1", "2026-03-31T00:00:00.000Z"),
            createComment("comment-2", "2026-03-31T00:01:00.000Z"),
          ]}
          onAdd={async () => {}}
        />,
      );
    });

    expect(calledIds).toContain("comment-comment-2");

    act(() => {
      root.unmount();
    });
  });

  it("respects a comment hash instead of overriding it with latest positioning", () => {
    const root = createRoot(container);
    mockHash = "#comment-comment-1";

    act(() => {
      root.render(
        <CommentThread
          comments={[
            createComment("comment-1", "2026-03-31T00:00:00.000Z"),
            createComment("comment-2", "2026-03-31T00:01:00.000Z"),
          ]}
          onAdd={async () => {}}
        />,
      );
    });

    expect(calledIds).toEqual(["comment-comment-1"]);

    act(() => {
      root.unmount();
    });
  });

  it("does not force a comment scroll when a document hash is present", () => {
    const root = createRoot(container);
    mockHash = "#document-plan";

    act(() => {
      root.render(
        <CommentThread
          comments={[
            createComment("comment-1", "2026-03-31T00:00:00.000Z"),
            createComment("comment-2", "2026-03-31T00:01:00.000Z"),
          ]}
          onAdd={async () => {}}
        />,
      );
    });

    expect(calledIds).toEqual([]);

    act(() => {
      root.unmount();
    });
  });
});
