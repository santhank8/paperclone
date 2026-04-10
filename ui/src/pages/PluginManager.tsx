/**
 * @fileoverview Plugin Manager page — admin UI for discovering,
 * installing, enabling/disabling, and uninstalling plugins.
 *
 * @see PLUGIN_SPEC.md §9 — Plugin Marketplace / Manager
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { PluginRecord } from "@paperclipai/shared";
import { Link } from "@/lib/router";
import { AlertTriangle, FlaskConical, Plus, Power, Puzzle, Settings, Trash } from "lucide-react";
import { useCompany } from "@/context/CompanyContext";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { useGeneralSettings } from "@/context/GeneralSettingsContext";
import { pluginsApi } from "@/api/plugins";
import { queryKeys } from "@/lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/context/ToastContext";
import { cn } from "@/lib/utils";
import { textFor, type UiLanguage } from "@/lib/ui-language";

function firstNonEmptyLine(value: string | null | undefined): string | null {
  if (!value) return null;
  const line = value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find(Boolean);
  return line ?? null;
}

function getPluginErrorSummary(plugin: PluginRecord, fallback: string): string {
  return firstNonEmptyLine(plugin.lastError) ?? fallback;
}

function getPluginStatusLabel(language: UiLanguage, status: string): string {
  switch (status) {
    case "ready":
      return textFor(language, { en: "Ready", "zh-CN": "就绪" });
    case "error":
      return textFor(language, { en: "Error", "zh-CN": "错误" });
    case "disabled":
      return textFor(language, { en: "Disabled", "zh-CN": "已禁用" });
    case "installing":
      return textFor(language, { en: "Installing", "zh-CN": "安装中" });
    case "uninstalling":
      return textFor(language, { en: "Uninstalling", "zh-CN": "卸载中" });
    default:
      return status;
  }
}

/**
 * PluginManager page component.
 *
 * Provides a management UI for the Paperclip plugin system:
 * - Lists all installed plugins with their status, version, and category badges.
 * - Allows installing new plugins by npm package name.
 * - Provides per-plugin actions: enable, disable, navigate to settings.
 * - Uninstall with a two-step confirmation dialog to prevent accidental removal.
 *
 * Data flow:
 * - Reads from `GET /api/plugins` via `pluginsApi.list()`.
 * - Mutations (install / uninstall / enable / disable) invalidate
 *   `queryKeys.plugins.all` so the list refreshes automatically.
 *
 * @see PluginSettings — linked from the Settings icon on each plugin row.
 * @see doc/plugins/PLUGIN_SPEC.md §3 — Plugin Lifecycle for status semantics.
 */
export function PluginManager() {
  const { selectedCompany } = useCompany();
  const { uiLanguage } = useGeneralSettings();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const [installPackage, setInstallPackage] = useState("");
  const [installDialogOpen, setInstallDialogOpen] = useState(false);
  const [uninstallPluginId, setUninstallPluginId] = useState<string | null>(null);
  const [uninstallPluginName, setUninstallPluginName] = useState<string>("");
  const [errorDetailsPlugin, setErrorDetailsPlugin] = useState<PluginRecord | null>(null);
  const copy = {
    company: textFor(uiLanguage, {
      en: "Company",
      "zh-CN": "公司",
    }),
    settings: textFor(uiLanguage, {
      en: "Settings",
      "zh-CN": "设置",
    }),
    plugins: textFor(uiLanguage, {
      en: "Plugins",
      "zh-CN": "插件",
    }),
    loadingPlugins: textFor(uiLanguage, {
      en: "Loading plugins...",
      "zh-CN": "正在加载插件...",
    }),
    loadPluginsFailed: textFor(uiLanguage, {
      en: "Failed to load plugins.",
      "zh-CN": "加载插件失败。",
    }),
    title: textFor(uiLanguage, {
      en: "Plugin Manager",
      "zh-CN": "插件管理",
    }),
    installPlugin: textFor(uiLanguage, {
      en: "Install Plugin",
      "zh-CN": "安装插件",
    }),
    installPluginTitle: textFor(uiLanguage, {
      en: "Install Plugin",
      "zh-CN": "安装插件",
    }),
    installPluginDescription: textFor(uiLanguage, {
      en: "Enter the npm package name of the plugin you wish to install.",
      "zh-CN": "输入要安装的插件 npm 包名。",
    }),
    npmPackageName: textFor(uiLanguage, {
      en: "npm Package Name",
      "zh-CN": "npm 包名",
    }),
    cancel: textFor(uiLanguage, {
      en: "Cancel",
      "zh-CN": "取消",
    }),
    installing: textFor(uiLanguage, {
      en: "Installing...",
      "zh-CN": "安装中...",
    }),
    install: textFor(uiLanguage, {
      en: "Install",
      "zh-CN": "安装",
    }),
    pluginsAlpha: textFor(uiLanguage, {
      en: "Plugins are alpha.",
      "zh-CN": "插件功能仍处于 Alpha 阶段。",
    }),
    pluginsAlphaDescription: textFor(uiLanguage, {
      en: "The plugin runtime and API surface are still changing. Expect breaking changes while this feature settles.",
      "zh-CN": "插件运行时和 API 仍在持续调整中，这项功能稳定前可能会有不兼容变更。",
    }),
    availablePlugins: textFor(uiLanguage, {
      en: "Available Plugins",
      "zh-CN": "可用插件",
    }),
    examples: textFor(uiLanguage, {
      en: "Examples",
      "zh-CN": "示例",
    }),
    loadingExamples: textFor(uiLanguage, {
      en: "Loading bundled examples...",
      "zh-CN": "正在加载内置示例...",
    }),
    loadExamplesFailed: textFor(uiLanguage, {
      en: "Failed to load bundled examples.",
      "zh-CN": "加载内置示例失败。",
    }),
    noExamples: textFor(uiLanguage, {
      en: "No bundled example plugins were found in this checkout.",
      "zh-CN": "当前代码仓库中没有找到内置示例插件。",
    }),
    example: textFor(uiLanguage, {
      en: "Example",
      "zh-CN": "示例",
    }),
    notInstalled: textFor(uiLanguage, {
      en: "Not installed",
      "zh-CN": "未安装",
    }),
    enable: textFor(uiLanguage, {
      en: "Enable",
      "zh-CN": "启用",
    }),
    openSettings: textFor(uiLanguage, {
      en: "Open Settings",
      "zh-CN": "打开设置",
    }),
    review: textFor(uiLanguage, {
      en: "Review",
      "zh-CN": "查看",
    }),
    installExample: textFor(uiLanguage, {
      en: "Install Example",
      "zh-CN": "安装示例",
    }),
    installedPlugins: textFor(uiLanguage, {
      en: "Installed Plugins",
      "zh-CN": "已安装插件",
    }),
    noPluginsInstalled: textFor(uiLanguage, {
      en: "No plugins installed",
      "zh-CN": "尚未安装插件",
    }),
    noPluginsInstalledDescription: textFor(uiLanguage, {
      en: "Install a plugin to extend functionality.",
      "zh-CN": "安装插件以扩展功能。",
    }),
    noDescription: textFor(uiLanguage, {
      en: "No description provided.",
      "zh-CN": "未提供描述。",
    }),
    pluginError: textFor(uiLanguage, {
      en: "Plugin error",
      "zh-CN": "插件错误",
    }),
    viewFullError: textFor(uiLanguage, {
      en: "View full error",
      "zh-CN": "查看完整错误",
    }),
    disable: textFor(uiLanguage, {
      en: "Disable",
      "zh-CN": "停用",
    }),
    uninstall: textFor(uiLanguage, {
      en: "Uninstall",
      "zh-CN": "卸载",
    }),
    configure: textFor(uiLanguage, {
      en: "Configure",
      "zh-CN": "配置",
    }),
    uninstallPluginTitle: textFor(uiLanguage, {
      en: "Uninstall Plugin",
      "zh-CN": "卸载插件",
    }),
    uninstallPluginDescription: textFor(uiLanguage, {
      en: "Are you sure you want to uninstall this plugin? This action cannot be undone.",
      "zh-CN": "确认要卸载这个插件吗？此操作无法撤销。",
    }),
    uninstalling: textFor(uiLanguage, {
      en: "Uninstalling...",
      "zh-CN": "卸载中...",
    }),
    errorDetails: textFor(uiLanguage, {
      en: "Error Details",
      "zh-CN": "错误详情",
    }),
    pluginGeneric: textFor(uiLanguage, {
      en: "Plugin",
      "zh-CN": "插件",
    }),
    errorStateDescription: textFor(uiLanguage, {
      en: "hit an error state.",
      "zh-CN": "进入了错误状态。",
    }),
    whatErrored: textFor(uiLanguage, {
      en: "What errored",
      "zh-CN": "错误摘要",
    }),
    noErrorSummary: textFor(uiLanguage, {
      en: "No error summary available.",
      "zh-CN": "没有可用的错误摘要。",
    }),
    errorWithoutStoredMessage: textFor(uiLanguage, {
      en: "Plugin entered an error state without a stored error message.",
      "zh-CN": "插件进入了错误状态，但没有保存错误信息。",
    }),
    fullErrorOutput: textFor(uiLanguage, {
      en: "Full error output",
      "zh-CN": "完整错误输出",
    }),
    noStoredErrorMessage: textFor(uiLanguage, {
      en: "No stored error message.",
      "zh-CN": "没有保存的错误信息。",
    }),
    close: textFor(uiLanguage, {
      en: "Close",
      "zh-CN": "关闭",
    }),
    installSuccess: textFor(uiLanguage, {
      en: "Plugin installed successfully",
      "zh-CN": "插件安装成功",
    }),
    installFailed: textFor(uiLanguage, {
      en: "Failed to install plugin",
      "zh-CN": "插件安装失败",
    }),
    uninstallSuccess: textFor(uiLanguage, {
      en: "Plugin uninstalled successfully",
      "zh-CN": "插件卸载成功",
    }),
    uninstallFailed: textFor(uiLanguage, {
      en: "Failed to uninstall plugin",
      "zh-CN": "插件卸载失败",
    }),
    enableSuccess: textFor(uiLanguage, {
      en: "Plugin enabled",
      "zh-CN": "插件已启用",
    }),
    enableFailed: textFor(uiLanguage, {
      en: "Failed to enable plugin",
      "zh-CN": "启用插件失败",
    }),
    disableSuccess: textFor(uiLanguage, {
      en: "Plugin disabled",
      "zh-CN": "插件已停用",
    }),
    disableFailed: textFor(uiLanguage, {
      en: "Failed to disable plugin",
      "zh-CN": "停用插件失败",
    }),
  };

  useEffect(() => {
    setBreadcrumbs([
      { label: selectedCompany?.name ?? copy.company, href: "/dashboard" },
      { label: copy.settings, href: "/instance/settings/heartbeats" },
      { label: copy.plugins },
    ]);
  }, [copy.company, copy.plugins, copy.settings, selectedCompany?.name, setBreadcrumbs]);

  const { data: plugins, isLoading, error } = useQuery({
    queryKey: queryKeys.plugins.all,
    queryFn: () => pluginsApi.list(),
  });

  const examplesQuery = useQuery({
    queryKey: queryKeys.plugins.examples,
    queryFn: () => pluginsApi.listExamples(),
  });

  const invalidatePluginQueries = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.plugins.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.plugins.examples });
    queryClient.invalidateQueries({ queryKey: queryKeys.plugins.uiContributions });
  };

  const installMutation = useMutation({
    mutationFn: (params: { packageName: string; version?: string; isLocalPath?: boolean }) =>
      pluginsApi.install(params),
    onSuccess: () => {
      invalidatePluginQueries();
      setInstallDialogOpen(false);
      setInstallPackage("");
      pushToast({ title: copy.installSuccess, tone: "success" });
    },
    onError: (err: Error) => {
      pushToast({ title: copy.installFailed, body: err.message, tone: "error" });
    },
  });

  const uninstallMutation = useMutation({
    mutationFn: (pluginId: string) => pluginsApi.uninstall(pluginId),
    onSuccess: () => {
      invalidatePluginQueries();
      pushToast({ title: copy.uninstallSuccess, tone: "success" });
    },
    onError: (err: Error) => {
      pushToast({ title: copy.uninstallFailed, body: err.message, tone: "error" });
    },
  });

  const enableMutation = useMutation({
    mutationFn: (pluginId: string) => pluginsApi.enable(pluginId),
    onSuccess: () => {
      invalidatePluginQueries();
      pushToast({ title: copy.enableSuccess, tone: "success" });
    },
    onError: (err: Error) => {
      pushToast({ title: copy.enableFailed, body: err.message, tone: "error" });
    },
  });

  const disableMutation = useMutation({
    mutationFn: (pluginId: string) => pluginsApi.disable(pluginId),
    onSuccess: () => {
      invalidatePluginQueries();
      pushToast({ title: copy.disableSuccess, tone: "info" });
    },
    onError: (err: Error) => {
      pushToast({ title: copy.disableFailed, body: err.message, tone: "error" });
    },
  });

  const installedPlugins = plugins ?? [];
  const examples = examplesQuery.data ?? [];
  const installedByPackageName = new Map(installedPlugins.map((plugin) => [plugin.packageName, plugin]));
  const examplePackageNames = new Set(examples.map((example) => example.packageName));
  const errorSummaryByPluginId = useMemo(
    () =>
      new Map(
        installedPlugins.map((plugin) => [plugin.id, getPluginErrorSummary(plugin, copy.errorWithoutStoredMessage)])
      ),
    [copy.errorWithoutStoredMessage, installedPlugins]
  );

  if (isLoading) return <div className="p-4 text-sm text-muted-foreground">{copy.loadingPlugins}</div>;
  if (error) return <div className="p-4 text-sm text-destructive">{copy.loadPluginsFailed}</div>;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Puzzle className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-xl font-semibold">{copy.title}</h1>
        </div>
        
        <Dialog open={installDialogOpen} onOpenChange={setInstallDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              {copy.installPlugin}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{copy.installPluginTitle}</DialogTitle>
              <DialogDescription>
                {copy.installPluginDescription}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="packageName">{copy.npmPackageName}</Label>
                <Input
                  id="packageName"
                  placeholder="@paperclipai/plugin-example"
                  value={installPackage}
                  onChange={(e) => setInstallPackage(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInstallDialogOpen(false)}>{copy.cancel}</Button>
              <Button
                onClick={() => installMutation.mutate({ packageName: installPackage })}
                disabled={!installPackage || installMutation.isPending}
              >
                {installMutation.isPending ? copy.installing : copy.install}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <div className="space-y-1 text-sm">
            <p className="font-medium text-foreground">{copy.pluginsAlpha}</p>
            <p className="text-muted-foreground">
              {copy.pluginsAlphaDescription}
            </p>
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-base font-semibold">{copy.availablePlugins}</h2>
          <Badge variant="outline">{copy.examples}</Badge>
        </div>

        {examplesQuery.isLoading ? (
          <div className="text-sm text-muted-foreground">{copy.loadingExamples}</div>
        ) : examplesQuery.error ? (
          <div className="text-sm text-destructive">{copy.loadExamplesFailed}</div>
        ) : examples.length === 0 ? (
          <div className="rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">
            {copy.noExamples}
          </div>
        ) : (
          <ul className="divide-y rounded-md border bg-card">
            {examples.map((example) => {
              const installedPlugin = installedByPackageName.get(example.packageName);
              const installPending =
                installMutation.isPending &&
                installMutation.variables?.isLocalPath &&
                installMutation.variables.packageName === example.localPath;

              return (
                <li key={example.packageName}>
                  <div className="flex items-center gap-4 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{example.displayName}</span>
                        <Badge variant="outline">{copy.example}</Badge>
                        {installedPlugin ? (
                          <Badge
                            variant={installedPlugin.status === "ready" ? "default" : "secondary"}
                            className={installedPlugin.status === "ready" ? "bg-green-600 hover:bg-green-700" : ""}
                          >
                            {getPluginStatusLabel(uiLanguage, installedPlugin.status)}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">{copy.notInstalled}</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{example.description}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{example.packageName}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {installedPlugin ? (
                        <>
                          {installedPlugin.status !== "ready" && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={enableMutation.isPending}
                              onClick={() => enableMutation.mutate(installedPlugin.id)}
                            >
                              {copy.enable}
                            </Button>
                          )}
                          <Button variant="outline" size="sm" asChild>
                            <Link to={`/instance/settings/plugins/${installedPlugin.id}`}>
                              {installedPlugin.status === "ready" ? copy.openSettings : copy.review}
                            </Link>
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          disabled={installPending || installMutation.isPending}
                          onClick={() =>
                            installMutation.mutate({
                              packageName: example.localPath,
                              isLocalPath: true,
                            })
                          }
                        >
                          {installPending ? copy.installing : copy.installExample}
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Puzzle className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-base font-semibold">{copy.installedPlugins}</h2>
        </div>

        {!installedPlugins.length ? (
          <Card className="bg-muted/30">
            <CardContent className="flex flex-col items-center justify-center py-10">
              <Puzzle className="h-10 w-10 text-muted-foreground mb-4" />
              <p className="text-sm font-medium">{copy.noPluginsInstalled}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {copy.noPluginsInstalledDescription}
              </p>
            </CardContent>
          </Card>
        ) : (
          <ul className="divide-y rounded-md border bg-card">
            {installedPlugins.map((plugin) => (
              <li key={plugin.id}>
                <div className="flex items-start gap-4 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/instance/settings/plugins/${plugin.id}`}
                        className="font-medium hover:underline truncate block"
                        title={plugin.manifestJson.displayName ?? plugin.packageName}
                      >
                        {plugin.manifestJson.displayName ?? plugin.packageName}
                      </Link>
                      {examplePackageNames.has(plugin.packageName) && (
                        <Badge variant="outline">{copy.example}</Badge>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate" title={plugin.packageName}>
                        {plugin.packageName} · v{plugin.manifestJson.version ?? plugin.version}
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground truncate mt-0.5" title={plugin.manifestJson.description}>
                      {plugin.manifestJson.description || copy.noDescription}
                    </p>
                    {plugin.status === "error" && (
                      <div className="mt-3 rounded-md border border-red-500/25 bg-red-500/[0.06] px-3 py-2">
                        <div className="flex flex-wrap items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-300">
                              <AlertTriangle className="h-4 w-4 shrink-0" />
                              <span>{copy.pluginError}</span>
                            </div>
                            <p
                              className="mt-1 text-sm text-red-700/90 dark:text-red-200/90 break-words"
                              title={plugin.lastError ?? undefined}
                            >
                              {errorSummaryByPluginId.get(plugin.id)}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-red-500/30 bg-background/60 text-red-700 hover:bg-red-500/10 hover:text-red-800 dark:text-red-200 dark:hover:text-red-100"
                            onClick={() => setErrorDetailsPlugin(plugin)}
                          >
                            {copy.viewFullError}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 self-center">
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            plugin.status === "ready"
                              ? "default"
                              : plugin.status === "error"
                                ? "destructive"
                              : "secondary"
                          }
                          className={cn(
                            "shrink-0",
                            plugin.status === "ready" ? "bg-green-600 hover:bg-green-700" : ""
                          )}
                        >
                          {getPluginStatusLabel(uiLanguage, plugin.status)}
                        </Badge>
                        <Button
                          variant="outline"
                          size="icon-sm"
                          className="h-8 w-8"
                          title={plugin.status === "ready" ? copy.disable : copy.enable}
                          onClick={() => {
                            if (plugin.status === "ready") {
                              disableMutation.mutate(plugin.id);
                            } else {
                              enableMutation.mutate(plugin.id);
                            }
                          }}
                          disabled={enableMutation.isPending || disableMutation.isPending}
                        >
                          <Power className={cn("h-4 w-4", plugin.status === "ready" ? "text-green-600" : "")} />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon-sm"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          title={copy.uninstall}
                          onClick={() => {
                            setUninstallPluginId(plugin.id);
                            setUninstallPluginName(plugin.manifestJson.displayName ?? plugin.packageName);
                          }}
                          disabled={uninstallMutation.isPending}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                      <Button variant="outline" size="sm" className="mt-2 h-8" asChild>
                        <Link to={`/instance/settings/plugins/${plugin.id}`}>
                          <Settings className="h-4 w-4" />
                          {copy.configure}
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog
        open={uninstallPluginId !== null}
        onOpenChange={(open) => { if (!open) setUninstallPluginId(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy.uninstallPluginTitle}</DialogTitle>
            <DialogDescription>
              <strong>{uninstallPluginName}</strong>
              {" "}
              {copy.uninstallPluginDescription}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUninstallPluginId(null)}>{copy.cancel}</Button>
            <Button
              variant="destructive"
              disabled={uninstallMutation.isPending}
              onClick={() => {
                if (uninstallPluginId) {
                  uninstallMutation.mutate(uninstallPluginId, {
                    onSettled: () => setUninstallPluginId(null),
                  });
                }
              }}
            >
              {uninstallMutation.isPending ? copy.uninstalling : copy.uninstall}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={errorDetailsPlugin !== null}
        onOpenChange={(open) => { if (!open) setErrorDetailsPlugin(null); }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{copy.errorDetails}</DialogTitle>
            <DialogDescription>
              {errorDetailsPlugin?.manifestJson.displayName ?? errorDetailsPlugin?.packageName ?? copy.pluginGeneric}
              {" "}
              {copy.errorStateDescription}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border border-red-500/25 bg-red-500/[0.06] px-4 py-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-700 dark:text-red-300" />
                <div className="space-y-1 text-sm">
                  <p className="font-medium text-red-700 dark:text-red-300">
                    {copy.whatErrored}
                  </p>
                  <p className="text-red-700/90 dark:text-red-200/90 break-words">
                    {errorDetailsPlugin ? getPluginErrorSummary(errorDetailsPlugin, copy.errorWithoutStoredMessage) : copy.noErrorSummary}
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">{copy.fullErrorOutput}</p>
              <pre className="max-h-[50vh] overflow-auto rounded-md border bg-muted/40 p-3 text-xs leading-5 whitespace-pre-wrap break-words">
                {errorDetailsPlugin?.lastError ?? copy.noStoredErrorMessage}
              </pre>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setErrorDetailsPlugin(null)}>
              {copy.close}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
