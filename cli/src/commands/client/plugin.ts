import path from "node:path";
import { Command } from "commander";
import pc from "picocolors";
import {
  addCommonClientOptions,
  handleCommandError,
  printOutput,
  resolveCommandContext,
  type BaseClientOptions,
} from "./common.js";

// ---------------------------------------------------------------------------
// Types mirroring server-side shapes
// ---------------------------------------------------------------------------

interface PluginRecord {
  id: string;
  pluginKey: string;
  packageName: string;
  version: string;
  status: string;
  displayName?: string;
  lastError?: string | null;
  installedAt: string;
  updatedAt: string;
}


// ---------------------------------------------------------------------------
// Option types
// ---------------------------------------------------------------------------

interface PluginListOptions extends BaseClientOptions {
  status?: string;
}

interface PluginInstallOptions extends BaseClientOptions {
  local?: boolean;
  version?: string;
}

interface PluginUninstallOptions extends BaseClientOptions {
  force?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a local path argument to an absolute path so the server can find the
 * plugin on disk regardless of where the user ran the CLI.
 */
function resolvePackageArg(packageArg: string, isLocal: boolean): string {
  if (!isLocal) return packageArg;
  // Already absolute
  if (path.isAbsolute(packageArg)) return packageArg;
  // Expand leading ~ to home directory
  if (packageArg.startsWith("~")) {
    const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
    return path.resolve(home, packageArg.slice(1).replace(/^[\\/]/, ""));
  }
  return path.resolve(process.cwd(), packageArg);
}

function formatPlugin(p: PluginRecord): string {
  const statusColor =
    p.status === "ready"
      ? pc.green(p.status)
      : p.status === "error"
        ? pc.red(p.status)
        : p.status === "disabled"
          ? pc.dim(p.status)
          : pc.yellow(p.status);

  const parts = [
    `key=${pc.bold(p.pluginKey)}`,
    `status=${statusColor}`,
    `version=${p.version}`,
    `id=${pc.dim(p.id)}`,
  ];

  if (p.lastError) {
    parts.push(`error=${pc.red(p.lastError.slice(0, 80))}`);
  }

  return parts.join("  ");
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

export function registerPluginCommands(program: Command): void {
  const plugin = program.command("plugin").description("插件生命周期管理");

  // -------------------------------------------------------------------------
  // plugin list
  // -------------------------------------------------------------------------
  addCommonClientOptions(
    plugin
      .command("list")
      .description("列出已安装的插件")
      .option("--status <status>", "Filter by status (ready, error, disabled, installed, upgrade_pending)")
      .action(async (opts: PluginListOptions) => {
        try {
          const ctx = resolveCommandContext(opts);
          const qs = opts.status ? `?status=${encodeURIComponent(opts.status)}` : "";
          const plugins = await ctx.api.get<PluginRecord[]>(`/api/plugins${qs}`);

          if (ctx.json) {
            printOutput(plugins, { json: true });
            return;
          }

          const rows = plugins ?? [];
          if (rows.length === 0) {
            console.log(pc.dim("未安装任何插件。"));
            return;
          }

          for (const p of rows) {
            console.log(formatPlugin(p));
          }
        } catch (err) {
          handleCommandError(err);
        }
      }),
  );

  // -------------------------------------------------------------------------
  // plugin install <package-or-path>
  // -------------------------------------------------------------------------
  addCommonClientOptions(
    plugin
      .command("install <package>")
      .description(
        "从本地路径或 npm 包安装插件。\n" +
          "  示例：\n" +
          "    paperclipai plugin install ./my-plugin              # 本地路径\n" +
          "    paperclipai plugin install @acme/plugin-linear      # npm 包\n" +
          "    paperclipai plugin install @acme/plugin-linear@1.2  # 固定版本",
      )
      .option("-l, --local", "Treat <package> as a local filesystem path", false)
      .option("--version <version>", "Specific npm version to install (npm packages only)")
      .action(async (packageArg: string, opts: PluginInstallOptions) => {
        try {
          const ctx = resolveCommandContext(opts);

          // Auto-detect local paths: starts with . or / or ~ or is an absolute path
          const isLocal =
            opts.local ||
            packageArg.startsWith("./") ||
            packageArg.startsWith("../") ||
            packageArg.startsWith("/") ||
            packageArg.startsWith("~");

          const resolvedPackage = resolvePackageArg(packageArg, isLocal);

          if (!ctx.json) {
            console.log(
              pc.dim(
                isLocal
                  ? `正在从本地路径安装插件：${resolvedPackage}`
                  : `正在安装插件：${resolvedPackage}${opts.version ? `@${opts.version}` : ""}`,
              ),
            );
          }

          const installedPlugin = await ctx.api.post<PluginRecord>("/api/plugins/install", {
            packageName: resolvedPackage,
            version: opts.version,
            isLocalPath: isLocal,
          });

          if (ctx.json) {
            printOutput(installedPlugin, { json: true });
            return;
          }

          if (!installedPlugin) {
            console.log(pc.dim("安装未返回插件记录。"));
            return;
          }

          console.log(
            pc.green(
              `✓ 已安装 ${pc.bold(installedPlugin.pluginKey)} v${installedPlugin.version} (${installedPlugin.status})`,
            ),
          );

          if (installedPlugin.lastError) {
            console.log(pc.red(`  警告：${installedPlugin.lastError}`));
          }
        } catch (err) {
          handleCommandError(err);
        }
      }),
  );

  // -------------------------------------------------------------------------
  // plugin uninstall <plugin-key-or-id>
  // -------------------------------------------------------------------------
  addCommonClientOptions(
    plugin
      .command("uninstall <pluginKey>")
      .description(
        "通过插件键或数据库 ID 卸载插件。\n" +
          "  使用 --force 强制清除所有状态和配置。",
      )
      .option("--force", "Purge all plugin state and config (hard delete)", false)
      .action(async (pluginKey: string, opts: PluginUninstallOptions) => {
        try {
          const ctx = resolveCommandContext(opts);
          const purge = opts.force === true;
          const qs = purge ? "?purge=true" : "";

          if (!ctx.json) {
            console.log(
              pc.dim(
                purge
                  ? `正在卸载并清除插件：${pluginKey}`
                  : `正在卸载插件：${pluginKey}`,
              ),
            );
          }

          const result = await ctx.api.delete<PluginRecord | null>(
            `/api/plugins/${encodeURIComponent(pluginKey)}${qs}`,
          );

          if (ctx.json) {
            printOutput(result, { json: true });
            return;
          }

          console.log(pc.green(`✓ 已卸载 ${pc.bold(pluginKey)}${purge ? "（已清除）" : ""}`));
        } catch (err) {
          handleCommandError(err);
        }
      }),
  );

  // -------------------------------------------------------------------------
  // plugin enable <plugin-key-or-id>
  // -------------------------------------------------------------------------
  addCommonClientOptions(
    plugin
      .command("enable <pluginKey>")
      .description("启用已禁用或出错的插件")
      .action(async (pluginKey: string, opts: BaseClientOptions) => {
        try {
          const ctx = resolveCommandContext(opts);
          const result = await ctx.api.post<PluginRecord>(
            `/api/plugins/${encodeURIComponent(pluginKey)}/enable`,
          );

          if (ctx.json) {
            printOutput(result, { json: true });
            return;
          }

          console.log(pc.green(`✓ 已启用 ${pc.bold(pluginKey)} — 状态：${result?.status ?? "unknown"}`));
        } catch (err) {
          handleCommandError(err);
        }
      }),
  );

  // -------------------------------------------------------------------------
  // plugin disable <plugin-key-or-id>
  // -------------------------------------------------------------------------
  addCommonClientOptions(
    plugin
      .command("disable <pluginKey>")
      .description("禁用运行中的插件而不卸载")
      .action(async (pluginKey: string, opts: BaseClientOptions) => {
        try {
          const ctx = resolveCommandContext(opts);
          const result = await ctx.api.post<PluginRecord>(
            `/api/plugins/${encodeURIComponent(pluginKey)}/disable`,
          );

          if (ctx.json) {
            printOutput(result, { json: true });
            return;
          }

          console.log(pc.dim(`已禁用 ${pc.bold(pluginKey)} — 状态：${result?.status ?? "unknown"}`));
        } catch (err) {
          handleCommandError(err);
        }
      }),
  );

  // -------------------------------------------------------------------------
  // plugin inspect <plugin-key-or-id>
  // -------------------------------------------------------------------------
  addCommonClientOptions(
    plugin
      .command("inspect <pluginKey>")
      .description("显示已安装插件的完整详情")
      .action(async (pluginKey: string, opts: BaseClientOptions) => {
        try {
          const ctx = resolveCommandContext(opts);
          const result = await ctx.api.get<PluginRecord>(
            `/api/plugins/${encodeURIComponent(pluginKey)}`,
          );

          if (ctx.json) {
            printOutput(result, { json: true });
            return;
          }

          if (!result) {
            console.log(pc.red(`未找到插件：${pluginKey}`));
            process.exit(1);
          }

          console.log(formatPlugin(result));
          if (result.lastError) {
            console.log(`\n${pc.red("最近错误：")}\n${result.lastError}`);
          }
        } catch (err) {
          handleCommandError(err);
        }
      }),
  );

  // -------------------------------------------------------------------------
  // plugin examples
  // -------------------------------------------------------------------------
  addCommonClientOptions(
    plugin
      .command("examples")
      .description("列出可本地安装的内置示例插件")
      .action(async (opts: BaseClientOptions) => {
        try {
          const ctx = resolveCommandContext(opts);
          const examples = await ctx.api.get<
            Array<{
              packageName: string;
              pluginKey: string;
              displayName: string;
              description: string;
              localPath: string;
              tag: string;
            }>
          >("/api/plugins/examples");

          if (ctx.json) {
            printOutput(examples, { json: true });
            return;
          }

          const rows = examples ?? [];
          if (rows.length === 0) {
            console.log(pc.dim("没有可用的内置示例。"));
            return;
          }

          for (const ex of rows) {
            console.log(
              `${pc.bold(ex.displayName)}  ${pc.dim(ex.pluginKey)}\n` +
                `  ${ex.description}\n` +
                `  ${pc.cyan(`paperclipai plugin install ${ex.localPath}`)}`,
            );
          }
        } catch (err) {
          handleCommandError(err);
        }
      }),
  );
}
