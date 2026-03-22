import { Command } from "commander";
import pc from "picocolors";
import {
  readContext,
  resolveContextPath,
  resolveProfile,
  setCurrentProfile,
  upsertProfile,
} from "../../client/context.js";
import { printOutput } from "./common.js";

interface ContextOptions {
  dataDir?: string;
  context?: string;
  profile?: string;
  json?: boolean;
}

interface ContextSetOptions extends ContextOptions {
  apiBase?: string;
  companyId?: string;
  apiKeyEnvVarName?: string;
  use?: boolean;
}

export function registerContextCommands(program: Command): void {
  const context = program.command("context").description("管理 CLI 客户端上下文配置");

  context
    .command("show")
    .description("显示当前上下文和活动配置")
    .option("-d, --data-dir <path>", "Paperclip data directory root (isolates state from ~/.paperclip)")
    .option("--context <path>", "Path to CLI context file")
    .option("--profile <name>", "Profile to inspect")
    .option("--json", "Output raw JSON")
    .action((opts: ContextOptions) => {
      const contextPath = resolveContextPath(opts.context);
      const store = readContext(opts.context);
      const resolved = resolveProfile(store, opts.profile);
      const payload = {
        contextPath,
        currentProfile: store.currentProfile,
        profileName: resolved.name,
        profile: resolved.profile,
        profiles: store.profiles,
      };
      printOutput(payload, { json: opts.json });
    });

  context
    .command("list")
    .description("列出可用的上下文配置")
    .option("-d, --data-dir <path>", "Paperclip data directory root (isolates state from ~/.paperclip)")
    .option("--context <path>", "Path to CLI context file")
    .option("--json", "Output raw JSON")
    .action((opts: ContextOptions) => {
      const store = readContext(opts.context);
      const rows = Object.entries(store.profiles).map(([name, profile]) => ({
        name,
        current: name === store.currentProfile,
        apiBase: profile.apiBase ?? null,
        companyId: profile.companyId ?? null,
        apiKeyEnvVarName: profile.apiKeyEnvVarName ?? null,
      }));
      printOutput(rows, { json: opts.json });
    });

  context
    .command("use")
    .description("设置活动上下文配置")
    .argument("<profile>", "Profile name")
    .option("-d, --data-dir <path>", "Paperclip data directory root (isolates state from ~/.paperclip)")
    .option("--context <path>", "Path to CLI context file")
    .action((profile: string, opts: ContextOptions) => {
      setCurrentProfile(profile, opts.context);
      console.log(pc.green(`活动配置已设置为 '${profile}'。`));
    });

  context
    .command("set")
    .description("设置配置的值")
    .option("-d, --data-dir <path>", "Paperclip data directory root (isolates state from ~/.paperclip)")
    .option("--context <path>", "Path to CLI context file")
    .option("--profile <name>", "Profile name (default: current profile)")
    .option("--api-base <url>", "Default API base URL")
    .option("--company-id <id>", "Default company ID")
    .option("--api-key-env-var-name <name>", "Env var containing API key (recommended)")
    .option("--use", "Set this profile as active")
    .option("--json", "Output raw JSON")
    .action((opts: ContextSetOptions) => {
      const existing = readContext(opts.context);
      const targetProfile = opts.profile?.trim() || existing.currentProfile || "default";

      upsertProfile(
        targetProfile,
        {
          apiBase: opts.apiBase,
          companyId: opts.companyId,
          apiKeyEnvVarName: opts.apiKeyEnvVarName,
        },
        opts.context,
      );

      if (opts.use) {
        setCurrentProfile(targetProfile, opts.context);
      }

      const updated = readContext(opts.context);
      const resolved = resolveProfile(updated, targetProfile);
      const payload = {
        contextPath: resolveContextPath(opts.context),
        currentProfile: updated.currentProfile,
        profileName: resolved.name,
        profile: resolved.profile,
      };

      if (!opts.json) {
        console.log(pc.green(`已更新配置 '${targetProfile}'。`));
        if (opts.use) {
          console.log(pc.green(`已将 '${targetProfile}' 设置为活动配置。`));
        }
      }
      printOutput(payload, { json: opts.json });
    });
}
