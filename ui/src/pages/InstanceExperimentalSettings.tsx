import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FlaskConical } from "lucide-react";
import { instanceSettingsApi } from "@/api/instanceSettings";
import { useGeneralSettings } from "@/context/GeneralSettingsContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { textFor } from "@/lib/ui-language";

export function InstanceExperimentalSettings() {
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const { uiLanguage } = useGeneralSettings();

  const copy = {
    instanceSettings: textFor(uiLanguage, {
      en: "Instance Settings",
      "zh-CN": "实例设置",
    }),
    experimental: textFor(uiLanguage, {
      en: "Experimental",
      "zh-CN": "实验功能",
    }),
    loading: textFor(uiLanguage, {
      en: "Loading experimental settings...",
      "zh-CN": "正在加载实验设置...",
    }),
    loadError: textFor(uiLanguage, {
      en: "Failed to load experimental settings.",
      "zh-CN": "加载实验设置失败。",
    }),
    updateError: textFor(uiLanguage, {
      en: "Failed to update experimental settings.",
      "zh-CN": "更新实验设置失败。",
    }),
    headerDescription: textFor(uiLanguage, {
      en: "Opt into features that are still being evaluated before they become default behavior.",
      "zh-CN": "启用仍在评估中的功能，这些功能未来可能会成为默认行为。",
    }),
    isolatedTitle: textFor(uiLanguage, {
      en: "Enable Isolated Workspaces",
      "zh-CN": "启用隔离工作区",
    }),
    isolatedDescription: textFor(uiLanguage, {
      en: "Show execution workspace controls in project configuration and allow isolated workspace behavior for new and existing issue runs.",
      "zh-CN": "在项目配置中显示执行工作区控制项，并为新的和已有的 issue 运行启用隔离工作区行为。",
    }),
    isolatedAria: textFor(uiLanguage, {
      en: "Toggle isolated workspaces experimental setting",
      "zh-CN": "切换隔离工作区实验设置",
    }),
    restartTitle: textFor(uiLanguage, {
      en: "Auto-Restart Dev Server When Idle",
      "zh-CN": "空闲时自动重启开发服务器",
    }),
    restartDescription: textFor(uiLanguage, {
      en: "In `pnpm dev:once`, wait for all queued and running local agent runs to finish, then restart the server automatically when backend changes or migrations make the current boot stale.",
      "zh-CN": "在 `pnpm dev:once` 下，等待所有排队中和运行中的本地 agent 任务结束后，当后端变更或迁移让当前启动状态过期时自动重启服务。",
    }),
    restartAria: textFor(uiLanguage, {
      en: "Toggle guarded dev-server auto-restart",
      "zh-CN": "切换开发服务器自动重启",
    }),
  };

  useEffect(() => {
    setBreadcrumbs([
      { label: copy.instanceSettings },
      { label: copy.experimental },
    ]);
  }, [copy.experimental, copy.instanceSettings, setBreadcrumbs]);

  const experimentalQuery = useQuery({
    queryKey: queryKeys.instance.experimentalSettings,
    queryFn: () => instanceSettingsApi.getExperimental(),
  });

  const toggleMutation = useMutation({
    mutationFn: async (patch: { enableIsolatedWorkspaces?: boolean; autoRestartDevServerWhenIdle?: boolean }) =>
      instanceSettingsApi.updateExperimental(patch),
    onSuccess: async () => {
      setActionError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.instance.experimentalSettings }),
        queryClient.invalidateQueries({ queryKey: queryKeys.health }),
      ]);
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : copy.updateError);
    },
  });

  if (experimentalQuery.isLoading) {
    return <div className="text-sm text-muted-foreground">{copy.loading}</div>;
  }

  if (experimentalQuery.error) {
    return (
      <div className="text-sm text-destructive">
        {experimentalQuery.error instanceof Error
          ? experimentalQuery.error.message
          : copy.loadError}
      </div>
    );
  }

  const enableIsolatedWorkspaces = experimentalQuery.data?.enableIsolatedWorkspaces === true;
  const autoRestartDevServerWhenIdle = experimentalQuery.data?.autoRestartDevServerWhenIdle === true;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">{copy.experimental}</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {copy.headerDescription}
        </p>
      </div>

      {actionError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {actionError}
        </div>
      )}

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="text-sm font-semibold">{copy.isolatedTitle}</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {copy.isolatedDescription}
            </p>
          </div>
          <ToggleSwitch
            checked={enableIsolatedWorkspaces}
            onCheckedChange={() => toggleMutation.mutate({ enableIsolatedWorkspaces: !enableIsolatedWorkspaces })}
            disabled={toggleMutation.isPending}
            aria-label={copy.isolatedAria}
          />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="text-sm font-semibold">{copy.restartTitle}</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {copy.restartDescription}
            </p>
          </div>
          <ToggleSwitch
            checked={autoRestartDevServerWhenIdle}
            onCheckedChange={() => toggleMutation.mutate({ autoRestartDevServerWhenIdle: !autoRestartDevServerWhenIdle })}
            disabled={toggleMutation.isPending}
            aria-label={copy.restartAria}
          />
        </div>
      </section>
    </div>
  );
}
