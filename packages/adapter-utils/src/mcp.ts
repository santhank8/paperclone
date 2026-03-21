import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

export interface McpServerEntry {
  transport: "stdio" | "http";
  command?: string;
  args?: string[];
  url?: string;
  headers?: Record<string, string>;
  env?: Record<string, string>;
  enabled?: boolean;
}

export type McpServersMap = Record<string, McpServerEntry>;

/**
 * Parse mcpServers from the generic adapter config object.
 * Returns only enabled servers (enabled defaults to true when omitted).
 */
export function parseMcpServers(
  config: Record<string, unknown>,
): McpServersMap | null {
  const raw = config.mcpServers;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const servers = raw as Record<string, unknown>;
  const result: McpServersMap = {};
  let count = 0;
  for (const [name, value] of Object.entries(servers)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const srv = value as McpServerEntry;
    if (srv.enabled === false) continue;
    result[name] = srv;
    count++;
  }
  return count > 0 ? result : null;
}

/**
 * Expand `${VAR_NAME}` references in MCP server env values
 * against the runtime environment.
 */
export function expandMcpEnv(
  servers: McpServersMap,
  runtimeEnv: Record<string, string | undefined>,
): McpServersMap {
  const result: McpServersMap = {};
  for (const [name, srv] of Object.entries(servers)) {
    if (!srv.env) {
      result[name] = srv;
      continue;
    }
    const expandedEnv: Record<string, string> = {};
    for (const [key, val] of Object.entries(srv.env)) {
      expandedEnv[key] = val.replace(/\$\{([^}]+)\}/g, (_, varName: string) => {
        return runtimeEnv[varName] ?? "";
      });
    }
    result[name] = { ...srv, env: expandedEnv };
  }
  return result;
}

// ---- Format converters ----

/** Claude Code .mcp.json format */
export function toClaudeMcpJson(servers: McpServersMap): string {
  const mcpServers: Record<string, unknown> = {};
  for (const [name, srv] of Object.entries(servers)) {
    if (srv.transport === "stdio") {
      mcpServers[name] = {
        type: "stdio",
        command: srv.command ?? "",
        args: srv.args ?? [],
        ...(srv.env && Object.keys(srv.env).length > 0 ? { env: srv.env } : {}),
      };
    } else {
      mcpServers[name] = {
        type: "http",
        url: srv.url ?? "",
        ...(srv.headers && Object.keys(srv.headers).length > 0
          ? { headers: srv.headers }
          : {}),
        ...(srv.env && Object.keys(srv.env).length > 0 ? { env: srv.env } : {}),
      };
    }
  }
  return JSON.stringify({ mcpServers }, null, 2);
}

/** OpenCode opencode.json mcp section format */
export function toOpenCodeMcpJson(servers: McpServersMap): string {
  const mcp: Record<string, unknown> = {};
  for (const [name, srv] of Object.entries(servers)) {
    if (srv.transport === "stdio") {
      mcp[name] = {
        type: "local",
        enabled: true,
        command: [srv.command ?? "", ...(srv.args ?? [])],
        ...(srv.env && Object.keys(srv.env).length > 0 ? { env: srv.env } : {}),
      };
    } else {
      mcp[name] = {
        type: "remote",
        enabled: true,
        url: srv.url ?? "",
        ...(srv.headers && Object.keys(srv.headers).length > 0
          ? { headers: srv.headers }
          : {}),
        ...(srv.env && Object.keys(srv.env).length > 0 ? { env: srv.env } : {}),
      };
    }
  }
  return JSON.stringify({ mcp }, null, 2);
}

/** Codex config.toml [mcp_servers.*] format */
export function toCodexToml(servers: McpServersMap): string {
  const lines: string[] = [];
  for (const [name, srv] of Object.entries(servers)) {
    lines.push(`[mcp_servers.${name}]`);
    lines.push(`type = "${srv.transport}"`);
    if (srv.transport === "stdio") {
      lines.push(`command = "${srv.command ?? ""}"`);
      if (srv.args && srv.args.length > 0) {
        const argsStr = srv.args.map((a) => `"${a}"`).join(", ");
        lines.push(`args = [${argsStr}]`);
      }
    } else {
      lines.push(`url = "${srv.url ?? ""}"`);
    }
    if (srv.env && Object.keys(srv.env).length > 0) {
      const envParts = Object.entries(srv.env)
        .map(([k, v]) => `${k} = "${v}"`)
        .join(", ");
      lines.push(`env = { ${envParts} }`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

// ---- Temp file helpers ----

/**
 * Write MCP config to a temp file inside an existing directory.
 * Returns the file path. Caller is responsible for cleanup.
 */
export async function writeMcpConfigFile(
  dir: string,
  filename: string,
  content: string,
): Promise<string> {
  const filePath = path.join(dir, filename);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf-8");
  return filePath;
}

/**
 * Write MCP config to a new temp directory.
 * Returns the file path. Caller is responsible for cleanup of parent dir.
 */
export async function writeMcpTempFile(
  prefix: string,
  filename: string,
  content: string,
): Promise<{ dir: string; filePath: string }> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  const filePath = path.join(dir, filename);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf-8");
  return { dir, filePath };
}
