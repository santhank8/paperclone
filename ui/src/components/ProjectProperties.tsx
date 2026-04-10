import { useState } from "react";
import { Link } from "@/lib/router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Project } from "@paperclipai/shared";
import { StatusBadge } from "./StatusBadge";
import { cn, formatDate } from "../lib/utils";
import { goalsApi } from "../api/goals";
import { instanceSettingsApi } from "../api/instanceSettings";
import { projectsApi } from "../api/projects";
import { secretsApi } from "../api/secrets";
import { useCompany } from "../context/CompanyContext";
import { useGeneralSettings } from "../context/GeneralSettingsContext";
import { queryKeys } from "../lib/queryKeys";
import { statusBadge, statusBadgeDefault } from "../lib/status-colors";
import { textFor, type UiLanguage } from "../lib/ui-language";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertCircle, Archive, ArchiveRestore, Check, ExternalLink, Github, Loader2, Plus, Trash2, X } from "lucide-react";
import { ChoosePathButton } from "./PathInstructionsModal";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { DraftInput } from "./agent-config-primitives";
import { InlineEditor } from "./InlineEditor";
import { EnvVarEditor } from "./EnvVarEditor";

function buildProjectStatuses(uiLanguage: UiLanguage) {
  return [
    { value: "backlog", label: textFor(uiLanguage, { en: "Backlog", "zh-CN": "待规划" }) },
    { value: "planned", label: textFor(uiLanguage, { en: "Planned", "zh-CN": "已计划" }) },
    { value: "in_progress", label: textFor(uiLanguage, { en: "In Progress", "zh-CN": "进行中" }) },
    { value: "completed", label: textFor(uiLanguage, { en: "Completed", "zh-CN": "已完成" }) },
    { value: "cancelled", label: textFor(uiLanguage, { en: "Cancelled", "zh-CN": "已取消" }) },
  ];
}

function projectStatusLabel(status: string, uiLanguage: UiLanguage) {
  return buildProjectStatuses(uiLanguage).find((entry) => entry.value === status)?.label ?? status.replaceAll("_", " ");
}

function runtimeServiceStatusLabel(status: string, uiLanguage: UiLanguage) {
  const labels: Record<string, { en: string; "zh-CN": string }> = {
    starting: { en: "Starting", "zh-CN": "启动中" },
    running: { en: "Running", "zh-CN": "运行中" },
    stopped: { en: "Stopped", "zh-CN": "已停止" },
    failed: { en: "Failed", "zh-CN": "失败" },
  };
  return textFor(uiLanguage, labels[status] ?? { en: status, "zh-CN": status });
}

function runtimeServiceLifecycleLabel(lifecycle: string, uiLanguage: UiLanguage) {
  const labels: Record<string, { en: string; "zh-CN": string }> = {
    shared: { en: "Shared", "zh-CN": "共享" },
    ephemeral: { en: "Ephemeral", "zh-CN": "临时" },
  };
  return textFor(uiLanguage, labels[lifecycle] ?? { en: lifecycle, "zh-CN": lifecycle });
}

interface ProjectPropertiesProps {
  project: Project;
  onUpdate?: (data: Record<string, unknown>) => void;
  onFieldUpdate?: (field: ProjectConfigFieldKey, data: Record<string, unknown>) => void;
  getFieldSaveState?: (field: ProjectConfigFieldKey) => ProjectFieldSaveState;
  onArchive?: (archived: boolean) => void;
  archivePending?: boolean;
}

export type ProjectFieldSaveState = "idle" | "saving" | "saved" | "error";
export type ProjectConfigFieldKey =
  | "name"
  | "description"
  | "status"
  | "goals"
  | "env"
  | "execution_workspace_enabled"
  | "execution_workspace_default_mode"
  | "execution_workspace_base_ref"
  | "execution_workspace_branch_template"
  | "execution_workspace_worktree_parent_dir"
  | "execution_workspace_provision_command"
  | "execution_workspace_teardown_command";

function SaveIndicator({ state, uiLanguage }: { state: ProjectFieldSaveState; uiLanguage: UiLanguage }) {
  if (state === "saving") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        {textFor(uiLanguage, { en: "Saving", "zh-CN": "保存中" })}
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-green-600 dark:text-green-400">
        <Check className="h-3 w-3" />
        {textFor(uiLanguage, { en: "Saved", "zh-CN": "已保存" })}
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-destructive">
        <AlertCircle className="h-3 w-3" />
        {textFor(uiLanguage, { en: "Failed", "zh-CN": "失败" })}
      </span>
    );
  }
  return null;
}

function FieldLabel({
  label,
  state,
  uiLanguage,
}: {
  label: string;
  state: ProjectFieldSaveState;
  uiLanguage: UiLanguage;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <SaveIndicator state={state} uiLanguage={uiLanguage} />
    </div>
  );
}

function PropertyRow({
  label,
  children,
  alignStart = false,
  valueClassName = "",
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  alignStart?: boolean;
  valueClassName?: string;
}) {
  return (
    <div className={cn("flex gap-3 py-1.5", alignStart ? "items-start" : "items-center")}>
      <div className="shrink-0 w-20">{label}</div>
      <div className={cn("min-w-0 flex-1", alignStart ? "pt-0.5" : "flex items-center gap-1.5", valueClassName)}>
        {children}
      </div>
    </div>
  );
}

function ProjectStatusPicker({
  status,
  onChange,
  uiLanguage,
}: {
  status: string;
  onChange: (status: string) => void;
  uiLanguage: UiLanguage;
}) {
  const [open, setOpen] = useState(false);
  const colorClass = statusBadge[status] ?? statusBadgeDefault;
  const statuses = buildProjectStatuses(uiLanguage);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer hover:opacity-80 transition-opacity",
            colorClass,
          )}
        >
          {projectStatusLabel(status, uiLanguage)}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-40 p-1" align="start">
        {statuses.map((s) => (
          <Button
            key={s.value}
            variant="ghost"
            size="sm"
            className={cn("w-full justify-start gap-2 text-xs", s.value === status && "bg-accent")}
            onClick={() => {
              onChange(s.value);
              setOpen(false);
            }}
          >
            {s.label}
          </Button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function ArchiveDangerZone({
  project,
  onArchive,
  archivePending,
  uiLanguage,
}: {
  project: Project;
  onArchive: (archived: boolean) => void;
  archivePending?: boolean;
  uiLanguage: UiLanguage;
}) {
  const [confirming, setConfirming] = useState(false);
  const isArchive = !project.archivedAt;
  const action = isArchive
    ? textFor(uiLanguage, { en: "Archive", "zh-CN": "归档" })
    : textFor(uiLanguage, { en: "Unarchive", "zh-CN": "取消归档" });

  return (
    <div className="space-y-3 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-4">
      <p className="text-sm text-muted-foreground">
        {isArchive
          ? textFor(
              uiLanguage,
              {
                en: "Archive this project to hide it from the sidebar and project selectors.",
                "zh-CN": "归档后，此项目会从侧边栏和项目选择器中隐藏。",
              },
            )
          : textFor(
              uiLanguage,
              {
                en: "Unarchive this project to restore it in the sidebar and project selectors.",
                "zh-CN": "取消归档后，此项目会重新出现在侧边栏和项目选择器中。",
              },
            )}
      </p>
      {archivePending ? (
        <Button size="sm" variant="destructive" disabled>
          <Loader2 className="h-3 w-3 animate-spin mr-1" />
          {isArchive
            ? textFor(uiLanguage, { en: "Archiving...", "zh-CN": "归档中..." })
            : textFor(uiLanguage, { en: "Unarchiving...", "zh-CN": "取消归档中..." })}
        </Button>
      ) : confirming ? (
        <div className="flex items-center gap-2">
          <span className="text-sm text-destructive font-medium">
            {action} &ldquo;{project.name}&rdquo;?
          </span>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              setConfirming(false);
              onArchive(isArchive);
            }}
          >
            {textFor(uiLanguage, { en: "Confirm", "zh-CN": "确认" })}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfirming(false)}
          >
            {textFor(uiLanguage, { en: "Cancel", "zh-CN": "取消" })}
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="destructive"
          onClick={() => setConfirming(true)}
        >
          {isArchive ? (
            <><Archive className="h-3 w-3 mr-1" />{textFor(uiLanguage, { en: "Archive project", "zh-CN": "归档项目" })}</>
          ) : (
            <><ArchiveRestore className="h-3 w-3 mr-1" />{textFor(uiLanguage, { en: "Unarchive project", "zh-CN": "取消归档项目" })}</>
          )}
        </Button>
      )}
    </div>
  );
}

export function ProjectProperties({ project, onUpdate, onFieldUpdate, getFieldSaveState, onArchive, archivePending }: ProjectPropertiesProps) {
  const { selectedCompanyId } = useCompany();
  const { uiLanguage } = useGeneralSettings();
  const queryClient = useQueryClient();
  const [goalOpen, setGoalOpen] = useState(false);
  const [executionWorkspaceAdvancedOpen, setExecutionWorkspaceAdvancedOpen] = useState(false);
  const [workspaceMode, setWorkspaceMode] = useState<"local" | "repo" | null>(null);
  const [workspaceCwd, setWorkspaceCwd] = useState("");
  const [workspaceRepoUrl, setWorkspaceRepoUrl] = useState("");
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const t = (en: string, zh: string) => textFor(uiLanguage, { en, "zh-CN": zh });

  const commitField = (field: ProjectConfigFieldKey, data: Record<string, unknown>) => {
    if (onFieldUpdate) {
      onFieldUpdate(field, data);
      return;
    }
    onUpdate?.(data);
  };
  const fieldState = (field: ProjectConfigFieldKey): ProjectFieldSaveState => getFieldSaveState?.(field) ?? "idle";

  const { data: allGoals } = useQuery({
    queryKey: queryKeys.goals.list(selectedCompanyId!),
    queryFn: () => goalsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const { data: experimentalSettings } = useQuery({
    queryKey: queryKeys.instance.experimentalSettings,
    queryFn: () => instanceSettingsApi.getExperimental(),
    retry: false,
  });
  const { data: availableSecrets = [] } = useQuery({
    queryKey: selectedCompanyId ? queryKeys.secrets.list(selectedCompanyId) : ["secrets", "none"],
    queryFn: () => secretsApi.list(selectedCompanyId!),
    enabled: Boolean(selectedCompanyId),
  });
  const createSecret = useMutation({
    mutationFn: (input: { name: string; value: string }) => {
      if (!selectedCompanyId) throw new Error(t("Select a company to create secrets", "请选择公司以创建密钥"));
      return secretsApi.create(selectedCompanyId, input);
    },
    onSuccess: () => {
      if (!selectedCompanyId) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.secrets.list(selectedCompanyId) });
    },
  });

  const linkedGoalIds = project.goalIds.length > 0
    ? project.goalIds
    : project.goalId
      ? [project.goalId]
      : [];

  const linkedGoals = project.goals.length > 0
    ? project.goals
    : linkedGoalIds.map((id) => ({
        id,
        title: allGoals?.find((g) => g.id === id)?.title ?? id.slice(0, 8),
      }));

  const availableGoals = (allGoals ?? []).filter((g) => !linkedGoalIds.includes(g.id));
  const workspaces = project.workspaces ?? [];
  const codebase = project.codebase;
  const primaryCodebaseWorkspace = project.primaryWorkspace ?? null;
  const hasAdditionalLegacyWorkspaces = workspaces.some((workspace) => workspace.id !== primaryCodebaseWorkspace?.id);
  const executionWorkspacePolicy = project.executionWorkspacePolicy ?? null;
  const executionWorkspacesEnabled = executionWorkspacePolicy?.enabled === true;
  const isolatedWorkspacesEnabled = experimentalSettings?.enableIsolatedWorkspaces === true;
  const executionWorkspaceDefaultMode =
    executionWorkspacePolicy?.defaultMode === "isolated_workspace" ? "isolated_workspace" : "shared_workspace";
  const executionWorkspaceStrategy = executionWorkspacePolicy?.workspaceStrategy ?? {
    type: "git_worktree",
    baseRef: "",
    branchTemplate: "",
    worktreeParentDir: "",
  };

  const invalidateProject = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(project.id) });
    if (project.urlKey !== project.id) {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(project.urlKey) });
    }
    if (selectedCompanyId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.list(selectedCompanyId) });
    }
  };

  const createWorkspace = useMutation({
    mutationFn: (data: Record<string, unknown>) => projectsApi.createWorkspace(project.id, data),
    onSuccess: () => {
      setWorkspaceCwd("");
      setWorkspaceRepoUrl("");
      setWorkspaceMode(null);
      setWorkspaceError(null);
      invalidateProject();
    },
  });

  const removeWorkspace = useMutation({
    mutationFn: (workspaceId: string) => projectsApi.removeWorkspace(project.id, workspaceId),
    onSuccess: () => {
      setWorkspaceCwd("");
      setWorkspaceRepoUrl("");
      setWorkspaceMode(null);
      setWorkspaceError(null);
      invalidateProject();
    },
  });
  const updateWorkspace = useMutation({
    mutationFn: ({ workspaceId, data }: { workspaceId: string; data: Record<string, unknown> }) =>
      projectsApi.updateWorkspace(project.id, workspaceId, data),
    onSuccess: () => {
      setWorkspaceCwd("");
      setWorkspaceRepoUrl("");
      setWorkspaceMode(null);
      setWorkspaceError(null);
      invalidateProject();
    },
  });

  const removeGoal = (goalId: string) => {
    if (!onUpdate && !onFieldUpdate) return;
    commitField("goals", { goalIds: linkedGoalIds.filter((id) => id !== goalId) });
  };

  const addGoal = (goalId: string) => {
    if ((!onUpdate && !onFieldUpdate) || linkedGoalIds.includes(goalId)) return;
    commitField("goals", { goalIds: [...linkedGoalIds, goalId] });
    setGoalOpen(false);
  };

  const updateExecutionWorkspacePolicy = (patch: Record<string, unknown>) => {
    if (!onUpdate && !onFieldUpdate) return;
    return {
      executionWorkspacePolicy: {
        enabled: executionWorkspacesEnabled,
        defaultMode: executionWorkspaceDefaultMode,
        allowIssueOverride: executionWorkspacePolicy?.allowIssueOverride ?? true,
        ...executionWorkspacePolicy,
        ...patch,
      },
    };
  };

  const isAbsolutePath = (value: string) => value.startsWith("/") || /^[A-Za-z]:[\\/]/.test(value);

  const looksLikeRepoUrl = (value: string) => {
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== "https:") return false;
      const segments = parsed.pathname.split("/").filter(Boolean);
      return segments.length >= 2;
    } catch {
      return false;
    }
  };

  const isSafeExternalUrl = (value: string | null | undefined) => {
    if (!value) return false;
    try {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  };

  const formatRepoUrl = (value: string) => {
    try {
      const parsed = new URL(value);
      const segments = parsed.pathname.split("/").filter(Boolean);
      if (segments.length < 2) return parsed.host;
      const owner = segments[0];
      const repo = segments[1]?.replace(/\.git$/i, "");
      if (!owner || !repo) return parsed.host;
      return `${parsed.host}/${owner}/${repo}`;
    } catch {
      return value;
    }
  };

  const deriveSourceType = (cwd: string | null, repoUrl: string | null) => {
    if (repoUrl) return "git_repo";
    if (cwd) return "local_path";
    return undefined;
  };

  const persistCodebase = (patch: { cwd?: string | null; repoUrl?: string | null }) => {
    const nextCwd = patch.cwd !== undefined ? patch.cwd : codebase.localFolder;
    const nextRepoUrl = patch.repoUrl !== undefined ? patch.repoUrl : codebase.repoUrl;
    if (!nextCwd && !nextRepoUrl) {
      if (primaryCodebaseWorkspace) {
        removeWorkspace.mutate(primaryCodebaseWorkspace.id);
      }
      return;
    }

    const data: Record<string, unknown> = {
      ...(patch.cwd !== undefined ? { cwd: patch.cwd } : {}),
      ...(patch.repoUrl !== undefined ? { repoUrl: patch.repoUrl } : {}),
      ...(deriveSourceType(nextCwd, nextRepoUrl) ? { sourceType: deriveSourceType(nextCwd, nextRepoUrl) } : {}),
      isPrimary: true,
    };

    if (primaryCodebaseWorkspace) {
      updateWorkspace.mutate({ workspaceId: primaryCodebaseWorkspace.id, data });
      return;
    }

    createWorkspace.mutate(data);
  };

  const submitLocalWorkspace = () => {
    const cwd = workspaceCwd.trim();
    if (!cwd) {
      setWorkspaceError(null);
      persistCodebase({ cwd: null });
      return;
    }
    if (!isAbsolutePath(cwd)) {
      setWorkspaceError(t("Local folder must be a full absolute path.", "本地文件夹必须是完整的绝对路径。"));
      return;
    }
    setWorkspaceError(null);
    persistCodebase({ cwd });
  };

  const submitRepoWorkspace = () => {
    const repoUrl = workspaceRepoUrl.trim();
    if (!repoUrl) {
      setWorkspaceError(null);
      persistCodebase({ repoUrl: null });
      return;
    }
    if (!looksLikeRepoUrl(repoUrl)) {
      setWorkspaceError(t("Repo must use a valid GitHub or GitHub Enterprise repo URL.", "仓库必须使用有效的 GitHub 或 GitHub Enterprise 仓库 URL。"));
      return;
    }
    setWorkspaceError(null);
    persistCodebase({ repoUrl });
  };

  const clearLocalWorkspace = () => {
    const confirmed = window.confirm(
      codebase.repoUrl
        ? t("Clear local folder from this workspace?", "要从此工作区中清除本地文件夹吗？")
        : t("Delete this workspace local folder?", "要删除此工作区的本地文件夹吗？"),
    );
    if (!confirmed) return;
    persistCodebase({ cwd: null });
  };

  const clearRepoWorkspace = () => {
    const hasLocalFolder = Boolean(codebase.localFolder);
    const confirmed = window.confirm(
      hasLocalFolder
        ? t("Clear repo from this workspace?", "要从此工作区中清除仓库吗？")
        : t("Delete this workspace repo?", "要删除此工作区的仓库吗？"),
    );
    if (!confirmed) return;
    if (primaryCodebaseWorkspace && hasLocalFolder) {
      updateWorkspace.mutate({
        workspaceId: primaryCodebaseWorkspace.id,
        data: { repoUrl: null, repoRef: null, defaultRef: null, sourceType: deriveSourceType(codebase.localFolder, null) },
      });
      return;
    }
    persistCodebase({ repoUrl: null });
  };

  return (
    <div>
      <div className="space-y-1 pb-4">
        <PropertyRow label={<FieldLabel label={t("Name", "名称")} state={fieldState("name")} uiLanguage={uiLanguage} />}>
          {onUpdate || onFieldUpdate ? (
            <DraftInput
              value={project.name}
              onCommit={(name) => commitField("name", { name })}
              immediate
              className="w-full rounded border border-border bg-transparent px-2 py-1 text-sm outline-none"
              placeholder={t("Project name", "项目名称")}
            />
          ) : (
            <span className="text-sm">{project.name}</span>
          )}
        </PropertyRow>
        <PropertyRow
          label={<FieldLabel label={t("Description", "描述")} state={fieldState("description")} uiLanguage={uiLanguage} />}
          alignStart
          valueClassName="space-y-0.5"
        >
          {onUpdate || onFieldUpdate ? (
            <InlineEditor
              value={project.description ?? ""}
              onSave={(description) => commitField("description", { description })}
              nullable
              as="p"
              className="text-sm text-muted-foreground"
              placeholder={t("Add a description...", "添加描述...")}
              multiline
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              {project.description?.trim() || t("No description", "暂无描述")}
            </p>
          )}
        </PropertyRow>
        <PropertyRow label={<FieldLabel label={t("Status", "状态")} state={fieldState("status")} uiLanguage={uiLanguage} />}>
          {onUpdate || onFieldUpdate ? (
            <ProjectStatusPicker
              status={project.status}
              onChange={(status) => commitField("status", { status })}
              uiLanguage={uiLanguage}
            />
          ) : (
            <StatusBadge status={project.status} />
          )}
        </PropertyRow>
        {project.leadAgentId && (
          <PropertyRow label={t("Lead", "负责人")}>
            <span className="text-sm font-mono">{project.leadAgentId.slice(0, 8)}</span>
          </PropertyRow>
        )}
        <PropertyRow
          label={<FieldLabel label={t("Goals", "目标")} state={fieldState("goals")} uiLanguage={uiLanguage} />}
          alignStart
          valueClassName="space-y-2"
        >
          {linkedGoals.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {linkedGoals.map((goal) => (
                <span
                  key={goal.id}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs"
                >
                  <Link to={`/goals/${goal.id}`} className="hover:underline max-w-[220px] truncate">
                    {goal.title}
                  </Link>
                  {(onUpdate || onFieldUpdate) && (
                    <button
                      className="text-muted-foreground hover:text-foreground"
                      type="button"
                      onClick={() => removeGoal(goal.id)}
                      aria-label={t(`Remove goal ${goal.title}`, `移除目标 ${goal.title}`)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}
          {(onUpdate || onFieldUpdate) && (
            <Popover open={goalOpen} onOpenChange={setGoalOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="xs"
                  className={cn("h-6 w-fit px-2", linkedGoals.length > 0 && "ml-1")}
                  disabled={availableGoals.length === 0}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {t("Goal", "目标")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-1" align="start">
                {availableGoals.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    {t("All goals linked.", "所有目标均已关联。")}
                  </div>
                ) : (
                  availableGoals.map((goal) => (
                    <button
                      key={goal.id}
                      className="flex items-center w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50"
                      onClick={() => addGoal(goal.id)}
                    >
                      {goal.title}
                    </button>
                  ))
                )}
              </PopoverContent>
            </Popover>
          )}
        </PropertyRow>
        <PropertyRow
          label={<FieldLabel label={t("Env", "环境变量")} state={fieldState("env")} uiLanguage={uiLanguage} />}
          alignStart
          valueClassName="space-y-2"
        >
          <div className="space-y-2">
            <EnvVarEditor
              value={project.env ?? {}}
              secrets={availableSecrets}
              onCreateSecret={async (name, value) => {
                const created = await createSecret.mutateAsync({ name, value });
                return created;
              }}
              onChange={(env) => commitField("env", { env: env ?? null })}
            />
            <p className="text-[11px] text-muted-foreground">
              {t(
                "Applied to all runs for issues in this project. Project values override agent env on key conflicts.",
                "应用于此项目下所有任务的运行。若键冲突，项目级值会覆盖智能体环境变量。",
              )}
            </p>
          </div>
        </PropertyRow>
        <PropertyRow label={<FieldLabel label={t("Created", "创建时间")} state="idle" uiLanguage={uiLanguage} />}>
          <span className="text-sm">{formatDate(project.createdAt)}</span>
        </PropertyRow>
        <PropertyRow label={<FieldLabel label={t("Updated", "更新时间")} state="idle" uiLanguage={uiLanguage} />}>
          <span className="text-sm">{formatDate(project.updatedAt)}</span>
        </PropertyRow>
        {project.targetDate && (
          <PropertyRow label={<FieldLabel label={t("Target Date", "目标日期")} state="idle" uiLanguage={uiLanguage} />}>
            <span className="text-sm">{formatDate(project.targetDate)}</span>
          </PropertyRow>
        )}
      </div>

      <Separator className="my-4" />

      <div className="space-y-1 py-4">
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>{t("Codebase", "代码库")}</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border text-[10px] text-muted-foreground hover:text-foreground"
                  aria-label={t("Codebase help", "代码库帮助")}
                >
                  ?
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {t(
                  "Repo identifies the source of truth. Local folder is the default place agents write code.",
                  "仓库用于标识代码的事实来源，本地文件夹则是智能体默认写入代码的位置。",
                )}
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="space-y-2 rounded-md border border-border/70 p-3">
            <div className="space-y-1">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("Repo", "仓库")}</div>
              {codebase.repoUrl ? (
                <div className="flex items-center justify-between gap-2">
                  {isSafeExternalUrl(codebase.repoUrl) ? (
                    <a
                      href={codebase.repoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:underline"
                    >
                      <Github className="h-3 w-3 shrink-0" />
                      <span className="truncate">{formatRepoUrl(codebase.repoUrl)}</span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  ) : (
                    <div className="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                      <Github className="h-3 w-3 shrink-0" />
                      <span className="truncate">{codebase.repoUrl}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="xs"
                      className="h-6 px-2"
                      onClick={() => {
                        setWorkspaceMode("repo");
                        setWorkspaceRepoUrl(codebase.repoUrl ?? "");
                        setWorkspaceError(null);
                      }}
                    >
                      {t("Change repo", "更改仓库")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={clearRepoWorkspace}
                      aria-label={t("Clear repo", "清除仓库")}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs text-muted-foreground">{t("Not set.", "未设置。")}</div>
                  <Button
                    variant="outline"
                    size="xs"
                    className="h-6 px-2"
                    onClick={() => {
                      setWorkspaceMode("repo");
                      setWorkspaceRepoUrl(codebase.repoUrl ?? "");
                      setWorkspaceError(null);
                    }}
                  >
                    {t("Set repo", "设置仓库")}
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("Local folder", "本地文件夹")}</div>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <div className="min-w-0 truncate font-mono text-xs text-muted-foreground">
                    {codebase.effectiveLocalFolder}
                  </div>
                  {codebase.origin === "managed_checkout" && (
                    <div className="text-[11px] text-muted-foreground">{t("Paperclip-managed folder.", "由 Paperclip 管理的文件夹。")}</div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="xs"
                    className="h-6 px-2"
                    onClick={() => {
                      setWorkspaceMode("local");
                      setWorkspaceCwd(codebase.localFolder ?? "");
                      setWorkspaceError(null);
                    }}
                  >
                    {codebase.localFolder
                      ? t("Change local folder", "更改本地文件夹")
                      : t("Set local folder", "设置本地文件夹")}
                  </Button>
                  {codebase.localFolder ? (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={clearLocalWorkspace}
                      aria-label={t("Clear local folder", "清除本地文件夹")}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>

            {hasAdditionalLegacyWorkspaces && (
              <div className="text-[11px] text-muted-foreground">
                {t(
                  "Additional legacy workspace records exist on this project. Paperclip is using the primary workspace as the codebase view.",
                  "此项目中还存在额外的旧版工作区记录。Paperclip 当前使用主工作区作为代码库视图。",
                )}
              </div>
            )}

            {primaryCodebaseWorkspace?.runtimeServices && primaryCodebaseWorkspace.runtimeServices.length > 0 ? (
              <div className="space-y-1">
                {primaryCodebaseWorkspace.runtimeServices.map((service) => (
                  <div
                    key={service.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2 py-1"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium">{service.serviceName}</span>
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-0.5 text-[10px] uppercase tracking-wide",
                            service.status === "running"
                              ? "bg-green-500/15 text-green-700 dark:text-green-300"
                              : service.status === "failed"
                                ? "bg-red-500/15 text-red-700 dark:text-red-300"
                                : "bg-muted text-muted-foreground",
                          )}
                        >
                          {runtimeServiceStatusLabel(service.status, uiLanguage)}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {service.url ? (
                          <a
                            href={service.url}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-foreground hover:underline"
                          >
                            {service.url}
                          </a>
                        ) : (
                          service.command ?? t("No URL", "无 URL")
                        )}
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {runtimeServiceLifecycleLabel(service.lifecycle, uiLanguage)}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          {workspaceMode === "local" && (
            <div className="space-y-1.5 rounded-md border border-border p-2">
              <div className="flex items-center gap-2">
                <input
                  className="w-full rounded border border-border bg-transparent px-2 py-1 text-xs font-mono outline-none"
                  value={workspaceCwd}
                  onChange={(e) => setWorkspaceCwd(e.target.value)}
                  placeholder="/absolute/path/to/workspace"
                />
                <ChoosePathButton />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="xs"
                  className="h-6 px-2"
                  disabled={(!workspaceCwd.trim() && !primaryCodebaseWorkspace) || createWorkspace.isPending || updateWorkspace.isPending}
                  onClick={submitLocalWorkspace}
                >
                  {t("Save", "保存")}
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  className="h-6 px-2"
                  onClick={() => {
                    setWorkspaceMode(null);
                    setWorkspaceCwd("");
                    setWorkspaceError(null);
                  }}
                >
                  {t("Cancel", "取消")}
                </Button>
              </div>
            </div>
          )}
          {workspaceMode === "repo" && (
            <div className="space-y-1.5 rounded-md border border-border p-2">
              <input
                className="w-full rounded border border-border bg-transparent px-2 py-1 text-xs outline-none"
                value={workspaceRepoUrl}
                onChange={(e) => setWorkspaceRepoUrl(e.target.value)}
                placeholder="https://github.com/org/repo"
              />
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="xs"
                  className="h-6 px-2"
                  disabled={(!workspaceRepoUrl.trim() && !primaryCodebaseWorkspace) || createWorkspace.isPending || updateWorkspace.isPending}
                  onClick={submitRepoWorkspace}
                >
                  {t("Save", "保存")}
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  className="h-6 px-2"
                  onClick={() => {
                    setWorkspaceMode(null);
                    setWorkspaceRepoUrl("");
                    setWorkspaceError(null);
                  }}
                >
                  {t("Cancel", "取消")}
                </Button>
              </div>
            </div>
          )}
          {workspaceError && (
            <p className="text-xs text-destructive">{workspaceError}</p>
          )}
          {createWorkspace.isError && (
            <p className="text-xs text-destructive">{t("Failed to save workspace.", "保存工作区失败。")}</p>
          )}
          {removeWorkspace.isError && (
            <p className="text-xs text-destructive">{t("Failed to delete workspace.", "删除工作区失败。")}</p>
          )}
          {updateWorkspace.isError && (
            <p className="text-xs text-destructive">{t("Failed to update workspace.", "更新工作区失败。")}</p>
          )}
        </div>

        {isolatedWorkspacesEnabled ? (
          <>
            <Separator className="my-4" />

            <div className="py-1.5 space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>{t("Execution Workspaces", "执行工作区")}</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border text-[10px] text-muted-foreground hover:text-foreground"
                      aria-label={t("Execution workspaces help", "执行工作区帮助")}
                    >
                      ?
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {t(
                      "Project-owned defaults for isolated issue checkouts and execution workspace behavior.",
                      "项目级默认设置，用于控制隔离任务检出和执行工作区行为。",
                    )}
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <span>{t("Enable isolated issue checkouts", "启用隔离任务检出")}</span>
                      <SaveIndicator state={fieldState("execution_workspace_enabled")} uiLanguage={uiLanguage} />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t(
                        "Let issues choose between the project's primary checkout and an isolated execution workspace.",
                        "允许任务在项目主检出和隔离执行工作区之间选择。",
                      )}
                    </div>
                  </div>
                  {onUpdate || onFieldUpdate ? (
                    <ToggleSwitch
                      checked={executionWorkspacesEnabled}
                      onCheckedChange={() =>
                        commitField(
                          "execution_workspace_enabled",
                          updateExecutionWorkspacePolicy({ enabled: !executionWorkspacesEnabled })!,
                        )}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {executionWorkspacesEnabled ? t("Enabled", "已启用") : t("Disabled", "已禁用")}
                    </span>
                  )}
                </div>

                {executionWorkspacesEnabled ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 text-sm">
                          <span>{t("New issues default to isolated checkout", "新任务默认使用隔离检出")}</span>
                          <SaveIndicator state={fieldState("execution_workspace_default_mode")} uiLanguage={uiLanguage} />
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {t(
                            "If disabled, new issues stay on the project's primary checkout unless someone opts in.",
                            "关闭后，新任务将默认停留在项目主检出中，除非有人手动开启隔离工作区。",
                          )}
                        </div>
                      </div>
                      <ToggleSwitch
                        checked={executionWorkspaceDefaultMode === "isolated_workspace"}
                        onCheckedChange={() =>
                          commitField(
                            "execution_workspace_default_mode",
                            updateExecutionWorkspacePolicy({
                              defaultMode:
                                executionWorkspaceDefaultMode === "isolated_workspace"
                                  ? "shared_workspace"
                                  : "isolated_workspace",
                            })!,
                          )}
                      />
                    </div>

                    <div className="border-t border-border/60 pt-2">
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                        onClick={() => setExecutionWorkspaceAdvancedOpen((open) => !open)}
                      >
                        {executionWorkspaceAdvancedOpen
                          ? t("Hide advanced checkout settings", "隐藏高级检出设置")
                          : t("Show advanced checkout settings", "显示高级检出设置")}
                      </button>
                    </div>

                    {executionWorkspaceAdvancedOpen ? (
                      <div className="space-y-3">
                        <div className="text-xs text-muted-foreground">
                          {t("Host-managed implementation:", "宿主管理实现：")} <span className="text-foreground">Git worktree</span>
                        </div>
                        <div>
                          <div className="mb-1 flex items-center gap-1.5">
                            <label className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{t("Base ref", "基础引用")}</span>
                              <SaveIndicator state={fieldState("execution_workspace_base_ref")} uiLanguage={uiLanguage} />
                            </label>
                          </div>
                          <DraftInput
                            value={executionWorkspaceStrategy.baseRef ?? ""}
                            onCommit={(value) =>
                              commitField("execution_workspace_base_ref", {
                                ...updateExecutionWorkspacePolicy({
                                  workspaceStrategy: {
                                    ...executionWorkspaceStrategy,
                                    type: "git_worktree",
                                    baseRef: value || null,
                                  },
                                })!,
                              })}
                            immediate
                            className="w-full rounded border border-border bg-transparent px-2 py-1 text-xs font-mono outline-none"
                            placeholder="origin/main"
                          />
                        </div>
                        <div>
                          <div className="mb-1 flex items-center gap-1.5">
                            <label className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{t("Branch template", "分支模板")}</span>
                              <SaveIndicator state={fieldState("execution_workspace_branch_template")} uiLanguage={uiLanguage} />
                            </label>
                          </div>
                          <DraftInput
                            value={executionWorkspaceStrategy.branchTemplate ?? ""}
                            onCommit={(value) =>
                              commitField("execution_workspace_branch_template", {
                                ...updateExecutionWorkspacePolicy({
                                  workspaceStrategy: {
                                    ...executionWorkspaceStrategy,
                                    type: "git_worktree",
                                    branchTemplate: value || null,
                                  },
                                })!,
                              })}
                            immediate
                            className="w-full rounded border border-border bg-transparent px-2 py-1 text-xs font-mono outline-none"
                            placeholder="{{issue.identifier}}-{{slug}}"
                          />
                        </div>
                        <div>
                          <div className="mb-1 flex items-center gap-1.5">
                            <label className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{t("Worktree parent dir", "工作树父目录")}</span>
                              <SaveIndicator state={fieldState("execution_workspace_worktree_parent_dir")} uiLanguage={uiLanguage} />
                            </label>
                          </div>
                          <DraftInput
                            value={executionWorkspaceStrategy.worktreeParentDir ?? ""}
                            onCommit={(value) =>
                              commitField("execution_workspace_worktree_parent_dir", {
                                ...updateExecutionWorkspacePolicy({
                                  workspaceStrategy: {
                                    ...executionWorkspaceStrategy,
                                    type: "git_worktree",
                                    worktreeParentDir: value || null,
                                  },
                                })!,
                              })}
                            immediate
                            className="w-full rounded border border-border bg-transparent px-2 py-1 text-xs font-mono outline-none"
                            placeholder=".paperclip/worktrees"
                          />
                        </div>
                        <div>
                          <div className="mb-1 flex items-center gap-1.5">
                            <label className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{t("Provision command", "准备命令")}</span>
                              <SaveIndicator state={fieldState("execution_workspace_provision_command")} uiLanguage={uiLanguage} />
                            </label>
                          </div>
                          <DraftInput
                            value={executionWorkspaceStrategy.provisionCommand ?? ""}
                            onCommit={(value) =>
                              commitField("execution_workspace_provision_command", {
                                ...updateExecutionWorkspacePolicy({
                                  workspaceStrategy: {
                                    ...executionWorkspaceStrategy,
                                    type: "git_worktree",
                                    provisionCommand: value || null,
                                  },
                                })!,
                              })}
                            immediate
                            className="w-full rounded border border-border bg-transparent px-2 py-1 text-xs font-mono outline-none"
                            placeholder="bash ./scripts/provision-worktree.sh"
                          />
                        </div>
                        <div>
                          <div className="mb-1 flex items-center gap-1.5">
                            <label className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{t("Teardown command", "清理命令")}</span>
                              <SaveIndicator state={fieldState("execution_workspace_teardown_command")} uiLanguage={uiLanguage} />
                            </label>
                          </div>
                          <DraftInput
                            value={executionWorkspaceStrategy.teardownCommand ?? ""}
                            onCommit={(value) =>
                              commitField("execution_workspace_teardown_command", {
                                ...updateExecutionWorkspacePolicy({
                                  workspaceStrategy: {
                                    ...executionWorkspaceStrategy,
                                    type: "git_worktree",
                                    teardownCommand: value || null,
                                  },
                                })!,
                              })}
                            immediate
                            className="w-full rounded border border-border bg-transparent px-2 py-1 text-xs font-mono outline-none"
                            placeholder="bash ./scripts/teardown-worktree.sh"
                          />
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {t(
                            "Provision runs inside the derived worktree before agent execution. Teardown is stored here for future cleanup flows.",
                            "准备命令会在派生出的 worktree 中、智能体执行前运行。清理命令会保存在这里，供后续清理流程使用。",
                          )}
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </>
        ) : null}

      </div>

      {onArchive && (
        <>
          <Separator className="my-4" />
          <div className="space-y-4 py-4">
            <div className="text-xs font-medium text-destructive uppercase tracking-wide">
              {t("Danger Zone", "危险操作区")}
            </div>
            <ArchiveDangerZone
              project={project}
              onArchive={onArchive}
              archivePending={archivePending}
              uiLanguage={uiLanguage}
            />
          </div>
        </>
      )}
    </div>
  );
}
