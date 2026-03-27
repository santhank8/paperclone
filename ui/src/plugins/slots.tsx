/**
 * @fileoverview 插件 UI 插槽系统 — 动态加载、错误隔离和插件贡献的 UI 扩展渲染。
 *
 * 提供：
 * - `usePluginSlots(type, context?)` — React hook，用于发现和过滤指定插槽类型的插件 UI 贡献。
 * - `PluginSlotOutlet` — 内联渲染所有匹配的插槽，并为每个插件提供错误边界隔离。
 * - `PluginBridgeScope` — 包装每个插件的组件树，注入桥接 hook 所需的桥接上下文
 *   （`pluginId`、主机上下文）。
 *
 * 插件 UI 模块通过从主机静态文件服务器（`/_plugins/:pluginId/ui/:entryFile`）
 * 动态 ESM `import()` 加载。每个模块导出与清单中 `ui.slots[].exportName`
 * 对应的命名 React 组件。
 *
 * @see PLUGIN_SPEC.md §19 — UI 扩展模型
 * @see PLUGIN_SPEC.md §19.0.3 — 包服务
 */
import {
  Component,
  createElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
  type ComponentType,
} from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  PluginLauncherDeclaration,
  PluginUiSlotDeclaration,
  PluginUiSlotEntityType,
  PluginUiSlotType,
} from "@paperclipai/shared";
import { pluginsApi, type PluginUiContribution } from "@/api/plugins";
import { authApi } from "@/api/auth";
import { queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";
import {
  PluginBridgeContext,
  type PluginHostContext,
} from "./bridge";

export type PluginSlotContext = {
  companyId?: string | null;
  companyPrefix?: string | null;
  projectId?: string | null;
  entityId?: string | null;
  entityType?: PluginUiSlotEntityType | null;
  /** 嵌套插槽的父实体 ID（例如任务中的评论注释）。 */
  parentEntityId?: string | null;
  projectRef?: string | null;
};

export type ResolvedPluginSlot = PluginUiSlotDeclaration & {
  pluginId: string;
  pluginKey: string;
  pluginDisplayName: string;
  pluginVersion: string;
};

type PluginSlotComponentProps = {
  slot: ResolvedPluginSlot;
  context: PluginSlotContext;
};

export type RegisteredPluginComponent =
  | {
    kind: "react";
    component: ComponentType<PluginSlotComponentProps>;
  }
  | {
    kind: "web-component";
    tagName: string;
  };

type SlotFilters = {
  slotTypes: PluginUiSlotType[];
  entityType?: PluginUiSlotEntityType | null;
  companyId?: string | null;
  enabled?: boolean;
};

type UsePluginSlotsResult = {
  slots: ResolvedPluginSlot[];
  isLoading: boolean;
  errorMessage: string | null;
};

/**
 * 主机页面加载的插件 UI 导出的内存注册表。
 * 键为 `${pluginKey}:${exportName}`，与清单插槽声明匹配。
 */
const registry = new Map<string, RegisteredPluginComponent>();

function buildRegistryKey(pluginKey: string, exportName: string): string {
  return `${pluginKey}:${exportName}`;
}

function requiresEntityType(slotType: PluginUiSlotType): boolean {
  return slotType === "detailTab" || slotType === "taskDetailView" || slotType === "contextMenuItem" || slotType === "commentAnnotation" || slotType === "commentContextMenuItem" || slotType === "projectSidebarItem" || slotType === "toolbarButton";
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "未知错误";
}

/**
 * 为插件 UI 插槽注册一个 React 组件导出。
 */
export function registerPluginReactComponent(
  pluginKey: string,
  exportName: string,
  component: ComponentType<PluginSlotComponentProps>,
): void {
  registry.set(buildRegistryKey(pluginKey, exportName), {
    kind: "react",
    component,
  });
}

/**
 * 为插件 UI 插槽注册一个自定义元素标签。
 */
export function registerPluginWebComponent(
  pluginKey: string,
  exportName: string,
  tagName: string,
): void {
  registry.set(buildRegistryKey(pluginKey, exportName), {
    kind: "web-component",
    tagName,
  });
}

function resolveRegisteredComponent(slot: ResolvedPluginSlot): RegisteredPluginComponent | null {
  return registry.get(buildRegistryKey(slot.pluginKey, slot.exportName)) ?? null;
}

export function resolveRegisteredPluginComponent(
  pluginKey: string,
  exportName: string,
): RegisteredPluginComponent | null {
  return registry.get(buildRegistryKey(pluginKey, exportName)) ?? null;
}

// ---------------------------------------------------------------------------
// 插件模块动态导入加载器
// ---------------------------------------------------------------------------

type PluginLoadState = "idle" | "loading" | "loaded" | "error";

/**
 * 按贡献缓存键跟踪每个插件 UI 模块的加载状态。
 *
 * 插件模块加载后，其所有命名导出会被检查并注册到组件 `registry` 中，
 * 以便 `resolveRegisteredComponent` 在插槽渲染时能够找到它们。
 */
const pluginLoadStates = new Map<string, PluginLoadState>();

/**
 * Promise 缓存，防止同一插件的并发重复导入。
 */
const inflightImports = new Map<string, Promise<void>>();

/**
 * 构建插件 UI 入口模块的完整 URL。
 *
 * 服务器在 `/_plugins/:pluginId/ui/*` 提供插件 UI 包。
 * 贡献中的 `uiEntryFile`（通常为 `"index.js"`）被追加以形成完整的导入路径。
 */
function buildPluginModuleKey(contribution: PluginUiContribution): string {
  const cacheHint = contribution.updatedAt ?? contribution.version ?? "0";
  return `${contribution.pluginId}:${cacheHint}`;
}

function buildPluginUiUrl(contribution: PluginUiContribution): string {
  const cacheHint = encodeURIComponent(contribution.updatedAt ?? contribution.version ?? "0");
  return `/_plugins/${encodeURIComponent(contribution.pluginId)}/ui/${contribution.uiEntryFile}?v=${cacheHint}`;
}

/**
 * 导入带有裸说明符重写的插件 UI 入口模块。
 *
 * 插件包使用 `external: ["@paperclipai/plugin-sdk/ui", "react", "react-dom"]` 构建，
 * 因此其 ESM 输出包含如下裸说明符导入：
 *
 * ```js
 * import { usePluginData } from "@paperclipai/plugin-sdk/ui";
 * import React from "react";
 * ```
 *
 * 浏览器无法在没有导入映射的情况下解析裸说明符。我们不使用导入映射的时序约束，
 * 而是：
 * 1. 获取模块源文本
 * 2. 将裸说明符导入重写为 blob URL，从主机的全局桥接注册表
 *    （`globalThis.__paperclipPluginBridge__`）重新导出
 * 3. 通过 blob URL 导入重写后的模块
 *
 * 此方法兼容所有现代浏览器，并避免了导入映射的排序问题。
 */
const shimBlobUrls: Record<string, string> = {};

function applyJsxRuntimeKey(
  props: Record<string, unknown> | null | undefined,
  key: string | number | undefined,
): Record<string, unknown> {
  if (key === undefined) return props ?? {};
  return { ...(props ?? {}), key };
}

function getShimBlobUrl(specifier: "react" | "react-dom" | "react-dom/client" | "react/jsx-runtime" | "sdk-ui"): string {
  if (shimBlobUrls[specifier]) return shimBlobUrls[specifier];

  let source: string;
  switch (specifier) {
    case "react":
      source = `
        const R = globalThis.__paperclipPluginBridge__?.react;
        export default R;
        const { useState, useEffect, useCallback, useMemo, useRef, useContext,
          createContext, createElement, Fragment, Component, forwardRef,
          memo, lazy, Suspense, StrictMode, cloneElement, Children,
          isValidElement, createRef } = R;
        export { useState, useEffect, useCallback, useMemo, useRef, useContext,
          createContext, createElement, Fragment, Component, forwardRef,
          memo, lazy, Suspense, StrictMode, cloneElement, Children,
          isValidElement, createRef };
      `;
      break;
    case "react/jsx-runtime":
      source = `
        const R = globalThis.__paperclipPluginBridge__?.react;
        const withKey = ${applyJsxRuntimeKey.toString()};
        export const jsx = (type, props, key) => R.createElement(type, withKey(props, key));
        export const jsxs = (type, props, key) => R.createElement(type, withKey(props, key));
        export const Fragment = R.Fragment;
      `;
      break;
    case "react-dom":
    case "react-dom/client":
      source = `
        const RD = globalThis.__paperclipPluginBridge__?.reactDom;
        export default RD;
        const { createRoot, hydrateRoot, createPortal, flushSync } = RD ?? {};
        export { createRoot, hydrateRoot, createPortal, flushSync };
      `;
      break;
    case "sdk-ui":
      source = `
        const SDK = globalThis.__paperclipPluginBridge__?.sdkUi ?? {};
        const { usePluginData, usePluginAction, useHostContext, usePluginStream, usePluginToast } = SDK;
        export { usePluginData, usePluginAction, useHostContext, usePluginStream, usePluginToast };
      `;
      break;
  }

  const blob = new Blob([source], { type: "application/javascript" });
  const url = URL.createObjectURL(blob);
  shimBlobUrls[specifier] = url;
  return url;
}

/**
 * 将 ESM 源字符串中的裸说明符导入重写为 blob URL。
 *
 * 处理 esbuild/rollup 生成的标准导入模式：
 * - `import { ... } from "react";`
 * - `import React from "react";`
 * - `import * as React from "react";`
 * - `import { ... } from "@paperclipai/plugin-sdk/ui";`
 *
 * 也处理重导出：
 * - `export { ... } from "react";`
 */
function rewriteBareSpecifiers(source: string): string {
  // 构建裸说明符到 blob URL 的映射。
  const rewrites: Record<string, string> = {
    '"@paperclipai/plugin-sdk/ui"': `"${getShimBlobUrl("sdk-ui")}"`,
    "'@paperclipai/plugin-sdk/ui'": `'${getShimBlobUrl("sdk-ui")}'`,
    '"@paperclipai/plugin-sdk/ui/hooks"': `"${getShimBlobUrl("sdk-ui")}"`,
    "'@paperclipai/plugin-sdk/ui/hooks'": `'${getShimBlobUrl("sdk-ui")}'`,
    '"react/jsx-runtime"': `"${getShimBlobUrl("react/jsx-runtime")}"`,
    "'react/jsx-runtime'": `'${getShimBlobUrl("react/jsx-runtime")}'`,
    '"react-dom/client"': `"${getShimBlobUrl("react-dom/client")}"`,
    "'react-dom/client'": `'${getShimBlobUrl("react-dom/client")}'`,
    '"react-dom"': `"${getShimBlobUrl("react-dom")}"`,
    "'react-dom'": `'${getShimBlobUrl("react-dom")}'`,
    '"react"': `"${getShimBlobUrl("react")}"`,
    "'react'": `'${getShimBlobUrl("react")}'`,
  };

  let result = source;
  for (const [from, to] of Object.entries(rewrites)) {
    // 仅在 import/export from 上下文中重写，不在任意字符串中重写。
    // 正则匹配 `from "..."` 或 `from '...'` 模式。
    result = result.replaceAll(` from ${from}`, ` from ${to}`);
    // 也处理 `import "..."`（副作用导入）
    result = result.replaceAll(`import ${from}`, `import ${to}`);
  }

  return result;
}

/**
 * 获取、重写并导入插件 UI 模块。
 *
 * @param url - 插件 UI 入口模块的 URL
 * @returns 模块的导出
 */
async function importPluginModule(url: string): Promise<Record<string, unknown>> {
  // 检查桥接注册表是否可用。如果不可用，回退到直接导入
  //（裸说明符会失败但不会导致加载器崩溃）。
  if (!globalThis.__paperclipPluginBridge__) {
    console.warn("[plugin-loader] 桥接注册表未初始化，回退到直接导入");
    return import(/* @vite-ignore */ url);
  }

  // 获取模块源文本
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`获取插件模块失败：${response.status} ${response.statusText}`);
  }

  const source = await response.text();

  // 将裸说明符导入重写为 blob URL
  const rewritten = rewriteBareSpecifiers(source);

  // 从重写后的源创建 blob URL 并导入
  const blob = new Blob([rewritten], { type: "application/javascript" });
  const blobUrl = URL.createObjectURL(blob);

  try {
    const mod = await import(/* @vite-ignore */ blobUrl);
    return mod;
  } finally {
    // 导入后清理 blob URL（模块已加载）
    URL.revokeObjectURL(blobUrl);
  }
}

/**
 * 动态导入插件的 UI 入口模块，并将所有看起来像 React 组件（函数或类）的
 * 命名导出注册到组件注册表中。
 *
 * 这取代了之前需要插件包通过 `window.paperclipPlugins.registerReactComponent()`
 * 自行注册的方式。现在主机负责导入模块并将导出绑定到正确的
 * `pluginKey:exportName` 注册表键。
 *
 * 插件模块使用裸说明符重写加载，以便 `@paperclipai/plugin-sdk/ui`、`react`
 * 和 `react-dom` 的导入通过桥接注册表解析为主机提供的实现。
 *
 * Web 组件注册仍然有效：如果模块有一个命名导出与插槽中声明的 `exportName`
 * 匹配且该导出是字符串（自定义元素标签名），则注册为 Web 组件。
 */
async function loadPluginModule(contribution: PluginUiContribution): Promise<void> {
  const { pluginId, pluginKey, slots, launchers } = contribution;
  const moduleKey = buildPluginModuleKey(contribution);

  // 已加载或正在加载 — 直接返回。
  const state = pluginLoadStates.get(moduleKey);
  if (state === "loaded" || state === "loading") {
    // 如果当前正在加载，等待进行中的 promise。
    const inflight = inflightImports.get(pluginId);
    if (inflight) await inflight;
    return;
  }

  // 如果该插件 ID 的另一个导入正在进行中，等待它完成。
  const running = inflightImports.get(pluginId);
  if (running) {
    await running;
    const recheckedState = pluginLoadStates.get(moduleKey);
    if (recheckedState === "loaded") {
      return;
    }
  }

  pluginLoadStates.set(moduleKey, "loading");

  const url = buildPluginUiUrl(contribution);

  const importPromise = (async () => {
    try {
      // 使用裸说明符重写动态 ESM 导入插件 UI 入口模块，
      // 以支持主机提供的依赖。
      const mod: Record<string, unknown> = await importPluginModule(url);

      // 收集所有 UI 贡献中声明的导出名称集合，
      // 仅注册清单中声明的内容（忽略额外导出）。
      const declaredExports = new Set<string>();
      for (const slot of slots) {
        declaredExports.add(slot.exportName);
      }
      for (const launcher of launchers) {
        if (launcher.exportName) {
          declaredExports.add(launcher.exportName);
        }
        if (isLauncherComponentTarget(launcher)) {
          declaredExports.add(launcher.action.target);
        }
      }

      for (const exportName of declaredExports) {
        const exported = mod[exportName];
        if (exported === undefined) {
          console.warn(
            `插件 "${pluginKey}" 声明了插槽导出 "${exportName}"，但模块中未找到该导出。`,
          );
          continue;
        }

        if (typeof exported === "function") {
          // React 组件（函数组件或类组件）。
          registerPluginReactComponent(
            pluginKey,
            exportName,
            exported as ComponentType<PluginSlotComponentProps>,
          );
        } else if (typeof exported === "string") {
          // Web 组件标签名。
          registerPluginWebComponent(pluginKey, exportName, exported);
        } else {
          console.warn(
            `插件 "${pluginKey}" 的导出 "${exportName}" 既不是函数也不是字符串标签名 — 已跳过。`,
          );
        }
      }

      pluginLoadStates.set(moduleKey, "loaded");
    } catch (err) {
      pluginLoadStates.set(moduleKey, "error");
      console.error(`加载插件 "${pluginKey}" 的 UI 模块失败`, err);
    } finally {
      inflightImports.delete(pluginId);
    }
  })();

  inflightImports.set(pluginId, importPromise);
  await importPromise;
}

function isLauncherComponentTarget(launcher: PluginLauncherDeclaration): boolean {
  return launcher.action.type === "openModal"
    || launcher.action.type === "openDrawer"
    || launcher.action.type === "openPopover";
}

/**
 * 为一组插件贡献加载 UI 模块。
 *
 * 返回一个在所有模块加载完成（或失败）后解析的 promise。
 * 已加载的插件将被跳过。
 */
async function ensurePluginModulesLoaded(contributions: PluginUiContribution[]): Promise<void> {
  await Promise.all(
    contributions.map((c) => loadPluginModule(c)),
  );
}

export async function ensurePluginContributionLoaded(
  contribution: PluginUiContribution,
): Promise<void> {
  await loadPluginModule(contribution);
}

/**
 * 返回一组插件贡献的聚合加载状态。
 * - 如果任何插件仍在加载 → "loading"
 * - 如果全部已加载（或没有贡献）→ "loaded"
 * - 如果全部完成但部分出错 → "loaded"（错误已记录，非致命）
 */
function aggregateLoadState(contributions: PluginUiContribution[]): "loading" | "loaded" {
  for (const c of contributions) {
    const state = pluginLoadStates.get(buildPluginModuleKey(c));
    if (state === "loading" || state === "idle" || state === undefined) {
      return "loading";
    }
  }
  return "loaded";
}

// ---------------------------------------------------------------------------
// React hooks
// ---------------------------------------------------------------------------

/**
 * 当贡献变化时触发插件 UI 模块的动态加载。
 *
 * 此 hook 有意与 usePluginSlots 解耦，以便通过 `usePluginSlots()` 消费插槽的
 * 调用方自动获得模块加载，无需额外配置。
 */
function usePluginModuleLoader(contributions: PluginUiContribution[] | undefined) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!contributions || contributions.length === 0) return;

    // 过滤出尚未加载的贡献。
    const unloaded = contributions.filter((c) => {
      const state = pluginLoadStates.get(buildPluginModuleKey(c));
      return state !== "loaded" && state !== "loading";
    });

    if (unloaded.length === 0) return;

    let cancelled = false;
    void ensurePluginModulesLoaded(unloaded).then(() => {
      // 重新渲染以便插槽挂载点可以解析新注册的组件。
      if (!cancelled) setTick((t) => t + 1);
    });

    return () => {
      cancelled = true;
    };
  }, [contributions]);
}

/**
 * 在所有就绪的插件贡献中解析和排序插槽。
 *
 * 过滤规则：
 * - `slotTypes` 必须匹配调用方请求的主机插槽类型之一。
 * - 实体范围的插槽类型（`detailTab`、`taskDetailView`、`contextMenuItem`）
 *   需要 `entityType` 且必须包含在 `slot.entityTypes` 中。
 *
 * 自动触发对任何新发现贡献的插件 UI 模块的动态导入。
 * 组件在加载完成后渲染。
 */
export function usePluginSlots(filters: SlotFilters): UsePluginSlotsResult {
  const queryEnabled = filters.enabled ?? true;
  const { data, isLoading: isQueryLoading, error } = useQuery({
    queryKey: queryKeys.plugins.uiContributions,
    queryFn: () => pluginsApi.listUiContributions(),
    enabled: queryEnabled,
  });

  // 为任何新的插件贡献启动动态导入。
  usePluginModuleLoader(data);

  const slotTypesKey = useMemo(() => [...filters.slotTypes].sort().join("|"), [filters.slotTypes]);

  const slots = useMemo(() => {
    const allowedTypes = new Set(slotTypesKey.split("|").filter(Boolean) as PluginUiSlotType[]);
    const rows: ResolvedPluginSlot[] = [];
    for (const contribution of data ?? []) {
      for (const slot of contribution.slots) {
        if (!allowedTypes.has(slot.type)) continue;
        if (requiresEntityType(slot.type)) {
          if (!filters.entityType) continue;
          if (!slot.entityTypes?.includes(filters.entityType)) continue;
        }
        rows.push({
          ...slot,
          pluginId: contribution.pluginId,
          pluginKey: contribution.pluginKey,
          pluginDisplayName: contribution.displayName,
          pluginVersion: contribution.version,
        });
      }
    }
    rows.sort((a, b) => {
      const ao = a.order ?? Number.MAX_SAFE_INTEGER;
      const bo = b.order ?? Number.MAX_SAFE_INTEGER;
      if (ao !== bo) return ao - bo;
      const pluginCmp = a.pluginDisplayName.localeCompare(b.pluginDisplayName);
      if (pluginCmp !== 0) return pluginCmp;
      return a.displayName.localeCompare(b.displayName);
    });
    return rows;
  }, [data, filters.entityType, slotTypesKey]);

  // 在查询和模块导入都完成之前视为加载中。
  const modulesLoaded = data ? aggregateLoadState(data) === "loaded" : true;
  const isLoading = queryEnabled && (isQueryLoading || !modulesLoaded);

  return {
    slots,
    isLoading,
    errorMessage: error ? getErrorMessage(error) : null,
  };
}

type PluginSlotErrorBoundaryProps = {
  slot: ResolvedPluginSlot;
  className?: string;
  children: ReactNode;
};

type PluginSlotErrorBoundaryState = {
  hasError: boolean;
};

class PluginSlotErrorBoundary extends Component<PluginSlotErrorBoundaryProps, PluginSlotErrorBoundaryState> {
  override state: PluginSlotErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): PluginSlotErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    // 保持插件故障隔离，同时保留可操作的诊断信息。
    console.error("插件插槽渲染失败", {
      pluginKey: this.props.slot.pluginKey,
      slotId: this.props.slot.id,
      error,
      info: info.componentStack,
    });
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className={cn("rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1 text-xs text-destructive", this.props.className)}>
          {this.props.slot.pluginDisplayName}：渲染失败
        </div>
      );
    }
    return this.props.children;
  }
}

function PluginWebComponentMount({
  tagName,
  slot,
  context,
  className,
}: {
  tagName: string;
  slot: ResolvedPluginSlot;
  context: PluginSlotContext;
  className?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    // 将清单插槽/上下文元数据桥接到自定义元素实例上。
    const el = ref.current as HTMLElement & {
      pluginSlot?: ResolvedPluginSlot;
      pluginContext?: PluginSlotContext;
    };
    el.pluginSlot = slot;
    el.pluginContext = context;
  }, [context, slot]);

  return createElement(tagName, { ref, className });
}

type PluginSlotMountProps = {
  slot: ResolvedPluginSlot;
  context: PluginSlotContext;
  className?: string;
  missingBehavior?: "hidden" | "placeholder";
};

/**
 * 将插槽的 `PluginSlotContext` 映射为桥接器的 `PluginHostContext`。
 *
 * 桥接 hook 需要完整的主机上下文结构；插槽上下文携带渲染位置可用的子集。
 */
function slotContextToHostContext(
  pluginSlotContext: PluginSlotContext,
  userId: string | null,
): PluginHostContext {
  return {
    companyId: pluginSlotContext.companyId ?? null,
    companyPrefix: pluginSlotContext.companyPrefix ?? null,
    projectId: pluginSlotContext.projectId ?? (pluginSlotContext.entityType === "project" ? pluginSlotContext.entityId ?? null : null),
    entityId: pluginSlotContext.entityId ?? null,
    entityType: pluginSlotContext.entityType ?? null,
    parentEntityId: pluginSlotContext.parentEntityId ?? null,
    userId,
    renderEnvironment: null,
  };
}

/**
 * 包装组件，在插件渲染周围设置活跃的桥接上下文。
 *
 * 确保 `usePluginData()`、`usePluginAction()` 和 `useHostContext()`
 * 在渲染阶段能够访问当前插件 ID 和主机上下文。
 */
function PluginBridgeScope({
  pluginId,
  context,
  children,
}: {
  pluginId: string;
  context: PluginSlotContext;
  children: ReactNode;
}) {
  const { data: session } = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
  });
  const userId = session?.user?.id ?? session?.session?.userId ?? null;
  const hostContext = useMemo(() => slotContextToHostContext(context, userId), [context, userId]);
  const value = useMemo(() => ({ pluginId, hostContext }), [pluginId, hostContext]);

  return (
    <PluginBridgeContext.Provider value={value}>
      {children}
    </PluginBridgeContext.Provider>
  );
}

export function PluginSlotMount({
  slot,
  context,
  className,
  missingBehavior = "hidden",
}: PluginSlotMountProps) {
  const [, forceRerender] = useState(0);
  const component = resolveRegisteredComponent(slot);

  useEffect(() => {
    if (component) return;
    const inflight = inflightImports.get(slot.pluginId);
    if (!inflight) return;

    let cancelled = false;
    void inflight.finally(() => {
      if (!cancelled) {
        forceRerender((tick) => tick + 1);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [component, slot.pluginId]);

  if (!component) {
    if (missingBehavior === "hidden") return null;
    return (
      <div className={cn("rounded-md border border-dashed border-border px-2 py-1 text-xs text-muted-foreground", className)}>
        {slot.pluginDisplayName}: {slot.displayName}
      </div>
    );
  }

  if (component.kind === "react") {
    const node = createElement(component.component, { slot, context });
    return (
      <PluginSlotErrorBoundary slot={slot} className={className}>
        <PluginBridgeScope pluginId={slot.pluginId} context={context}>
          {className ? <div className={className}>{node}</div> : node}
        </PluginBridgeScope>
      </PluginSlotErrorBoundary>
    );
  }

  return (
    <PluginSlotErrorBoundary slot={slot} className={className}>
      <PluginWebComponentMount
        tagName={component.tagName}
        slot={slot}
        context={context}
        className={className}
      />
    </PluginSlotErrorBoundary>
  );
}

type PluginSlotOutletProps = {
  slotTypes: PluginUiSlotType[];
  context: PluginSlotContext;
  entityType?: PluginUiSlotEntityType | null;
  className?: string;
  itemClassName?: string;
  errorClassName?: string;
  missingBehavior?: "hidden" | "placeholder";
};

export function PluginSlotOutlet({
  slotTypes,
  context,
  entityType,
  className,
  itemClassName,
  errorClassName,
  missingBehavior = "hidden",
}: PluginSlotOutletProps) {
  const { slots, errorMessage } = usePluginSlots({
    slotTypes,
    entityType,
    companyId: context.companyId,
  });

  if (errorMessage) {
    return (
      <div className={cn("rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1 text-xs text-destructive", errorClassName)}>
        插件扩展不可用：{errorMessage}
      </div>
    );
  }

  if (slots.length === 0) return null;

  return (
    <div className={className}>
      {slots.map((slot) => (
        <PluginSlotMount
          key={`${slot.pluginKey}:${slot.id}`}
          slot={slot}
          context={context}
          className={itemClassName}
          missingBehavior={missingBehavior}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 测试辅助工具 — 仅供测试套件使用。
// ---------------------------------------------------------------------------

/**
 * 重置模块加载器状态。仅在测试中使用。
 * @internal
 */
export function _resetPluginModuleLoader(): void {
  pluginLoadStates.clear();
  inflightImports.clear();
  registry.clear();
  if (typeof URL.revokeObjectURL === "function") {
    for (const url of Object.values(shimBlobUrls)) {
      URL.revokeObjectURL(url);
    }
  }
  for (const key of Object.keys(shimBlobUrls)) {
    delete shimBlobUrls[key];
  }
}

export const _applyJsxRuntimeKeyForTests = applyJsxRuntimeKey;
export const _rewriteBareSpecifiersForTests = rewriteBareSpecifiers;
