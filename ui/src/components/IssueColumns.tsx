import type { ReactNode } from "react";
import type { Issue } from "@paperclipai/shared";
import { Columns3 } from "lucide-react";
import { pickTextColorForPillBg } from "@/lib/color-contrast";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatAssigneeUserLabel } from "../lib/assignees";
import type { InboxIssueColumn } from "../lib/inbox";
import { cn } from "../lib/utils";
import { timeAgo } from "../lib/timeAgo";
import { useGeneralSettings } from "../context/GeneralSettingsContext";
import { readStoredUiLanguage, textFor } from "../lib/ui-language";
import { Identity } from "./Identity";
import { StatusIcon } from "./StatusIcon";

export const issueTrailingColumns: InboxIssueColumn[] = ["assignee", "project", "workspace", "parent", "labels", "updated"];

export function issueActivityText(issue: Issue): string {
  const uiLanguage = readStoredUiLanguage();
  return uiLanguage === "zh-CN"
    ? `更新于 ${timeAgo(issue.lastActivityAt ?? issue.lastExternalCommentAt ?? issue.updatedAt)}`
    : `Updated ${timeAgo(issue.lastActivityAt ?? issue.lastExternalCommentAt ?? issue.updatedAt)}`;
}

function issueTrailingGridTemplate(columns: InboxIssueColumn[]): string {
  return columns
    .map((column) => {
      if (column === "assignee") return "minmax(7.5rem, 9.5rem)";
      if (column === "project") return "minmax(6.5rem, 8.5rem)";
      if (column === "workspace") return "minmax(9rem, 12rem)";
      if (column === "parent") return "minmax(5rem, 7rem)";
      if (column === "labels") return "minmax(8rem, 10rem)";
      return "minmax(4rem, 5.5rem)";
    })
    .join(" ");
}

export function IssueColumnPicker({
  availableColumns,
  visibleColumnSet,
  onToggleColumn,
  onResetColumns,
  title,
}: {
  availableColumns: InboxIssueColumn[];
  visibleColumnSet: ReadonlySet<InboxIssueColumn>;
  onToggleColumn: (column: InboxIssueColumn, enabled: boolean) => void;
  onResetColumns: () => void;
  title: string;
}) {
  const { uiLanguage } = useGeneralSettings();
  const issueColumnLabels: Record<InboxIssueColumn, string> = {
    status: textFor(uiLanguage, { en: "Status", "zh-CN": "状态" }),
    id: "ID",
    assignee: textFor(uiLanguage, { en: "Assignee", "zh-CN": "负责人" }),
    project: textFor(uiLanguage, { en: "Project", "zh-CN": "项目" }),
    workspace: textFor(uiLanguage, { en: "Workspace", "zh-CN": "工作区" }),
    parent: textFor(uiLanguage, { en: "Parent issue", "zh-CN": "父任务" }),
    labels: textFor(uiLanguage, { en: "Tags", "zh-CN": "标签" }),
    updated: textFor(uiLanguage, { en: "Last updated", "zh-CN": "最近更新" }),
  };
  const issueColumnDescriptions: Record<InboxIssueColumn, string> = {
    status: textFor(uiLanguage, { en: "Issue state chip on the left edge.", "zh-CN": "左侧显示的任务状态标签。" }),
    id: textFor(uiLanguage, { en: "Ticket identifier like PAP-1009.", "zh-CN": "类似 PAP-1009 的任务编号。" }),
    assignee: textFor(uiLanguage, { en: "Assigned agent or board user.", "zh-CN": "已分配的智能体或看板用户。" }),
    project: textFor(uiLanguage, { en: "Linked project pill with its color.", "zh-CN": "带颜色的关联项目标签。" }),
    workspace: textFor(uiLanguage, { en: "Execution or project workspace used for the issue.", "zh-CN": "任务使用的执行工作区或项目工作区。" }),
    parent: textFor(uiLanguage, { en: "Parent issue identifier and title.", "zh-CN": "父任务编号和标题。" }),
    labels: textFor(uiLanguage, { en: "Issue labels and tags.", "zh-CN": "任务标签。" }),
    updated: textFor(uiLanguage, { en: "Latest visible activity time.", "zh-CN": "最近可见活动时间。" }),
  };
  const copy = {
    columns: textFor(uiLanguage, { en: "Columns", "zh-CN": "列" }),
    desktopRows: textFor(uiLanguage, { en: "Desktop issue rows", "zh-CN": "桌面端任务行" }),
    resetDefaults: textFor(uiLanguage, { en: "Reset defaults", "zh-CN": "恢复默认" }),
    resetSummary: textFor(uiLanguage, { en: "status, id, updated", "zh-CN": "状态、编号、更新时间" }),
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="hidden h-8 shrink-0 px-2 text-xs sm:inline-flex"
        >
          <Columns3 className="mr-1 h-3.5 w-3.5" />
          {copy.columns}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[300px] rounded-xl border-border/70 p-1.5 shadow-xl shadow-black/10">
        <DropdownMenuLabel className="px-2 pb-1 pt-1.5">
          <div className="space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              {copy.desktopRows}
            </div>
            <div className="text-sm font-medium text-foreground">
              {title}
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {availableColumns.map((column) => (
          <DropdownMenuCheckboxItem
            key={column}
            checked={visibleColumnSet.has(column)}
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={(checked) => onToggleColumn(column, checked === true)}
            className="items-start rounded-lg px-3 py-2.5 pl-8"
          >
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">
                {issueColumnLabels[column]}
              </span>
              <span className="text-xs leading-relaxed text-muted-foreground">
                {issueColumnDescriptions[column]}
              </span>
            </span>
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={onResetColumns}
          className="rounded-lg px-3 py-2 text-sm"
        >
          {copy.resetDefaults}
          <span className="ml-auto text-xs text-muted-foreground">{copy.resetSummary}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function InboxIssueMetaLeading({
  issue,
  isLive,
  showStatus = true,
  showIdentifier = true,
  statusSlot,
}: {
  issue: Issue;
  isLive: boolean;
  showStatus?: boolean;
  showIdentifier?: boolean;
  statusSlot?: ReactNode;
}) {
  const { uiLanguage } = useGeneralSettings();
  return (
    <>
      {showStatus ? (
        <span className="hidden shrink-0 sm:inline-flex">
          {statusSlot ?? <StatusIcon status={issue.status} />}
        </span>
      ) : null}
      {showIdentifier ? (
        <span className="shrink-0 font-mono text-xs text-muted-foreground">
          {issue.identifier ?? issue.id.slice(0, 8)}
        </span>
      ) : null}
      {isLive && (
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 sm:gap-1.5 sm:px-2",
            "bg-blue-500/10",
          )}
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-blue-400 opacity-75" />
            <span
              className={cn(
                "relative inline-flex h-2 w-2 rounded-full",
                "bg-blue-500",
              )}
            />
          </span>
          <span
            className={cn(
              "hidden text-[11px] font-medium sm:inline",
              "text-blue-600 dark:text-blue-400",
            )}
          >
            {textFor(uiLanguage, { en: "Live", "zh-CN": "在线" })}
          </span>
        </span>
      )}
    </>
  );
}

export function InboxIssueTrailingColumns({
  issue,
  columns,
  projectName,
  projectColor,
  workspaceName,
  assigneeName,
  currentUserId,
  parentIdentifier,
  parentTitle,
  assigneeContent,
}: {
  issue: Issue;
  columns: InboxIssueColumn[];
  projectName: string | null;
  projectColor: string | null;
  workspaceName: string | null;
  assigneeName: string | null;
  currentUserId: string | null;
  parentIdentifier: string | null;
  parentTitle: string | null;
  assigneeContent?: ReactNode;
}) {
  const { uiLanguage } = useGeneralSettings();
  const activityText = timeAgo(issue.lastActivityAt ?? issue.lastExternalCommentAt ?? issue.updatedAt);
  const userLabel = formatAssigneeUserLabel(issue.assigneeUserId, currentUserId) ?? textFor(uiLanguage, { en: "User", "zh-CN": "用户" });

  return (
    <span
      className="grid items-center gap-2"
      style={{ gridTemplateColumns: issueTrailingGridTemplate(columns) }}
    >
      {columns.map((column) => {
        if (column === "assignee") {
          if (assigneeContent) {
            return <span key={column} className="min-w-0">{assigneeContent}</span>;
          }

          if (issue.assigneeAgentId) {
            return (
              <span key={column} className="min-w-0 text-xs text-foreground">
                <Identity
                  name={assigneeName ?? issue.assigneeAgentId.slice(0, 8)}
                  size="sm"
                  className="min-w-0"
                />
              </span>
            );
          }

          if (issue.assigneeUserId) {
            return (
              <span key={column} className="min-w-0 truncate text-xs font-medium text-muted-foreground">
                {userLabel}
              </span>
            );
          }

          return (
            <span key={column} className="min-w-0 truncate text-xs text-muted-foreground">
              {textFor(uiLanguage, { en: "Unassigned", "zh-CN": "未分配" })}
            </span>
          );
        }

        if (column === "project") {
          if (projectName) {
            const accentColor = projectColor ?? "#64748b";
            return (
              <span
                key={column}
                className="inline-flex min-w-0 items-center gap-2 text-xs font-medium"
                style={{ color: pickTextColorForPillBg(accentColor, 0.12) }}
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: accentColor }}
                />
                <span className="truncate">{projectName}</span>
              </span>
            );
          }

          return (
            <span key={column} className="min-w-0 truncate text-xs text-muted-foreground">
              No project
            </span>
          );
        }

        if (column === "labels") {
          if ((issue.labels ?? []).length > 0) {
            return (
              <span key={column} className="flex min-w-0 items-center gap-1 overflow-hidden text-[11px]">
                {(issue.labels ?? []).slice(0, 2).map((label) => (
                  <span
                    key={label.id}
                    className="inline-flex min-w-0 max-w-full items-center font-medium"
                    style={{
                      color: pickTextColorForPillBg(label.color, 0.12),
                    }}
                  >
                    <span className="truncate">{label.name}</span>
                  </span>
                ))}
                {(issue.labels ?? []).length > 2 ? (
                  <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
                    +{(issue.labels ?? []).length - 2}
                  </span>
                ) : null}
              </span>
            );
          }

          return <span key={column} className="min-w-0" aria-hidden="true" />;
        }

        if (column === "workspace") {
          if (!workspaceName) {
            return <span key={column} className="min-w-0" aria-hidden="true" />;
          }

          return (
            <span key={column} className="min-w-0 truncate text-xs text-muted-foreground">
              {workspaceName}
            </span>
          );
        }

        if (column === "parent") {
          if (!issue.parentId) {
            return <span key={column} className="min-w-0" aria-hidden="true" />;
          }

          return (
            <span key={column} className="min-w-0 truncate text-xs text-muted-foreground" title={parentTitle ?? undefined}>
              {parentIdentifier ? (
                <span className="font-mono">{parentIdentifier}</span>
              ) : (
                <span className="italic">Sub-issue</span>
              )}
            </span>
          );
        }

        if (column === "updated") {
          return (
            <span key={column} className="min-w-0 truncate text-right text-[11px] font-medium text-muted-foreground">
              {activityText}
            </span>
          );
        }

        return null;
      })}
    </span>
  );
}
