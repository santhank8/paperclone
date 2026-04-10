import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "@/lib/router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity as ActivityIcon,
  ChevronDown,
  ChevronRight,
  Clock3,
  Copy,
  Play,
  RefreshCw,
  Repeat,
  Save,
  Trash2,
  Webhook,
  Zap,
} from "lucide-react";
import { routinesApi, type RoutineTriggerResponse, type RotateRoutineTriggerResponse } from "../api/routines";
import { heartbeatsApi } from "../api/heartbeats";
import { instanceSettingsApi } from "../api/instanceSettings";
import { LiveRunWidget } from "../components/LiveRunWidget";
import { agentsApi } from "../api/agents";
import { projectsApi } from "../api/projects";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useGeneralSettings } from "../context/GeneralSettingsContext";
import { useToast } from "../context/ToastContext";
import { queryKeys } from "../lib/queryKeys";
import { buildRoutineTriggerPatch } from "../lib/routine-trigger-patch";
import { timeAgo } from "../lib/timeAgo";
import { textFor, type UiLanguage } from "../lib/ui-language";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { AgentIcon } from "../components/AgentIconPicker";
import { InlineEntitySelector, type InlineEntityOption } from "../components/InlineEntitySelector";
import { MarkdownEditor, type MarkdownEditorRef } from "../components/MarkdownEditor";
import {
  RoutineRunVariablesDialog,
  routineRunNeedsConfiguration,
  type RoutineRunDialogSubmitData,
} from "../components/RoutineRunVariablesDialog";
import { RoutineVariablesEditor, RoutineVariablesHint } from "../components/RoutineVariablesEditor";
import { ScheduleEditor, describeSchedule } from "../components/ScheduleEditor";
import { RunButton } from "../components/AgentActionButtons";
import { getRecentAssigneeIds, sortAgentsByRecency, trackRecentAssignee } from "../lib/recent-assignees";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import type { RoutineTrigger, RoutineVariable } from "@paperclipai/shared";

const concurrencyPolicies = ["coalesce_if_active", "always_enqueue", "skip_if_active"];
const catchUpPolicies = ["skip_missed", "enqueue_missed_with_cap"];
const triggerKinds = ["schedule", "webhook"];
const signingModes = ["bearer", "hmac_sha256", "github_hmac", "none"];
const routineTabs = ["triggers", "runs", "activity"] as const;
const concurrencyPolicyDescriptions: Record<string, string> = {
  coalesce_if_active: "Keep one follow-up run queued while an active run is still working.",
  always_enqueue: "Queue every trigger occurrence, even if several runs stack up.",
  skip_if_active: "Drop overlapping trigger occurrences while the routine is already active.",
};
const catchUpPolicyDescriptions: Record<string, string> = {
  skip_missed: "Ignore schedule windows that were missed while the routine or scheduler was paused.",
  enqueue_missed_with_cap: "Catch up missed schedule windows in capped batches after recovery.",
};
const signingModeDescriptions: Record<string, string> = {
  bearer: "Expect a shared bearer token in the Authorization header.",
  hmac_sha256: "Expect an HMAC SHA-256 signature over the request using the shared secret.",
  github_hmac: "Accept GitHub-style X-Hub-Signature-256 header (HMAC over raw body, no timestamp).",
  none: "No authentication — the webhook URL itself acts as a shared secret.",
};
const SIGNING_MODES_WITHOUT_REPLAY_WINDOW = new Set(["github_hmac", "none"]);

type RoutineTab = (typeof routineTabs)[number];

type SecretMessage = {
  title: string;
  webhookUrl: string;
  webhookSecret: string;
};

function autoResizeTextarea(element: HTMLTextAreaElement | null) {
  if (!element) return;
  element.style.height = "auto";
  element.style.height = `${element.scrollHeight}px`;
}

function isRoutineTab(value: string | null): value is RoutineTab {
  return value !== null && routineTabs.includes(value as RoutineTab);
}

function getRoutineTabFromSearch(search: string): RoutineTab {
  const tab = new URLSearchParams(search).get("tab");
  return isRoutineTab(tab) ? tab : "triggers";
}

function humanizeToken(value: string) {
  return value.replaceAll("_", " ");
}

function routineStatusLabel(status: string, uiLanguage: UiLanguage) {
  const labels: Record<string, { en: string; "zh-CN": string }> = {
    active: { en: "Active", "zh-CN": "运行中" },
    paused: { en: "Paused", "zh-CN": "已暂停" },
    archived: { en: "Archived", "zh-CN": "已归档" },
    queued: { en: "Queued", "zh-CN": "排队中" },
    running: { en: "Running", "zh-CN": "运行中" },
    succeeded: { en: "Succeeded", "zh-CN": "已成功" },
    failed: { en: "Failed", "zh-CN": "失败" },
    timed_out: { en: "Timed out", "zh-CN": "超时" },
    cancelled: { en: "Cancelled", "zh-CN": "已取消" },
  };
  return textFor(uiLanguage, labels[status] ?? { en: humanizeToken(status), "zh-CN": humanizeToken(status) });
}

function triggerKindLabel(kind: string, uiLanguage: UiLanguage) {
  const labels: Record<string, { en: string; "zh-CN": string }> = {
    schedule: { en: "Schedule", "zh-CN": "定时" },
    webhook: { en: "Webhook", "zh-CN": "Webhook" },
  };
  return textFor(uiLanguage, labels[kind] ?? { en: humanizeToken(kind), "zh-CN": humanizeToken(kind) });
}

function routineRunSourceLabel(source: string, uiLanguage: UiLanguage) {
  const labels: Record<string, { en: string; "zh-CN": string }> = {
    schedule: { en: "Schedule", "zh-CN": "定时" },
    webhook: { en: "Webhook", "zh-CN": "Webhook" },
    manual: { en: "Manual", "zh-CN": "手动" },
    on_demand: { en: "On-demand", "zh-CN": "按需" },
    api: { en: "API", "zh-CN": "API" },
  };
  return textFor(uiLanguage, labels[source] ?? { en: humanizeToken(source), "zh-CN": humanizeToken(source) });
}

function signingModeLabel(mode: string, uiLanguage: UiLanguage) {
  const labels: Record<string, { en: string; "zh-CN": string }> = {
    bearer: { en: "Bearer token", "zh-CN": "Bearer 令牌" },
    hmac_sha256: { en: "HMAC SHA-256", "zh-CN": "HMAC SHA-256" },
    github_hmac: { en: "GitHub HMAC", "zh-CN": "GitHub HMAC" },
    none: { en: "None", "zh-CN": "无认证" },
  };
  return textFor(uiLanguage, labels[mode] ?? { en: humanizeToken(mode), "zh-CN": humanizeToken(mode) });
}

function concurrencyPolicyLabel(policy: string, uiLanguage: UiLanguage) {
  const labels: Record<string, { en: string; "zh-CN": string }> = {
    coalesce_if_active: { en: "Coalesce if active", "zh-CN": "运行中时合并" },
    always_enqueue: { en: "Always enqueue", "zh-CN": "始终入队" },
    skip_if_active: { en: "Skip if active", "zh-CN": "运行中时跳过" },
  };
  return textFor(uiLanguage, labels[policy] ?? { en: humanizeToken(policy), "zh-CN": humanizeToken(policy) });
}

function catchUpPolicyLabel(policy: string, uiLanguage: UiLanguage) {
  const labels: Record<string, { en: string; "zh-CN": string }> = {
    skip_missed: { en: "Skip missed windows", "zh-CN": "跳过错过窗口" },
    enqueue_missed_with_cap: { en: "Enqueue missed windows", "zh-CN": "补跑错过窗口" },
  };
  return textFor(uiLanguage, labels[policy] ?? { en: humanizeToken(policy), "zh-CN": humanizeToken(policy) });
}

function formatActivityDetailValue(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.length === 0 ? "[]" : value.map((item) => formatActivityDetailValue(item)).join(", ");
  try {
    return JSON.stringify(value);
  } catch {
    return "[unserializable]";
  }
}

function getLocalTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

function TriggerEditor({
  trigger,
  onSave,
  onRotate,
  onDelete,
}: {
  trigger: RoutineTrigger;
  onSave: (id: string, patch: Record<string, unknown>) => void;
  onRotate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { uiLanguage } = useGeneralSettings();
  const [draft, setDraft] = useState({
    label: trigger.label ?? "",
    cronExpression: trigger.cronExpression ?? "",
    signingMode: trigger.signingMode ?? "bearer",
    replayWindowSec: String(trigger.replayWindowSec ?? 300),
  });

  useEffect(() => {
    setDraft({
      label: trigger.label ?? "",
      cronExpression: trigger.cronExpression ?? "",
      signingMode: trigger.signingMode ?? "bearer",
      replayWindowSec: String(trigger.replayWindowSec ?? 300),
    });
  }, [trigger]);

  const copy = {
    next: textFor(uiLanguage, { en: "Next", "zh-CN": "下次" }),
    webhook: textFor(uiLanguage, { en: "Webhook", "zh-CN": "Webhook" }),
    api: textFor(uiLanguage, { en: "API", "zh-CN": "API" }),
    label: textFor(uiLanguage, { en: "Label", "zh-CN": "名称" }),
    schedule: textFor(uiLanguage, { en: "Schedule", "zh-CN": "定时" }),
    signingMode: textFor(uiLanguage, { en: "Signing mode", "zh-CN": "签名模式" }),
    replayWindow: textFor(uiLanguage, { en: "Replay window (seconds)", "zh-CN": "重放窗口（秒）" }),
    last: textFor(uiLanguage, { en: "Last", "zh-CN": "最近" }),
    rotateSecret: textFor(uiLanguage, { en: "Rotate secret", "zh-CN": "轮换密钥" }),
    saveTrigger: textFor(uiLanguage, { en: "Save trigger", "zh-CN": "保存触发器" }),
  };

  return (
    <div className="rounded-lg border border-border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          {trigger.kind === "schedule" ? <Clock3 className="h-3.5 w-3.5" /> : trigger.kind === "webhook" ? <Webhook className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}
          {trigger.label ?? triggerKindLabel(trigger.kind, uiLanguage)}
        </div>
        <span className="text-xs text-muted-foreground">
          {trigger.kind === "schedule" && trigger.nextRunAt
            ? `${copy.next}: ${new Date(trigger.nextRunAt).toLocaleString(uiLanguage === "zh-CN" ? "zh-CN" : "en-US")}`
            : trigger.kind === "webhook"
              ? copy.webhook
              : copy.api}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">{copy.label}</Label>
          <Input
            value={draft.label}
            onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))}
          />
        </div>
        {trigger.kind === "schedule" && (
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs">{copy.schedule}</Label>
            <ScheduleEditor
              value={draft.cronExpression}
              onChange={(cronExpression) => setDraft((current) => ({ ...current, cronExpression }))}
            />
          </div>
        )}
        {trigger.kind === "webhook" && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">{copy.signingMode}</Label>
              <Select
                value={draft.signingMode}
                onValueChange={(signingMode) => setDraft((current) => ({ ...current, signingMode }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {signingModes.map((mode) => (
                    <SelectItem key={mode} value={mode}>{signingModeLabel(mode, uiLanguage)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!SIGNING_MODES_WITHOUT_REPLAY_WINDOW.has(draft.signingMode) && (
              <div className="space-y-1.5">
                <Label className="text-xs">{copy.replayWindow}</Label>
                <Input
                  value={draft.replayWindowSec}
                  onChange={(event) => setDraft((current) => ({ ...current, replayWindowSec: event.target.value }))}
                />
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {trigger.lastResult && <span className="text-xs text-muted-foreground">{copy.last}: {trigger.lastResult}</span>}
        <div className="ml-auto flex items-center gap-2">
          {trigger.kind === "webhook" && (
            <Button variant="outline" size="sm" onClick={() => onRotate(trigger.id)}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              {copy.rotateSecret}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSave(trigger.id, buildRoutineTriggerPatch(trigger, draft, getLocalTimezone()))}
          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            {copy.saveTrigger}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(trigger.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function RoutineDetail() {
  const { routineId } = useParams<{ routineId: string }>();
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { uiLanguage } = useGeneralSettings();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { pushToast } = useToast();
  const hydratedRoutineIdRef = useRef<string | null>(null);
  const titleInputRef = useRef<HTMLTextAreaElement | null>(null);
  const descriptionEditorRef = useRef<MarkdownEditorRef>(null);
  const assigneeSelectorRef = useRef<HTMLButtonElement | null>(null);
  const projectSelectorRef = useRef<HTMLButtonElement | null>(null);
  const [secretMessage, setSecretMessage] = useState<SecretMessage | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [runVariablesOpen, setRunVariablesOpen] = useState(false);
  const [newTrigger, setNewTrigger] = useState({
    kind: "schedule",
    cronExpression: "0 10 * * *",
    signingMode: "bearer",
    replayWindowSec: "300",
  });
  const [editDraft, setEditDraft] = useState<{
    title: string;
    description: string;
    projectId: string;
    assigneeAgentId: string;
    priority: string;
    concurrencyPolicy: string;
    catchUpPolicy: string;
    variables: RoutineVariable[];
  }>({
    title: "",
    description: "",
    projectId: "",
    assigneeAgentId: "",
    priority: "medium",
    concurrencyPolicy: "coalesce_if_active",
    catchUpPolicy: "skip_missed",
    variables: [],
  });
  const activeTab = useMemo(() => getRoutineTabFromSearch(location.search), [location.search]);
  const concurrencyPolicyDescriptionsForLanguage: Record<string, string> = {
    coalesce_if_active: textFor(uiLanguage, {
      en: "Keep one follow-up run queued while an active run is still working.",
      "zh-CN": "如果已有运行正在执行，只保留一个后续待运行任务。",
    }),
    always_enqueue: textFor(uiLanguage, {
      en: "Queue every trigger occurrence, even if several runs stack up.",
      "zh-CN": "每次触发都入队，即使已经堆积了多个运行。",
    }),
    skip_if_active: textFor(uiLanguage, {
      en: "Drop overlapping trigger occurrences while the routine is already active.",
      "zh-CN": "当例行任务已在运行时，丢弃重叠的触发。",
    }),
  };
  const catchUpPolicyDescriptionsForLanguage: Record<string, string> = {
    skip_missed: textFor(uiLanguage, {
      en: "Ignore schedule windows that were missed while the routine or scheduler was paused.",
      "zh-CN": "在例行任务或调度器暂停期间错过的时间窗口将被忽略。",
    }),
    enqueue_missed_with_cap: textFor(uiLanguage, {
      en: "Catch up missed schedule windows in capped batches after recovery.",
      "zh-CN": "恢复后按上限分批补跑错过的时间窗口。",
    }),
  };
  const signingModeDescriptionsForLanguage: Record<string, string> = {
    bearer: textFor(uiLanguage, {
      en: "Expect a shared bearer token in the Authorization header.",
      "zh-CN": "要求在 Authorization 请求头中提供共享 Bearer 令牌。",
    }),
    hmac_sha256: textFor(uiLanguage, {
      en: "Expect an HMAC SHA-256 signature over the request using the shared secret.",
      "zh-CN": "要求使用共享密钥对请求进行 HMAC SHA-256 签名。",
    }),
    github_hmac: textFor(uiLanguage, {
      en: "Accept GitHub-style X-Hub-Signature-256 header (HMAC over raw body, no timestamp).",
      "zh-CN": "接受 GitHub 风格的 X-Hub-Signature-256 请求头（对原始请求体做 HMAC，无时间戳）。",
    }),
    none: textFor(uiLanguage, {
      en: "No authentication — the webhook URL itself acts as a shared secret.",
      "zh-CN": "不做认证，Webhook URL 本身作为共享密钥。",
    }),
  };
  const copy = {
    routines: textFor(uiLanguage, { en: "Routines", "zh-CN": "例行任务" }),
    copied: textFor(uiLanguage, { en: "copied", "zh-CN": "已复制" }),
    failedToCopy: textFor(uiLanguage, { en: "Failed to copy", "zh-CN": "复制失败" }),
    clipboardDenied: textFor(uiLanguage, { en: "Clipboard access was denied.", "zh-CN": "没有剪贴板访问权限。" }),
    failedToSaveRoutine: textFor(uiLanguage, { en: "Failed to save routine", "zh-CN": "保存例行任务失败" }),
    routineSaveError: textFor(uiLanguage, { en: "Paperclip could not save the routine.", "zh-CN": "Paperclip 无法保存该例行任务。" }),
    routineRunStarted: textFor(uiLanguage, { en: "Routine run started", "zh-CN": "例行任务已开始运行" }),
    routineRunFailed: textFor(uiLanguage, { en: "Routine run failed", "zh-CN": "例行任务运行失败" }),
    routineRunError: textFor(uiLanguage, { en: "Paperclip could not start the routine run.", "zh-CN": "Paperclip 无法启动该例行任务运行。" }),
    routineSaved: textFor(uiLanguage, { en: "Routine saved", "zh-CN": "例行任务已保存" }),
    automationPaused: textFor(uiLanguage, { en: "Automation paused.", "zh-CN": "自动触发已暂停。" }),
    automationEnabled: textFor(uiLanguage, { en: "Automation enabled.", "zh-CN": "自动触发已启用。" }),
    failedToUpdateRoutine: textFor(uiLanguage, { en: "Failed to update routine", "zh-CN": "更新例行任务失败" }),
    routineUpdateError: textFor(uiLanguage, { en: "Paperclip could not update the routine.", "zh-CN": "Paperclip 无法更新该例行任务。" }),
    webhookTriggerCreated: textFor(uiLanguage, { en: "Webhook trigger created", "zh-CN": "Webhook 触发器已创建" }),
    triggerAdded: textFor(uiLanguage, { en: "Trigger added", "zh-CN": "触发器已添加" }),
    routineScheduleSaved: textFor(uiLanguage, { en: "The routine schedule was saved.", "zh-CN": "例行任务调度已保存。" }),
    failedToAddTrigger: textFor(uiLanguage, { en: "Failed to add trigger", "zh-CN": "添加触发器失败" }),
    triggerCreateError: textFor(uiLanguage, { en: "Paperclip could not create the trigger.", "zh-CN": "Paperclip 无法创建该触发器。" }),
    triggerSaved: textFor(uiLanguage, { en: "Trigger saved", "zh-CN": "触发器已保存" }),
    triggerUpdateSaved: textFor(uiLanguage, { en: "The routine cadence update was saved.", "zh-CN": "例行任务节奏更新已保存。" }),
    failedToUpdateTrigger: textFor(uiLanguage, { en: "Failed to update trigger", "zh-CN": "更新触发器失败" }),
    triggerUpdateError: textFor(uiLanguage, { en: "Paperclip could not update the trigger.", "zh-CN": "Paperclip 无法更新该触发器。" }),
    triggerDeleted: textFor(uiLanguage, { en: "Trigger deleted", "zh-CN": "触发器已删除" }),
    failedToDeleteTrigger: textFor(uiLanguage, { en: "Failed to delete trigger", "zh-CN": "删除触发器失败" }),
    triggerDeleteError: textFor(uiLanguage, { en: "Paperclip could not delete the trigger.", "zh-CN": "Paperclip 无法删除该触发器。" }),
    webhookSecretRotated: textFor(uiLanguage, { en: "Webhook secret rotated", "zh-CN": "Webhook 密钥已轮换" }),
    failedToRotateWebhookSecret: textFor(uiLanguage, { en: "Failed to rotate webhook secret", "zh-CN": "轮换 Webhook 密钥失败" }),
    webhookSecretRotateError: textFor(uiLanguage, { en: "Paperclip could not rotate the webhook secret.", "zh-CN": "Paperclip 无法轮换该 Webhook 密钥。" }),
    selectCompany: textFor(uiLanguage, { en: "Select a company to view routines.", "zh-CN": "请选择一个公司以查看例行任务。" }),
    routineNotFound: textFor(uiLanguage, { en: "Routine not found", "zh-CN": "未找到该例行任务" }),
    archived: textFor(uiLanguage, { en: "Archived", "zh-CN": "已归档" }),
    active: textFor(uiLanguage, { en: "Active", "zh-CN": "运行中" }),
    paused: textFor(uiLanguage, { en: "Paused", "zh-CN": "已暂停" }),
    routineTitle: textFor(uiLanguage, { en: "Routine title", "zh-CN": "例行任务标题" }),
    pauseAuto: textFor(uiLanguage, { en: "Pause automatic triggers", "zh-CN": "暂停自动触发" }),
    enableAuto: textFor(uiLanguage, { en: "Enable automatic triggers", "zh-CN": "启用自动触发" }),
    saveNow: textFor(uiLanguage, { en: "Save this now. Paperclip will not show the secret value again.", "zh-CN": "请现在保存。Paperclip 不会再次显示该密钥值。" }),
    webhookUrl: textFor(uiLanguage, { en: "Webhook URL", "zh-CN": "Webhook URL" }),
    webhookSecret: textFor(uiLanguage, { en: "Webhook secret", "zh-CN": "Webhook 密钥" }),
    url: textFor(uiLanguage, { en: "URL", "zh-CN": "URL" }),
    secret: textFor(uiLanguage, { en: "Secret", "zh-CN": "密钥" }),
    for: textFor(uiLanguage, { en: "For", "zh-CN": "分配给" }),
    assignee: textFor(uiLanguage, { en: "Assignee", "zh-CN": "负责人" }),
    noAssignee: textFor(uiLanguage, { en: "No assignee", "zh-CN": "未分配负责人" }),
    searchAssignees: textFor(uiLanguage, { en: "Search assignees...", "zh-CN": "搜索负责人..." }),
    noAssigneesFound: textFor(uiLanguage, { en: "No assignees found.", "zh-CN": "未找到负责人。" }),
    in: textFor(uiLanguage, { en: "in", "zh-CN": "归属项目" }),
    project: textFor(uiLanguage, { en: "Project", "zh-CN": "项目" }),
    noProject: textFor(uiLanguage, { en: "No project", "zh-CN": "无项目" }),
    searchProjects: textFor(uiLanguage, { en: "Search projects...", "zh-CN": "搜索项目..." }),
    noProjectsFound: textFor(uiLanguage, { en: "No projects found.", "zh-CN": "未找到项目。" }),
    addInstructions: textFor(uiLanguage, { en: "Add instructions...", "zh-CN": "添加说明..." }),
    advancedDelivery: textFor(uiLanguage, { en: "Advanced delivery settings", "zh-CN": "高级投递设置" }),
    concurrency: textFor(uiLanguage, { en: "Concurrency", "zh-CN": "并发策略" }),
    catchUp: textFor(uiLanguage, { en: "Catch-up", "zh-CN": "补跑策略" }),
    unsavedChanges: textFor(uiLanguage, { en: "Unsaved changes", "zh-CN": "有未保存更改" }),
    saveRoutine: textFor(uiLanguage, { en: "Save routine", "zh-CN": "保存例行任务" }),
    triggers: textFor(uiLanguage, { en: "Triggers", "zh-CN": "触发器" }),
    runs: textFor(uiLanguage, { en: "Runs", "zh-CN": "运行记录" }),
    activity: textFor(uiLanguage, { en: "Activity", "zh-CN": "活动" }),
    addTrigger: textFor(uiLanguage, { en: "Add trigger", "zh-CN": "添加触发器" }),
    kind: textFor(uiLanguage, { en: "Kind", "zh-CN": "类型" }),
    comingSoon: textFor(uiLanguage, { en: "COMING SOON", "zh-CN": "即将推出" }),
    schedule: textFor(uiLanguage, { en: "Schedule", "zh-CN": "定时" }),
    signingMode: textFor(uiLanguage, { en: "Signing mode", "zh-CN": "签名模式" }),
    replayWindow: textFor(uiLanguage, { en: "Replay window (seconds)", "zh-CN": "重放窗口（秒）" }),
    adding: textFor(uiLanguage, { en: "Adding...", "zh-CN": "添加中..." }),
    addTriggerButton: textFor(uiLanguage, { en: "Add trigger", "zh-CN": "添加触发器" }),
    noTriggers: textFor(uiLanguage, { en: "No triggers configured yet.", "zh-CN": "还没有配置触发器。" }),
    noRuns: textFor(uiLanguage, { en: "No runs yet.", "zh-CN": "还没有运行记录。" }),
    noActivity: textFor(uiLanguage, { en: "No activity yet.", "zh-CN": "还没有活动记录。" }),
  };

  const { data: routine, isLoading, error } = useQuery({
    queryKey: queryKeys.routines.detail(routineId!),
    queryFn: () => routinesApi.get(routineId!),
    enabled: !!routineId,
  });
  const activeIssueId = routine?.activeIssue?.id;
  const { data: liveRuns } = useQuery({
    queryKey: queryKeys.issues.liveRuns(activeIssueId!),
    queryFn: () => heartbeatsApi.liveRunsForIssue(activeIssueId!),
    enabled: !!activeIssueId,
    refetchInterval: 3000,
  });
  const hasLiveRun = (liveRuns ?? []).length > 0;
  const { data: routineRuns } = useQuery({
    queryKey: queryKeys.routines.runs(routineId!),
    queryFn: () => routinesApi.listRuns(routineId!),
    enabled: !!routineId,
    refetchInterval: hasLiveRun ? 3000 : false,
  });
  const relatedActivityIds = useMemo(
    () => ({
      triggerIds: routine?.triggers.map((trigger) => trigger.id) ?? [],
      runIds: routineRuns?.map((run) => run.id) ?? [],
    }),
    [routine?.triggers, routineRuns],
  );
  const { data: activity } = useQuery({
    queryKey: [
      ...queryKeys.routines.activity(selectedCompanyId!, routineId!),
      relatedActivityIds.triggerIds.join(","),
      relatedActivityIds.runIds.join(","),
    ],
    queryFn: () => routinesApi.activity(selectedCompanyId!, routineId!, relatedActivityIds),
    enabled: !!selectedCompanyId && !!routineId && !!routine,
  });
  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const { data: projects } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const { data: experimentalSettings } = useQuery({
    queryKey: queryKeys.instance.experimentalSettings,
    queryFn: () => instanceSettingsApi.getExperimental(),
    retry: false,
  });

  const routineDefaults = useMemo(
    () =>
      routine
        ? {
            title: routine.title,
            description: routine.description ?? "",
            projectId: routine.projectId,
            assigneeAgentId: routine.assigneeAgentId,
            priority: routine.priority,
            concurrencyPolicy: routine.concurrencyPolicy,
            catchUpPolicy: routine.catchUpPolicy,
            variables: routine.variables,
          }
        : null,
    [routine],
  );
  const isEditDirty = useMemo(() => {
    if (!routineDefaults) return false;
    return (
      editDraft.title !== routineDefaults.title ||
      editDraft.description !== routineDefaults.description ||
      editDraft.projectId !== routineDefaults.projectId ||
      editDraft.assigneeAgentId !== routineDefaults.assigneeAgentId ||
      editDraft.priority !== routineDefaults.priority ||
      editDraft.concurrencyPolicy !== routineDefaults.concurrencyPolicy ||
      editDraft.catchUpPolicy !== routineDefaults.catchUpPolicy ||
      JSON.stringify(editDraft.variables) !== JSON.stringify(routineDefaults.variables)
    );
  }, [editDraft, routineDefaults]);

  useEffect(() => {
    if (!routine) return;
    setBreadcrumbs([{ label: copy.routines, href: "/routines" }, { label: routine.title }]);
    if (!routineDefaults) return;

    const changedRoutine = hydratedRoutineIdRef.current !== routine.id;
    if (changedRoutine || !isEditDirty) {
      setEditDraft(routineDefaults);
      hydratedRoutineIdRef.current = routine.id;
    }
  }, [copy.routines, routine, routineDefaults, isEditDirty, setBreadcrumbs]);

  useEffect(() => {
    autoResizeTextarea(titleInputRef.current);
  }, [editDraft.title, routine?.id]);

  const copySecretValue = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      pushToast({ title: `${label}${uiLanguage === "zh-CN" ? "已复制" : ` ${copy.copied}`}`, tone: "success" });
    } catch (error) {
      pushToast({
        title: uiLanguage === "zh-CN" ? `${copy.failedToCopy}${label}` : `${copy.failedToCopy} ${label.toLowerCase()}`,
        body: error instanceof Error ? error.message : copy.clipboardDenied,
        tone: "error",
      });
    }
  };

  const setActiveTab = (value: string) => {
    if (!routineId || !isRoutineTab(value)) return;
    const params = new URLSearchParams(location.search);
    if (value === "triggers") {
      params.delete("tab");
    } else {
      params.set("tab", value);
    }
    const search = params.toString();
    navigate(
      {
        pathname: location.pathname,
        search: search ? `?${search}` : "",
      },
      { replace: true },
    );
  };

  const saveRoutine = useMutation({
    mutationFn: () => {
      return routinesApi.update(routineId!, {
        ...editDraft,
        description: editDraft.description.trim() || null,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.routines.detail(routineId!) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.routines.list(selectedCompanyId!) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.routines.activity(selectedCompanyId!, routineId!) }),
      ]);
    },
    onError: (error) => {
      pushToast({
        title: copy.failedToSaveRoutine,
        body: error instanceof Error ? error.message : copy.routineSaveError,
        tone: "error",
      });
    },
  });

  const runRoutine = useMutation({
    mutationFn: (data?: RoutineRunDialogSubmitData) =>
      routinesApi.run(routineId!, {
        ...(data?.variables && Object.keys(data.variables).length > 0 ? { variables: data.variables } : {}),
        ...(data?.executionWorkspaceId !== undefined ? { executionWorkspaceId: data.executionWorkspaceId } : {}),
        ...(data?.executionWorkspacePreference !== undefined
          ? { executionWorkspacePreference: data.executionWorkspacePreference }
          : {}),
        ...(data?.executionWorkspaceSettings !== undefined
          ? { executionWorkspaceSettings: data.executionWorkspaceSettings }
          : {}),
    }),
    onSuccess: async () => {
      pushToast({ title: copy.routineRunStarted, tone: "success" });
      setRunVariablesOpen(false);
      setActiveTab("runs");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.routines.detail(routineId!) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.routines.runs(routineId!) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.routines.list(selectedCompanyId!) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.routines.activity(selectedCompanyId!, routineId!) }),
      ]);
    },
    onError: (error) => {
      pushToast({
        title: copy.routineRunFailed,
        body: error instanceof Error ? error.message : copy.routineRunError,
        tone: "error",
      });
    },
  });

  const updateRoutineStatus = useMutation({
    mutationFn: (status: string) => routinesApi.update(routineId!, { status }),
    onSuccess: async (_data, status) => {
      pushToast({
        title: copy.routineSaved,
        body: status === "paused" ? copy.automationPaused : copy.automationEnabled,
        tone: "success",
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.routines.detail(routineId!) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.routines.list(selectedCompanyId!) }),
      ]);
    },
    onError: (error) => {
      pushToast({
        title: copy.failedToUpdateRoutine,
        body: error instanceof Error ? error.message : copy.routineUpdateError,
        tone: "error",
      });
    },
  });

  const createTrigger = useMutation({
    mutationFn: async (): Promise<RoutineTriggerResponse> => {
      const existingOfKind = (routine?.triggers ?? []).filter((t) => t.kind === newTrigger.kind).length;
      const autoLabel = existingOfKind > 0 ? `${newTrigger.kind}-${existingOfKind + 1}` : newTrigger.kind;
      return routinesApi.createTrigger(routineId!, {
        kind: newTrigger.kind,
        label: autoLabel,
        ...(newTrigger.kind === "schedule"
          ? { cronExpression: newTrigger.cronExpression.trim(), timezone: getLocalTimezone() }
          : {}),
        ...(newTrigger.kind === "webhook"
          ? {
            signingMode: newTrigger.signingMode,
            replayWindowSec: Number(newTrigger.replayWindowSec || "300"),
          }
          : {}),
      });
    },
    onSuccess: async (result) => {
      if (result.secretMaterial) {
        setSecretMessage({
          title: copy.webhookTriggerCreated,
          webhookUrl: result.secretMaterial.webhookUrl,
          webhookSecret: result.secretMaterial.webhookSecret,
        });
      } else {
        pushToast({
          title: copy.triggerAdded,
          body: copy.routineScheduleSaved,
          tone: "success",
        });
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.routines.detail(routineId!) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.routines.list(selectedCompanyId!) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.routines.activity(selectedCompanyId!, routineId!) }),
      ]);
    },
    onError: (error) => {
      pushToast({
        title: copy.failedToAddTrigger,
        body: error instanceof Error ? error.message : copy.triggerCreateError,
        tone: "error",
      });
    },
  });

  const updateTrigger = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) => routinesApi.updateTrigger(id, patch),
    onSuccess: async () => {
      pushToast({
        title: copy.triggerSaved,
        body: copy.triggerUpdateSaved,
        tone: "success",
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.routines.detail(routineId!) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.routines.list(selectedCompanyId!) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.routines.activity(selectedCompanyId!, routineId!) }),
      ]);
    },
    onError: (error) => {
      pushToast({
        title: copy.failedToUpdateTrigger,
        body: error instanceof Error ? error.message : copy.triggerUpdateError,
        tone: "error",
      });
    },
  });

  const deleteTrigger = useMutation({
    mutationFn: (id: string) => routinesApi.deleteTrigger(id),
    onSuccess: async () => {
      pushToast({
        title: copy.triggerDeleted,
        tone: "success",
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.routines.detail(routineId!) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.routines.list(selectedCompanyId!) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.routines.activity(selectedCompanyId!, routineId!) }),
      ]);
    },
    onError: (error) => {
      pushToast({
        title: copy.failedToDeleteTrigger,
        body: error instanceof Error ? error.message : copy.triggerDeleteError,
        tone: "error",
      });
    },
  });

  const rotateTrigger = useMutation({
    mutationFn: (id: string): Promise<RotateRoutineTriggerResponse> => routinesApi.rotateTriggerSecret(id),
    onSuccess: async (result) => {
      setSecretMessage({
        title: copy.webhookSecretRotated,
        webhookUrl: result.secretMaterial.webhookUrl,
        webhookSecret: result.secretMaterial.webhookSecret,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.routines.detail(routineId!) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.routines.activity(selectedCompanyId!, routineId!) }),
      ]);
    },
    onError: (error) => {
      pushToast({
        title: copy.failedToRotateWebhookSecret,
        body: error instanceof Error ? error.message : copy.webhookSecretRotateError,
        tone: "error",
      });
    },
  });

  const agentById = useMemo(
    () => new Map((agents ?? []).map((agent) => [agent.id, agent])),
    [agents],
  );
  const projectById = useMemo(
    () => new Map((projects ?? []).map((project) => [project.id, project])),
    [projects],
  );
  const recentAssigneeIds = useMemo(() => getRecentAssigneeIds(), [routine?.id]);
  const assigneeOptions = useMemo<InlineEntityOption[]>(
    () =>
      sortAgentsByRecency(
        (agents ?? []).filter((agent) => agent.status !== "terminated"),
        recentAssigneeIds,
      ).map((agent) => ({
        id: agent.id,
        label: agent.name,
        searchText: `${agent.name} ${agent.role} ${agent.title ?? ""}`,
      })),
    [agents, recentAssigneeIds],
  );
  const projectOptions = useMemo<InlineEntityOption[]>(
    () =>
      (projects ?? []).map((project) => ({
        id: project.id,
        label: project.name,
        searchText: project.description ?? "",
      })),
    [projects],
  );
  const currentAssignee = editDraft.assigneeAgentId ? agentById.get(editDraft.assigneeAgentId) ?? null : null;
  const currentProject = editDraft.projectId ? projectById.get(editDraft.projectId) ?? null : null;

  if (!selectedCompanyId) {
    return <EmptyState icon={Repeat} message={copy.selectCompany} />;
  }

  if (isLoading) {
    return <PageSkeleton variant="issues-list" />;
  }

  if (error || !routine) {
    return (
      <p className="pt-6 text-sm text-destructive">
        {error instanceof Error ? error.message : copy.routineNotFound}
      </p>
    );
  }

  const automationEnabled = routine.status === "active";
  const selectedProject = projects?.find((project) => project.id === routine.projectId) ?? null;
  const needsRunConfiguration = routineRunNeedsConfiguration({
    variables: routine.variables ?? [],
    project: selectedProject,
    isolatedWorkspacesEnabled: experimentalSettings?.enableIsolatedWorkspaces === true,
  });
  const automationToggleDisabled = updateRoutineStatus.isPending || routine.status === "archived";
  const automationLabel = routine.status === "archived" ? copy.archived : automationEnabled ? copy.active : copy.paused;
  const automationLabelClassName = routine.status === "archived"
    ? "text-muted-foreground"
    : automationEnabled
      ? "text-emerald-400"
      : "text-muted-foreground";

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header: editable title + actions */}
      <div className="flex items-start gap-4">
        <textarea
          ref={titleInputRef}
          className="flex-1 min-w-0 resize-none overflow-hidden bg-transparent text-xl font-bold outline-none placeholder:text-muted-foreground/50"
          placeholder={copy.routineTitle}
          rows={1}
          value={editDraft.title}
          onChange={(event) => {
            setEditDraft((current) => ({ ...current, title: event.target.value }));
            autoResizeTextarea(event.target);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.metaKey && !event.ctrlKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              descriptionEditorRef.current?.focus();
              return;
            }
            if (event.key === "Tab" && !event.shiftKey) {
              event.preventDefault();
              if (editDraft.assigneeAgentId) {
                if (editDraft.projectId) {
                  descriptionEditorRef.current?.focus();
                } else {
                  projectSelectorRef.current?.focus();
                }
              } else {
                assigneeSelectorRef.current?.focus();
              }
            }
          }}
        />
        <div className="flex shrink-0 items-center gap-3 pt-1">
          <RunButton
            onClick={() => {
              if (needsRunConfiguration) {
                setRunVariablesOpen(true);
                return;
              }
              runRoutine.mutate({});
            }}
            disabled={runRoutine.isPending}
          />
          <ToggleSwitch
            size="lg"
            checked={automationEnabled}
            onCheckedChange={() => updateRoutineStatus.mutate(automationEnabled ? "paused" : "active")}
            disabled={automationToggleDisabled}
            aria-label={automationEnabled ? copy.pauseAuto : copy.enableAuto}
          />
          <span className={`min-w-[3.75rem] text-sm font-medium ${automationLabelClassName}`}>
            {automationLabel}
          </span>
        </div>
      </div>

      {/* Secret message banner */}
      {secretMessage && (
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 space-y-3 text-sm">
          <div>
            <p className="font-medium">{secretMessage.title}</p>
            <p className="text-xs text-muted-foreground">{copy.saveNow}</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Input value={secretMessage.webhookUrl} readOnly className="flex-1" />
              <Button variant="outline" size="sm" onClick={() => copySecretValue(copy.webhookUrl, secretMessage.webhookUrl)}>
                <Copy className="h-3.5 w-3.5 mr-1" />
                {copy.url}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Input value={secretMessage.webhookSecret} readOnly className="flex-1" />
              <Button variant="outline" size="sm" onClick={() => copySecretValue(copy.webhookSecret, secretMessage.webhookSecret)}>
                <Copy className="h-3.5 w-3.5 mr-1" />
                {copy.secret}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Assignment row */}
      <div className="overflow-x-auto overscroll-x-contain">
        <div className="inline-flex min-w-full flex-wrap items-center gap-2 text-sm text-muted-foreground sm:min-w-max sm:flex-nowrap">
          <span>{copy.for}</span>
          <InlineEntitySelector
            ref={assigneeSelectorRef}
            value={editDraft.assigneeAgentId}
            options={assigneeOptions}
            placeholder={copy.assignee}
            noneLabel={copy.noAssignee}
            searchPlaceholder={copy.searchAssignees}
            emptyMessage={copy.noAssigneesFound}
            onChange={(assigneeAgentId) => {
              if (assigneeAgentId) trackRecentAssignee(assigneeAgentId);
              setEditDraft((current) => ({ ...current, assigneeAgentId }));
            }}
            onConfirm={() => {
              if (editDraft.projectId) {
                descriptionEditorRef.current?.focus();
              } else {
                projectSelectorRef.current?.focus();
              }
            }}
            renderTriggerValue={(option) =>
              option ? (
                currentAssignee ? (
                  <>
                    <AgentIcon icon={currentAssignee.icon} className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{option.label}</span>
                  </>
                ) : (
                  <span className="truncate">{option.label}</span>
                )
              ) : (
                <span className="text-muted-foreground">{copy.assignee}</span>
              )
            }
            renderOption={(option) => {
              if (!option.id) return <span className="truncate">{option.label}</span>;
              const assignee = agentById.get(option.id);
              return (
                <>
                  {assignee ? <AgentIcon icon={assignee.icon} className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : null}
                  <span className="truncate">{option.label}</span>
                </>
              );
            }}
          />
          <span>{copy.in}</span>
          <InlineEntitySelector
            ref={projectSelectorRef}
            value={editDraft.projectId}
            options={projectOptions}
            placeholder={copy.project}
            noneLabel={copy.noProject}
            searchPlaceholder={copy.searchProjects}
            emptyMessage={copy.noProjectsFound}
            onChange={(projectId) => setEditDraft((current) => ({ ...current, projectId }))}
            onConfirm={() => descriptionEditorRef.current?.focus()}
            renderTriggerValue={(option) =>
              option && currentProject ? (
                <>
                  <span
                    className="h-3.5 w-3.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: currentProject.color ?? "#64748b" }}
                  />
                  <span className="truncate">{option.label}</span>
                </>
              ) : (
                <span className="text-muted-foreground">{copy.project}</span>
              )
            }
            renderOption={(option) => {
              if (!option.id) return <span className="truncate">{option.label}</span>;
              const project = projectById.get(option.id);
              return (
                <>
                  <span
                    className="h-3.5 w-3.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: project?.color ?? "#64748b" }}
                  />
                  <span className="truncate">{option.label}</span>
                </>
              );
            }}
          />
        </div>
      </div>

      {/* Instructions */}
      <MarkdownEditor
        ref={descriptionEditorRef}
        value={editDraft.description}
        onChange={(description) => setEditDraft((current) => ({ ...current, description }))}
        placeholder={copy.addInstructions}
        bordered={false}
        contentClassName="min-h-[120px] text-[15px] leading-7"
        onSubmit={() => {
          if (!saveRoutine.isPending && editDraft.title.trim() && editDraft.projectId && editDraft.assigneeAgentId) {
            saveRoutine.mutate();
          }
        }}
      />
      <RoutineVariablesHint />
      <RoutineVariablesEditor
        title={editDraft.title}
        description={editDraft.description}
        value={editDraft.variables}
        onChange={(variables) => setEditDraft((current) => ({ ...current, variables }))}
      />

      {/* Advanced delivery settings */}
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between text-left">
          <span className="text-sm font-medium">{copy.advancedDelivery}</span>
          {advancedOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{copy.concurrency}</p>
              <Select
                value={editDraft.concurrencyPolicy}
                onValueChange={(concurrencyPolicy) => setEditDraft((current) => ({ ...current, concurrencyPolicy }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {concurrencyPolicies.map((value) => (
                    <SelectItem key={value} value={value}>{concurrencyPolicyLabel(value, uiLanguage)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{concurrencyPolicyDescriptionsForLanguage[editDraft.concurrencyPolicy]}</p>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{copy.catchUp}</p>
              <Select
                value={editDraft.catchUpPolicy}
                onValueChange={(catchUpPolicy) => setEditDraft((current) => ({ ...current, catchUpPolicy }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {catchUpPolicies.map((value) => (
                    <SelectItem key={value} value={value}>{catchUpPolicyLabel(value, uiLanguage)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{catchUpPolicyDescriptionsForLanguage[editDraft.catchUpPolicy]}</p>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Save bar */}
      <div className="flex items-center justify-between">
        {isEditDirty ? (
          <span className="text-xs text-amber-600">{copy.unsavedChanges}</span>
        ) : (
          <span />
        )}
        <Button
          onClick={() => saveRoutine.mutate()}
          disabled={saveRoutine.isPending || !editDraft.title.trim() || !editDraft.projectId || !editDraft.assigneeAgentId}
        >
          <Save className="mr-2 h-4 w-4" />
          {copy.saveRoutine}
        </Button>
      </div>

      <Separator />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3">
        <TabsList variant="line" className="w-full justify-start gap-1">
          <TabsTrigger value="triggers" className="gap-1.5">
            <Clock3 className="h-3.5 w-3.5" />
            {copy.triggers}
          </TabsTrigger>
          <TabsTrigger value="runs" className="gap-1.5">
            <Play className="h-3.5 w-3.5" />
            {copy.runs}
            {hasLiveRun && <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />}
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-1.5">
            <ActivityIcon className="h-3.5 w-3.5" />
            {copy.activity}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="triggers" className="space-y-4">
          {/* Add trigger form */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <p className="text-sm font-medium">{copy.addTrigger}</p>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">{copy.kind}</Label>
                <Select value={newTrigger.kind} onValueChange={(kind) => setNewTrigger((current) => ({ ...current, kind }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {triggerKinds.map((kind) => (
                      <SelectItem key={kind} value={kind} disabled={kind === "webhook"}>
                        {triggerKindLabel(kind, uiLanguage)}{kind === "webhook" ? ` - ${copy.comingSoon}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {newTrigger.kind === "schedule" && (
                <div className="md:col-span-2 space-y-1.5">
                  <Label className="text-xs">{copy.schedule}</Label>
                  <ScheduleEditor
                    value={newTrigger.cronExpression}
                    onChange={(cronExpression) => setNewTrigger((current) => ({ ...current, cronExpression }))}
                  />
                </div>
              )}
              {newTrigger.kind === "webhook" && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{copy.signingMode}</Label>
                    <Select value={newTrigger.signingMode} onValueChange={(signingMode) => setNewTrigger((current) => ({ ...current, signingMode }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {signingModes.map((mode) => (
                          <SelectItem key={mode} value={mode}>{signingModeLabel(mode, uiLanguage)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">{signingModeDescriptionsForLanguage[newTrigger.signingMode]}</p>
                  </div>
                  {!SIGNING_MODES_WITHOUT_REPLAY_WINDOW.has(newTrigger.signingMode) && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">{copy.replayWindow}</Label>
                      <Input value={newTrigger.replayWindowSec} onChange={(event) => setNewTrigger((current) => ({ ...current, replayWindowSec: event.target.value }))} />
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="flex items-center justify-end">
              <Button size="sm" onClick={() => createTrigger.mutate()} disabled={createTrigger.isPending}>
                {createTrigger.isPending ? copy.adding : copy.addTriggerButton}
              </Button>
            </div>
          </div>

          {/* Existing triggers */}
          {routine.triggers.length === 0 ? (
            <p className="text-xs text-muted-foreground">{copy.noTriggers}</p>
          ) : (
            <div className="space-y-3">
              {routine.triggers.map((trigger) => (
                <TriggerEditor
                  key={trigger.id}
                  trigger={trigger}
                  onSave={(id, patch) => updateTrigger.mutate({ id, patch })}
                  onRotate={(id) => rotateTrigger.mutate(id)}
                  onDelete={(id) => deleteTrigger.mutate(id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="runs" className="space-y-4">
          {hasLiveRun && activeIssueId && routine && (
            <LiveRunWidget issueId={activeIssueId} companyId={routine.companyId} />
          )}
          {(routineRuns ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">{copy.noRuns}</p>
          ) : (
            <div className="border border-border rounded-lg divide-y divide-border">
              {(routineRuns ?? []).map((run) => (
                <div key={run.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="outline" className="shrink-0">{routineRunSourceLabel(run.source, uiLanguage)}</Badge>
                    <Badge variant={run.status === "failed" ? "destructive" : "secondary"} className="shrink-0">
                      {routineStatusLabel(run.status, uiLanguage)}
                    </Badge>
                    {run.trigger && (
                      <span className="text-muted-foreground truncate">{run.trigger.label ?? run.trigger.kind}</span>
                    )}
                    {run.linkedIssue && (
                      <Link to={`/issues/${run.linkedIssue.identifier ?? run.linkedIssue.id}`} className="text-muted-foreground hover:underline truncate">
                        {run.linkedIssue.identifier ?? run.linkedIssue.id.slice(0, 8)}
                      </Link>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 ml-2">{timeAgo(run.triggeredAt)}</span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="activity">
          {(activity ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">{copy.noActivity}</p>
          ) : (
            <div className="border border-border rounded-lg divide-y divide-border">
              {(activity ?? []).map((event) => (
                <div key={event.id} className="flex items-center justify-between px-3 py-2 text-xs gap-4">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-foreground/90 shrink-0">{event.action.replaceAll(".", " ")}</span>
                    {event.details && Object.keys(event.details).length > 0 && (
                      <span className="text-muted-foreground truncate">
                        {Object.entries(event.details).slice(0, 3).map(([key, value], i) => (
                          <span key={key}>
                            {i > 0 && <span className="mx-1 text-border">·</span>}
                            <span className="text-muted-foreground/70">{key.replaceAll("_", " ")}:</span>{" "}
                            {formatActivityDetailValue(value)}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                  <span className="text-muted-foreground/60 shrink-0">{timeAgo(event.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <RoutineRunVariablesDialog
        open={runVariablesOpen}
        onOpenChange={setRunVariablesOpen}
        companyId={routine.companyId}
        project={selectedProject}
        variables={routine.variables ?? []}
        isPending={runRoutine.isPending}
        onSubmit={(data) => runRoutine.mutate(data)}
      />
    </div>
  );
}
