/**
 * @fileoverview Adapter Manager page — install, view, and manage external adapters.
 *
 * Adapters are simpler than plugins: no workers, no events, no manifests.
 * They just register a ServerAdapterModule that provides model discovery and execution.
 */
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Cpu, Plus, Power, Trash2, FolderOpen, Package, RefreshCw, Download } from "lucide-react";
import { useCompany } from "@/context/CompanyContext";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { useGeneralSettings } from "@/context/GeneralSettingsContext";
import { adaptersApi } from "@/api/adapters";
import type { AdapterInfo } from "@/api/adapters";
import { getAdapterLabel } from "@/adapters/adapter-display-registry";
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
import { ChoosePathButton } from "@/components/PathInstructionsModal";
import { invalidateDynamicParser } from "@/adapters/dynamic-loader";
import { invalidateConfigSchemaCache } from "@/adapters/schema-config-fields";
import { textFor, type UiLanguage } from "@/lib/ui-language";

function formatModelsCount(language: UiLanguage, count: number): string {
  return language === "zh-CN" ? `${count} 个模型` : `${count} models`;
}

function AdapterRow({
  adapter,
  canRemove,
  onToggle,
  onRemove,
  onReload,
  onReinstall,
  isToggling,
  isReloading,
  isReinstalling,
  overriddenBy,
  /** Custom tooltip for the power button when adapter is enabled. */
  toggleTitleEnabled,
  /** Custom tooltip for the power button when adapter is disabled. */
  toggleTitleDisabled,
  /** Custom label for the disabled badge (defaults to "Hidden from menus"). */
  disabledBadgeLabel,
}: {
  adapter: AdapterInfo;
  canRemove: boolean;
  onToggle: (type: string, disabled: boolean) => void;
  onRemove: (type: string) => void;
  onReload?: (type: string) => void;
  onReinstall?: (type: string) => void;
  isToggling: boolean;
  isReloading?: boolean;
  isReinstalling?: boolean;
  /** When set, shows an "Overridden by …" badge (used for builtin entries). */
  overriddenBy?: string;
  toggleTitleEnabled?: string;
  toggleTitleDisabled?: string;
  disabledBadgeLabel?: string;
}) {
  const { uiLanguage } = useGeneralSettings();
  const copy = {
    external: textFor(uiLanguage, {
      en: "External",
      "zh-CN": "外部",
    }),
    builtIn: textFor(uiLanguage, {
      en: "Built-in",
      "zh-CN": "内置",
    }),
    installedFromLocalPath: textFor(uiLanguage, {
      en: "Installed from local path",
      "zh-CN": "从本地路径安装",
    }),
    installedFromNpm: textFor(uiLanguage, {
      en: "Installed from npm",
      "zh-CN": "从 npm 安装",
    }),
    overridesBuiltIn: textFor(uiLanguage, {
      en: "Overrides built-in",
      "zh-CN": "覆盖内置适配器",
    }),
    overriddenBy: textFor(uiLanguage, {
      en: "Overridden by",
      "zh-CN": "已被覆盖：",
    }),
    hiddenFromMenus: textFor(uiLanguage, {
      en: "Hidden from menus",
      "zh-CN": "已从菜单中隐藏",
    }),
    reinstallAdapter: textFor(uiLanguage, {
      en: "Reinstall adapter (pull latest from npm)",
      "zh-CN": "重装适配器（从 npm 拉取最新版本）",
    }),
    reloadAdapter: textFor(uiLanguage, {
      en: "Reload adapter (hot-swap)",
      "zh-CN": "重新加载适配器（热替换）",
    }),
    showInMenus: textFor(uiLanguage, {
      en: "Show in agent menus",
      "zh-CN": "在 agent 菜单中显示",
    }),
    hideFromMenus: textFor(uiLanguage, {
      en: "Hide from agent menus",
      "zh-CN": "从 agent 菜单中隐藏",
    }),
    removeAdapter: textFor(uiLanguage, {
      en: "Remove adapter",
      "zh-CN": "移除适配器",
    }),
  };

  return (
    <li>
      <div className="flex items-center gap-4 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("font-medium", adapter.disabled && "text-muted-foreground line-through")}>
              {adapter.label || getAdapterLabel(adapter.type)}
            </span>
            <Badge variant="outline">{adapter.source === "external" ? copy.external : copy.builtIn}</Badge>
            {adapter.source === "external" && (
              adapter.isLocalPath
                ? <span title={copy.installedFromLocalPath}><FolderOpen className="h-4 w-4 text-amber-500" /></span>
                : <span title={copy.installedFromNpm}><Package className="h-4 w-4 text-red-500" /></span>
            )}
            {adapter.version && (
              <Badge variant="secondary" className="font-mono text-[10px]">
                v{adapter.version}
              </Badge>
            )}
            {adapter.overriddenBuiltin && (
              <Badge variant="secondary" className="text-blue-600 border-blue-400">
                {copy.overridesBuiltIn}
              </Badge>
            )}
            {overriddenBy && (
              <Badge variant="secondary" className="text-blue-600 border-blue-400">
                {copy.overriddenBy} {overriddenBy}
              </Badge>
            )}
            {adapter.disabled && (
              <Badge variant="secondary" className="text-amber-600 border-amber-400">
                {disabledBadgeLabel ?? copy.hiddenFromMenus}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {adapter.type}
            {adapter.packageName && adapter.packageName !== adapter.type && (
              <> · {adapter.packageName}</>
            )}
            {" · "}{formatModelsCount(uiLanguage, adapter.modelsCount)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onReinstall && (
            <Button
              variant="outline"
              size="icon-sm"
              className="h-8 w-8"
              title={copy.reinstallAdapter}
              disabled={isReinstalling}
              onClick={() => onReinstall(adapter.type)}
            >
              <Download className={cn("h-4 w-4", isReinstalling && "animate-bounce")} />
            </Button>
          )}
          {onReload && (
            <Button
              variant="outline"
              size="icon-sm"
              className="h-8 w-8"
              title={copy.reloadAdapter}
              disabled={isReloading}
              onClick={() => onReload(adapter.type)}
            >
              <RefreshCw className={cn("h-4 w-4", isReloading && "animate-spin")} />
            </Button>
          )}
          <Button
            variant="outline"
            size="icon-sm"
            className="h-8 w-8"
            title={adapter.disabled
              ? (toggleTitleEnabled ?? copy.showInMenus)
              : (toggleTitleDisabled ?? copy.hideFromMenus)}
            disabled={isToggling}
            onClick={() => onToggle(adapter.type, !adapter.disabled)}
          >
            <Power className={cn("h-4 w-4", !adapter.disabled ? "text-green-600" : "text-muted-foreground")} />
          </Button>
          {canRemove && (
            <Button
            variant="outline"
            size="icon-sm"
            className="h-8 w-8 text-destructive hover:text-destructive"
            title={copy.removeAdapter}
            onClick={() => onRemove(adapter.type)}
          >
            <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

function fetchNpmLatestVersion(packageName: string): Promise<string | null> {
  return fetch(`https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`, {
    signal: AbortSignal.timeout(5000),
  })
    .then((res) => res.json())
    .then((data) => (typeof data?.version === "string" ? (data.version as string) : null))
    .catch(() => null);
}

function ReinstallDialog({
  adapter,
  open,
  isReinstalling,
  onConfirm,
  onCancel,
}: {
  adapter: AdapterInfo | null;
  open: boolean;
  isReinstalling: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { uiLanguage } = useGeneralSettings();
  const copy = {
    title: textFor(uiLanguage, {
      en: "Reinstall Adapter",
      "zh-CN": "重装适配器",
    }),
    package: textFor(uiLanguage, {
      en: "Package",
      "zh-CN": "包名",
    }),
    current: textFor(uiLanguage, {
      en: "Current",
      "zh-CN": "当前版本",
    }),
    latestOnNpm: textFor(uiLanguage, {
      en: "Latest on npm",
      "zh-CN": "npm 最新版本",
    }),
    unknown: textFor(uiLanguage, {
      en: "unknown",
      "zh-CN": "未知",
    }),
    checking: textFor(uiLanguage, {
      en: "checking...",
      "zh-CN": "检查中...",
    }),
    unavailable: textFor(uiLanguage, {
      en: "unavailable",
      "zh-CN": "不可用",
    }),
    alreadyLatest: textFor(uiLanguage, {
      en: "Already on the latest version.",
      "zh-CN": "已经是最新版本。",
    }),
    cancel: textFor(uiLanguage, {
      en: "Cancel",
      "zh-CN": "取消",
    }),
    reinstall: textFor(uiLanguage, {
      en: "Reinstall",
      "zh-CN": "重装",
    }),
    reinstalling: textFor(uiLanguage, {
      en: "Reinstalling...",
      "zh-CN": "重装中...",
    }),
  };

  const { data: latestVersion, isLoading: isFetchingVersion } = useQuery({
    queryKey: ["npm-latest-version", adapter?.packageName],
    queryFn: () => {
      if (!adapter?.packageName) return null;
      return fetchNpmLatestVersion(adapter.packageName);
    },
    enabled: open && !!adapter?.packageName,
    staleTime: 60_000,
  });

  const isUpToDate = adapter?.version && latestVersion && adapter.version === latestVersion;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>
            {uiLanguage === "zh-CN" ? (
              <>
                这会从 npm 拉取 <strong>{adapter?.packageName}</strong> 的最新版本，并热替换当前运行的适配器模块。现有
                agents 会在下次运行时使用新版本。
              </>
            ) : (
              <>
                This will pull the latest version of{" "}
                <strong>{adapter?.packageName}</strong> from npm and hot-swap
                the running adapter module. Existing agents will use the new
                version on their next run.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border bg-muted/50 px-4 py-3 text-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{copy.package}</span>
            <span className="font-mono">{adapter?.packageName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{copy.current}</span>
            <span className="font-mono">
              {adapter?.version ? `v${adapter.version}` : copy.unknown}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{copy.latestOnNpm}</span>
            <span className="font-mono">
              {isFetchingVersion
                ? copy.checking
                : latestVersion
                  ? `v${latestVersion}`
                  : copy.unavailable}
            </span>
          </div>
          {isUpToDate && (
            <p className="text-xs text-muted-foreground pt-1">
              {copy.alreadyLatest}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isReinstalling}>
            {copy.cancel}
          </Button>
          <Button disabled={isReinstalling} onClick={onConfirm}>
            {isReinstalling ? copy.reinstalling : copy.reinstall}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AdapterManager() {
  const { selectedCompany } = useCompany();
  const { uiLanguage } = useGeneralSettings();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const [installPackage, setInstallPackage] = useState("");
  const [installVersion, setInstallVersion] = useState("");
  const [isLocalPath, setIsLocalPath] = useState(false);
  const [installDialogOpen, setInstallDialogOpen] = useState(false);
  const [removeType, setRemoveType] = useState<string | null>(null);
  const [reinstallTarget, setReinstallTarget] = useState<AdapterInfo | null>(null);
  const copy = {
    company: textFor(uiLanguage, {
      en: "Company",
      "zh-CN": "公司",
    }),
    settings: textFor(uiLanguage, {
      en: "Settings",
      "zh-CN": "设置",
    }),
    adapters: textFor(uiLanguage, {
      en: "Adapters",
      "zh-CN": "适配器",
    }),
    loadingAdapters: textFor(uiLanguage, {
      en: "Loading adapters...",
      "zh-CN": "正在加载适配器...",
    }),
    alpha: textFor(uiLanguage, {
      en: "Alpha",
      "zh-CN": "Alpha",
    }),
    installAdapter: textFor(uiLanguage, {
      en: "Install Adapter",
      "zh-CN": "安装适配器",
    }),
    installExternalAdapter: textFor(uiLanguage, {
      en: "Install External Adapter",
      "zh-CN": "安装外部适配器",
    }),
    installExternalAdapterDescription: textFor(uiLanguage, {
      en: "Add an adapter from npm or a local path. The adapter package must export createServerAdapter().",
      "zh-CN": "从 npm 或本地路径添加适配器。适配器包必须导出 createServerAdapter()。",
    }),
    npmPackage: textFor(uiLanguage, {
      en: "npm package",
      "zh-CN": "npm 包",
    }),
    localPath: textFor(uiLanguage, {
      en: "Local path",
      "zh-CN": "本地路径",
    }),
    pathToPackage: textFor(uiLanguage, {
      en: "Path to adapter package",
      "zh-CN": "适配器包路径",
    }),
    acceptsPaths: textFor(uiLanguage, {
      en: "Accepts Linux, WSL, and Windows paths. Windows paths are auto-converted.",
      "zh-CN": "支持 Linux、WSL 和 Windows 路径。Windows 路径会自动转换。",
    }),
    packageName: textFor(uiLanguage, {
      en: "Package Name",
      "zh-CN": "包名",
    }),
    versionOptional: textFor(uiLanguage, {
      en: "Version (optional)",
      "zh-CN": "版本（可选）",
    }),
    cancel: textFor(uiLanguage, {
      en: "Cancel",
      "zh-CN": "取消",
    }),
    install: textFor(uiLanguage, {
      en: "Install",
      "zh-CN": "安装",
    }),
    installing: textFor(uiLanguage, {
      en: "Installing...",
      "zh-CN": "安装中...",
    }),
    externalAdaptersAlpha: textFor(uiLanguage, {
      en: "External adapters are alpha.",
      "zh-CN": "外部适配器仍处于 Alpha 阶段。",
    }),
    externalAdaptersAlphaDescription: textFor(uiLanguage, {
      en: "The adapter plugin system is under active development. APIs and storage format may change. Use the power icon to hide adapters from agent menus without removing them.",
      "zh-CN": "适配器插件系统仍在积极开发中，API 和存储格式都可能变化。可以使用电源图标把适配器从 agent 菜单中隐藏，而不必直接移除。",
    }),
    externalAdapters: textFor(uiLanguage, {
      en: "External Adapters",
      "zh-CN": "外部适配器",
    }),
    noExternalAdapters: textFor(uiLanguage, {
      en: "No external adapters installed",
      "zh-CN": "尚未安装外部适配器",
    }),
    noExternalAdaptersDescription: textFor(uiLanguage, {
      en: "Install an adapter package to extend model support.",
      "zh-CN": "安装适配器包以扩展模型支持。",
    }),
    pauseExternalOverride: textFor(uiLanguage, {
      en: "Pause external override",
      "zh-CN": "暂停外部覆盖",
    }),
    resumeExternalOverride: textFor(uiLanguage, {
      en: "Resume external override",
      "zh-CN": "恢复外部覆盖",
    }),
    overridePaused: textFor(uiLanguage, {
      en: "Override paused",
      "zh-CN": "覆盖已暂停",
    }),
    builtInAdapters: textFor(uiLanguage, {
      en: "Built-in Adapters",
      "zh-CN": "内置适配器",
    }),
    noBuiltInAdapters: textFor(uiLanguage, {
      en: "No built-in adapters found.",
      "zh-CN": "未找到内置适配器。",
    }),
    removeAdapter: textFor(uiLanguage, {
      en: "Remove Adapter",
      "zh-CN": "移除适配器",
    }),
    remove: textFor(uiLanguage, {
      en: "Remove",
      "zh-CN": "移除",
    }),
    removing: textFor(uiLanguage, {
      en: "Removing...",
      "zh-CN": "移除中...",
    }),
    adapterInstalled: textFor(uiLanguage, {
      en: "Adapter installed",
      "zh-CN": "适配器安装成功",
    }),
    installFailed: textFor(uiLanguage, {
      en: "Install failed",
      "zh-CN": "安装失败",
    }),
    adapterRemoved: textFor(uiLanguage, {
      en: "Adapter removed",
      "zh-CN": "适配器已移除",
    }),
    removalFailed: textFor(uiLanguage, {
      en: "Removal failed",
      "zh-CN": "移除失败",
    }),
    toggleFailed: textFor(uiLanguage, {
      en: "Toggle failed",
      "zh-CN": "切换失败",
    }),
    overrideToggleFailed: textFor(uiLanguage, {
      en: "Override toggle failed",
      "zh-CN": "覆盖切换失败",
    }),
    adapterReloaded: textFor(uiLanguage, {
      en: "Adapter reloaded",
      "zh-CN": "适配器已重新加载",
    }),
    reloadFailed: textFor(uiLanguage, {
      en: "Reload failed",
      "zh-CN": "重新加载失败",
    }),
    adapterReinstalled: textFor(uiLanguage, {
      en: "Adapter reinstalled",
      "zh-CN": "适配器已重装",
    }),
    reinstallFailed: textFor(uiLanguage, {
      en: "Reinstall failed",
      "zh-CN": "重装失败",
    }),
  };
  const formatVersionSuffix = (version?: string | null) =>
    version
      ? uiLanguage === "zh-CN"
        ? `（v${version}）`
        : ` (v${version})`
      : "";
  const registeredBody = (type: string, version?: string | null) =>
    uiLanguage === "zh-CN"
      ? `类型“${type}”已成功注册。${formatVersionSuffix(version)}`
      : `Type "${type}" registered successfully.${formatVersionSuffix(version)}`;
  const reloadedBody = (type: string, version?: string | null) =>
    uiLanguage === "zh-CN"
      ? `类型“${type}”已重新加载。${formatVersionSuffix(version)}`
      : `Type "${type}" reloaded.${formatVersionSuffix(version)}`;
  const updatedFromNpmBody = (type: string, version?: string | null) =>
    uiLanguage === "zh-CN"
      ? `类型“${type}”已从 npm 更新。${formatVersionSuffix(version)}`
      : `Type "${type}" updated from npm.${formatVersionSuffix(version)}`;

  useEffect(() => {
    setBreadcrumbs([
      { label: selectedCompany?.name ?? copy.company, href: "/dashboard" },
      { label: copy.settings, href: "/instance/settings/general" },
      { label: copy.adapters },
    ]);
  }, [copy.adapters, copy.company, copy.settings, selectedCompany?.name, setBreadcrumbs]);

  const { data: adapters, isLoading } = useQuery({
    queryKey: queryKeys.adapters.all,
    queryFn: () => adaptersApi.list(),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.adapters.all });
  };

  const installMutation = useMutation({
    mutationFn: (params: { packageName: string; version?: string; isLocalPath?: boolean }) =>
      adaptersApi.install(params),
    onSuccess: (result) => {
      invalidate();
      setInstallDialogOpen(false);
      setInstallPackage("");
      setInstallVersion("");
      setIsLocalPath(false);
      pushToast({
        title: copy.adapterInstalled,
        body: registeredBody(result.type, result.version),
        tone: "success",
      });
    },
    onError: (err: Error) => {
      pushToast({ title: copy.installFailed, body: err.message, tone: "error" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (type: string) => adaptersApi.remove(type),
    onSuccess: () => {
      invalidate();
      pushToast({ title: copy.adapterRemoved, tone: "success" });
    },
    onError: (err: Error) => {
      pushToast({ title: copy.removalFailed, body: err.message, tone: "error" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ type, disabled }: { type: string; disabled: boolean }) =>
      adaptersApi.setDisabled(type, disabled),
    onSuccess: () => {
      invalidate();
    },
    onError: (err: Error) => {
      pushToast({ title: copy.toggleFailed, body: err.message, tone: "error" });
    },
  });

  const overrideMutation = useMutation({
    mutationFn: ({ type, paused }: { type: string; paused: boolean }) =>
      adaptersApi.setOverridePaused(type, paused),
    onSuccess: () => {
      invalidate();
    },
    onError: (err: Error) => {
      pushToast({ title: copy.overrideToggleFailed, body: err.message, tone: "error" });
    },
  });

  const reloadMutation = useMutation({
    mutationFn: (type: string) => adaptersApi.reload(type),
    onSuccess: (result) => {
      invalidate();
      invalidateDynamicParser(result.type);
      invalidateConfigSchemaCache(result.type);
      pushToast({
        title: copy.adapterReloaded,
        body: reloadedBody(result.type, result.version),
        tone: "success",
      });
    },
    onError: (err: Error) => {
      pushToast({ title: copy.reloadFailed, body: err.message, tone: "error" });
    },
  });

  const reinstallMutation = useMutation({
    mutationFn: (type: string) => adaptersApi.reinstall(type),
    onSuccess: (result) => {
      invalidate();
      invalidateDynamicParser(result.type);
      invalidateConfigSchemaCache(result.type);
      pushToast({
        title: copy.adapterReinstalled,
        body: updatedFromNpmBody(result.type, result.version),
        tone: "success",
      });
    },
    onError: (err: Error) => {
      pushToast({ title: copy.reinstallFailed, body: err.message, tone: "error" });
    },
  });

  const builtinAdapters = (adapters ?? []).filter((a) => a.source === "builtin");
  const externalAdapters = (adapters ?? []).filter((a) => a.source === "external");

  // External adapters that override a builtin type.  The server only returns
  // one entry per type (the external), so we synthesize a builtin row for
  // the builtins section so users can see which builtins are affected.
  const overriddenBuiltins = (adapters ?? [])
    .filter((a) => a.source === "external" && a.overriddenBuiltin)
    .filter((a) => !builtinAdapters.some((b) => b.type === a.type))
    .map((a) => ({
      type: a.type,
      label: getAdapterLabel(a.type),
      overriddenBy: [
        a.packageName,
        a.version ? `v${a.version}` : undefined,
      ].filter(Boolean).join(" "),
      overridePaused: !!a.overridePaused,
      menuDisabled: !!a.disabled,
    }));

  if (isLoading) return <div className="p-4 text-sm text-muted-foreground">{copy.loadingAdapters}</div>;

  const isMutating = installMutation.isPending || removeMutation.isPending || toggleMutation.isPending || overrideMutation.isPending || reloadMutation.isPending || reinstallMutation.isPending;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cpu className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-xl font-semibold">{copy.adapters}</h1>
          <Badge variant="outline" className="text-amber-600 border-amber-400">
            {copy.alpha}
          </Badge>
        </div>

        <Dialog open={installDialogOpen} onOpenChange={setInstallDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              {copy.installAdapter}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{copy.installExternalAdapter}</DialogTitle>
              <DialogDescription>
                {copy.installExternalAdapterDescription}
                {" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">createServerAdapter()</code>.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {/* Source toggle */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs transition-colors",
                    !isLocalPath
                      ? "border-foreground bg-accent text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  )}
                  onClick={() => setIsLocalPath(false)}
                >
                  <Package className="h-3.5 w-3.5" />
                  {copy.npmPackage}
                </button>
                <button
                  type="button"
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs transition-colors",
                    isLocalPath
                      ? "border-foreground bg-accent text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  )}
                  onClick={() => setIsLocalPath(true)}
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  {copy.localPath}
                </button>
              </div>

              {isLocalPath ? (
                /* Local path input */
                <div className="grid gap-2">
                  <Label htmlFor="adapterLocalPath">{copy.pathToPackage}</Label>
                  <div className="flex gap-2">
                    <Input
                      id="adapterLocalPath"
                      className="flex-1 font-mono text-xs"
                      placeholder="/mnt/e/Projects/my-adapter  or  E:\Projects\my-adapter"
                      value={installPackage}
                      onChange={(e) => setInstallPackage(e.target.value)}
                    />
                    <ChoosePathButton />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {copy.acceptsPaths}
                  </p>
                </div>
              ) : (
                /* npm package input */
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="adapterPackageName">{copy.packageName}</Label>
                    <Input
                      id="adapterPackageName"
                      placeholder="my-paperclip-adapter"
                      value={installPackage}
                      onChange={(e) => setInstallPackage(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="adapterVersion">{copy.versionOptional}</Label>
                    <Input
                      id="adapterVersion"
                      placeholder="latest"
                      value={installVersion}
                      onChange={(e) => setInstallVersion(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInstallDialogOpen(false)}>{copy.cancel}</Button>
              <Button
                onClick={() =>
                  installMutation.mutate({
                    packageName: installPackage,
                    version: installVersion || undefined,
                    isLocalPath,
                  })
                }
                disabled={!installPackage || installMutation.isPending}
              >
                {installMutation.isPending ? copy.installing : copy.install}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Alpha notice */}
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <div className="space-y-1 text-sm">
            <p className="font-medium text-foreground">{copy.externalAdaptersAlpha}</p>
            <p className="text-muted-foreground">
              {copy.externalAdaptersAlphaDescription}
            </p>
          </div>
        </div>
      </div>

      {/* External adapters */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Cpu className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-base font-semibold">{copy.externalAdapters}</h2>
        </div>

        {externalAdapters.length === 0 ? (
          <Card className="bg-muted/30">
            <CardContent className="flex flex-col items-center justify-center py-10">
              <Cpu className="h-10 w-10 text-muted-foreground mb-4" />
              <p className="text-sm font-medium">{copy.noExternalAdapters}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {copy.noExternalAdaptersDescription}
              </p>
            </CardContent>
          </Card>
        ) : (
          <ul className="divide-y rounded-md border bg-card">
            {externalAdapters.map((adapter) => {
              const isBuiltinOverride = adapter.overriddenBuiltin;
              const overridePaused = isBuiltinOverride && !!adapter.overridePaused;

              // For overridden builtins, the power button controls the
              // override pause state (not server menu visibility).
              const effectiveAdapter: AdapterInfo = isBuiltinOverride
                ? { ...adapter, disabled: overridePaused ?? false }
                : adapter;

              return (
                <AdapterRow
                  key={adapter.type}
                  adapter={effectiveAdapter}
                  canRemove={true}
                  onToggle={
                    isBuiltinOverride
                      ? (type, disabled) => overrideMutation.mutate({ type, paused: disabled })
                      : (type, disabled) => toggleMutation.mutate({ type, disabled })
                  }
                  onRemove={(type) => setRemoveType(type)}
                  onReload={(type) => reloadMutation.mutate(type)}
                  onReinstall={!adapter.isLocalPath ? (type) => setReinstallTarget(adapter) : undefined}
                  isToggling={isBuiltinOverride ? overrideMutation.isPending : toggleMutation.isPending}
                  isReloading={reloadMutation.isPending}
                  isReinstalling={reinstallMutation.isPending}
                  toggleTitleDisabled={isBuiltinOverride ? copy.pauseExternalOverride : undefined}
                  toggleTitleEnabled={isBuiltinOverride ? copy.resumeExternalOverride : undefined}
                  disabledBadgeLabel={isBuiltinOverride ? copy.overridePaused : undefined}
                />
              );
            })}
          </ul>
        )}
      </section>

      {/* Built-in adapters */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Cpu className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-base font-semibold">{copy.builtInAdapters}</h2>
        </div>

        {builtinAdapters.length === 0 && overriddenBuiltins.length === 0 ? (
          <div className="text-sm text-muted-foreground">{copy.noBuiltInAdapters}</div>
        ) : (
          <ul className="divide-y rounded-md border bg-card">
            {builtinAdapters.map((adapter) => (
              <AdapterRow
                key={adapter.type}
                adapter={adapter}
                canRemove={false}
                onToggle={(type, disabled) => toggleMutation.mutate({ type, disabled })}
                onRemove={() => {}}
                isToggling={isMutating}
              />
            ))}
            {overriddenBuiltins.map((virtual) => (
              <AdapterRow
                key={virtual.type}
                adapter={{
                  type: virtual.type,
                  label: virtual.label,
                  source: "builtin",
                  modelsCount: 0,
                  loaded: true,
                  disabled: virtual.menuDisabled,
                }}
                canRemove={false}
                onToggle={(type, disabled) => toggleMutation.mutate({ type, disabled })}
                onRemove={() => {}}
                isToggling={isMutating}
                overriddenBy={virtual.overridePaused ? undefined : virtual.overriddenBy}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Remove confirmation */}
      <Dialog
        open={removeType !== null}
        onOpenChange={(open) => { if (!open) setRemoveType(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy.removeAdapter}</DialogTitle>
            <DialogDescription>
              {uiLanguage === "zh-CN" ? (
                <>
                  确认要移除 <strong>{removeType}</strong> 适配器吗？它会从适配器存储中注销并删除。
                  {removeType && adapters?.find((a) => a.type === removeType)?.packageName && (
                    <> 对应的 npm 包也会从磁盘中清理。</>
                  )}
                  {" "}此操作无法撤销。
                </>
              ) : (
                <>
                  Are you sure you want to remove the <strong>{removeType}</strong> adapter?
                  It will be unregistered and removed from the adapter store.
                  {removeType && adapters?.find((a) => a.type === removeType)?.packageName && (
                    <> npm packages will be cleaned up from disk.</>
                  )}
                  {" "}This action cannot be undone.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveType(null)}>{copy.cancel}</Button>
            <Button
              variant="destructive"
              disabled={removeMutation.isPending}
              onClick={() => {
                if (removeType) {
                  removeMutation.mutate(removeType, {
                    onSettled: () => setRemoveType(null),
                  });
                }
              }}
            >
              {removeMutation.isPending ? copy.removing : copy.remove}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Reinstall confirmation */}
      <ReinstallDialog
        adapter={reinstallTarget}
        open={reinstallTarget !== null}
        isReinstalling={reinstallMutation.isPending}
        onConfirm={() => {
          if (reinstallTarget) {
            reinstallMutation.mutate(reinstallTarget.type, {
              onSettled: () => setReinstallTarget(null),
            });
          }
        }}
        onCancel={() => setReinstallTarget(null)}
      />
    </div>
  );
}
