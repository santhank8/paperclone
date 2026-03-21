import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Server, ToggleLeft, ToggleRight, Pencil, X, Check, Zap } from "lucide-react";
import { cn } from "../lib/utils";

interface McpServerEntry {
  transport: "stdio" | "http";
  command?: string;
  args?: string[];
  url?: string;
  headers?: Record<string, string>;
  env?: Record<string, string>;
  enabled?: boolean;
}

type McpServersMap = Record<string, McpServerEntry>;

interface McpServersSectionProps {
  mode: "create" | "edit";
  servers: McpServersMap;
  onChange: (servers: McpServersMap) => void;
}

const SECRET_PATTERNS = /_KEY$|_SECRET$|_TOKEN$|_PASSWORD$/i;

function maskValue(key: string, value: string): string {
  if (SECRET_PATTERNS.test(key) && value.length > 8) {
    return value.slice(0, 4) + "••••" + value.slice(-4);
  }
  return value;
}

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";

const AGENTMAIL_PRESET: McpServerEntry = {
  transport: "stdio",
  command: "npx",
  args: ["-y", "agentmail-mcp"],
  env: { AGENTMAIL_API_KEY: "" },
  enabled: true,
};

function ServerForm({
  name: initialName,
  server: initial,
  onSave,
  onCancel,
  isNew,
}: {
  name: string;
  server: McpServerEntry;
  onSave: (name: string, server: McpServerEntry) => void;
  onCancel: () => void;
  isNew: boolean;
}) {
  const [name, setName] = useState(initialName);
  const [transport, setTransport] = useState<"stdio" | "http">(initial.transport);
  const [command, setCommand] = useState(initial.command ?? "");
  const [argsStr, setArgsStr] = useState((initial.args ?? []).join(", "));
  const [url, setUrl] = useState(initial.url ?? "");
  const [headersStr, setHeadersStr] = useState(
    Object.entries(initial.headers ?? {}).map(([k, v]) => `${k}: ${v}`).join("\n"),
  );
  const [envPairs, setEnvPairs] = useState<[string, string][]>(
    Object.entries(initial.env ?? {}),
  );
  const [enabled, setEnabled] = useState(initial.enabled !== false);

  const handleAddEnv = useCallback(() => {
    setEnvPairs((prev) => [...prev, ["", ""]]);
  }, []);

  const handleRemoveEnv = useCallback((idx: number) => {
    setEnvPairs((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleEnvChange = useCallback((idx: number, field: 0 | 1, value: string) => {
    setEnvPairs((prev) => {
      const next = [...prev];
      next[idx] = [...next[idx]] as [string, string];
      next[idx][field] = value;
      return next;
    });
  }, []);

  const handleSave = useCallback(() => {
    if (!name.trim()) return;
    const args = argsStr.split(",").map((s) => s.trim()).filter(Boolean);
    const headers: Record<string, string> = {};
    for (const line of headersStr.split("\n")) {
      const idx = line.indexOf(":");
      if (idx > 0) {
        headers[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
      }
    }
    const env: Record<string, string> = {};
    for (const [k, v] of envPairs) {
      if (k.trim()) env[k.trim()] = v;
    }
    const entry: McpServerEntry = {
      transport,
      enabled,
      ...(transport === "stdio" ? { command, args } : { url }),
      ...(transport === "http" && Object.keys(headers).length > 0 ? { headers } : {}),
      ...(Object.keys(env).length > 0 ? { env } : {}),
    };
    onSave(name.trim(), entry);
  }, [name, transport, command, argsStr, url, headersStr, envPairs, enabled, onSave]);

  return (
    <div className="rounded-md border border-border bg-muted/30 p-3 space-y-3">
      <div>
        <label className="text-xs text-muted-foreground">Server name</label>
        <input
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. AgentMail"
          disabled={!isNew}
        />
      </div>

      <div>
        <label className="text-xs text-muted-foreground">Transport</label>
        <div className="flex gap-2 mt-1">
          <button
            className={cn(
              "px-3 py-1 rounded-md border text-xs font-medium transition-colors",
              transport === "stdio"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setTransport("stdio")}
          >
            stdio
          </button>
          <button
            className={cn(
              "px-3 py-1 rounded-md border text-xs font-medium transition-colors",
              transport === "http"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setTransport("http")}
          >
            http
          </button>
        </div>
      </div>

      {transport === "stdio" ? (
        <>
          <div>
            <label className="text-xs text-muted-foreground">Command</label>
            <input
              className={inputClass}
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="e.g. npx"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Arguments (comma-separated)</label>
            <input
              className={inputClass}
              value={argsStr}
              onChange={(e) => setArgsStr(e.target.value)}
              placeholder="e.g. -y, agentmail-mcp"
            />
          </div>
        </>
      ) : (
        <>
          <div>
            <label className="text-xs text-muted-foreground">URL</label>
            <input
              className={inputClass}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://mcp.example.com"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Headers (one per line, Key: Value)</label>
            <textarea
              className={cn(inputClass, "h-16 resize-none")}
              value={headersStr}
              onChange={(e) => setHeadersStr(e.target.value)}
              placeholder={"Authorization: Bearer ..."}
            />
          </div>
        </>
      )}

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-muted-foreground">Environment variables</label>
          <button
            className="text-xs text-primary hover:underline"
            onClick={handleAddEnv}
          >
            + Add
          </button>
        </div>
        <div className="space-y-1.5">
          {envPairs.map(([k, v], idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <input
                className={cn(inputClass, "w-1/3")}
                value={k}
                onChange={(e) => handleEnvChange(idx, 0, e.target.value)}
                placeholder="KEY"
              />
              <input
                className={cn(inputClass, "flex-1")}
                value={v}
                onChange={(e) => handleEnvChange(idx, 1, e.target.value)}
                placeholder="value or ${SECRET_NAME}"
                type={SECRET_PATTERNS.test(k) ? "password" : "text"}
              />
              <button
                className="text-muted-foreground/60 hover:text-destructive transition-colors"
                onClick={() => handleRemoveEnv(idx)}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <button onClick={() => setEnabled(!enabled)}>
            {enabled
              ? <ToggleRight className="h-4 w-4 text-green-600" />
              : <ToggleLeft className="h-4 w-4" />}
          </button>
          {enabled ? "Enabled" : "Disabled"}
        </label>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          className="h-7 text-xs"
          onClick={handleSave}
          disabled={!name.trim()}
        >
          <Check className="h-3 w-3 mr-1" />
          {isNew ? "Add" : "Update"}
        </Button>
      </div>
    </div>
  );
}

export function McpServersSection({ mode, servers, onChange }: McpServersSectionProps) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [presetServer, setPresetServer] = useState<McpServerEntry | null>(null);
  const [presetName, setPresetName] = useState("");

  const handleAdd = useCallback(
    (name: string, server: McpServerEntry) => {
      onChange({ ...servers, [name]: server });
      setAdding(false);
      setPresetServer(null);
      setPresetName("");
    },
    [servers, onChange],
  );

  const handleUpdate = useCallback(
    (name: string, server: McpServerEntry) => {
      const next = { ...servers };
      if (editing && editing !== name) {
        delete next[editing];
      }
      next[name] = server;
      onChange(next);
      setEditing(null);
    },
    [servers, onChange, editing],
  );

  const handleRemove = useCallback(
    (name: string) => {
      const next = { ...servers };
      delete next[name];
      onChange(next);
    },
    [servers, onChange],
  );

  const handleToggle = useCallback(
    (name: string) => {
      const srv = servers[name];
      if (!srv) return;
      onChange({
        ...servers,
        [name]: { ...srv, enabled: srv.enabled === false ? true : false },
      });
    },
    [servers, onChange],
  );

  const handleAgentMailConnect = useCallback(() => {
    if ("AgentMail" in servers) {
      setEditing("AgentMail");
    } else {
      setPresetName("AgentMail");
      setPresetServer({ ...AGENTMAIL_PRESET });
      setAdding(true);
    }
  }, [servers]);

  const entries = Object.entries(servers);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Server className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">MCP Servers</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-2 text-[11px]"
            onClick={handleAgentMailConnect}
            disabled={adding}
          >
            <Zap className="h-3 w-3 mr-1" />
            AgentMail
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-2 text-[11px]"
            onClick={() => {
              setPresetServer(null);
              setPresetName("");
              setAdding(true);
            }}
            disabled={adding}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add
          </Button>
        </div>
      </div>

      {entries.length === 0 && !adding && (
        <div className="text-xs text-muted-foreground/60 italic">
          No MCP servers configured
        </div>
      )}

      {entries.map(([name, srv]) =>
        editing === name ? (
          <ServerForm
            key={name}
            name={name}
            server={srv}
            onSave={handleUpdate}
            onCancel={() => setEditing(null)}
            isNew={false}
          />
        ) : (
          <div
            key={name}
            className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs"
          >
            <button
              className="shrink-0"
              onClick={() => handleToggle(name)}
              title={srv.enabled !== false ? "Disable" : "Enable"}
            >
              {srv.enabled !== false
                ? <ToggleRight className="h-4 w-4 text-green-600" />
                : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
            </button>
            <div className="min-w-0 flex-1">
              <span className={cn("font-medium", srv.enabled === false && "text-muted-foreground line-through")}>
                {name}
              </span>
              <span className="ml-2 text-muted-foreground/60">
                {srv.transport === "stdio"
                  ? `${srv.command ?? ""} ${(srv.args ?? []).join(" ")}`.trim()
                  : srv.url ?? ""}
              </span>
              {srv.env && Object.keys(srv.env).length > 0 && (
                <span className="ml-2 text-muted-foreground/40">
                  ({Object.entries(srv.env).map(([k, v]) => `${k}=${maskValue(k, v)}`).join(", ")})
                </span>
              )}
            </div>
            <button
              className="text-muted-foreground/60 hover:text-foreground transition-colors"
              onClick={() => setEditing(name)}
              title="Edit"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              className="text-muted-foreground/60 hover:text-destructive transition-colors"
              onClick={() => handleRemove(name)}
              title="Remove"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ),
      )}

      {adding && (
        <ServerForm
          name={presetName}
          server={presetServer ?? { transport: "stdio", enabled: true }}
          onSave={handleAdd}
          onCancel={() => {
            setAdding(false);
            setPresetServer(null);
            setPresetName("");
          }}
          isNew
        />
      )}
    </div>
  );
}
