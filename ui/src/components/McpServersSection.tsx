import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Server, ToggleLeft, ToggleRight, Pencil, X, Check, Zap, Loader2, FileText, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";
import { api } from "../api/client";
import { queryKeys } from "../lib/queryKeys";

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
  agentId: string;
  adapterType: string;
  companyId: string;
}

interface McpServersResponse {
  servers: McpServersMap;
  adapterType: string;
  filePath: string | null;
}

interface McpInstructionsResponse {
  content: string;
  serverName: string;
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

const AGENTMAIL_DEFAULT_INSTRUCTIONS = `# AgentMail

## Handling inbound email

When you are woken by an email event (\`PAPERCLIP_EVENT_TYPE\` = \`message.received\`):

1. **Read the payload** -- Parse \`PAPERCLIP_EVENT_PAYLOAD\` (JSON string) to get \`message.from\`, \`message.subject\`, \`message.text\`, \`message.thread_id\`, and \`thread.message_count\`.

2. **Thread awareness** -- If \`thread.message_count\` is greater than 1, this is a reply in an existing conversation. Use \`get_thread\` (AgentMail MCP) to load the full thread history before responding so you have context on what was said previously.

3. **Reply before closing** -- If the email expects a response (a question, a request, an introduction, anything conversational), reply via \`reply_to_message\` using the \`thread_id\` **before** closing the Paperclip issue. Never close an issue that was triggered by an email without replying when a reply is clearly expected.

4. **Close the loop on both sides**:
   - Reply to the email (if a response is needed)
   - Post a comment on the Paperclip issue summarising what you did (e.g. "Replied to {sender} re: {subject}")
   - Then close the issue

5. **No-reply emails** -- Not every email needs a reply (newsletters, notifications, automated alerts). If the email is informational and no response is expected, note this in the issue comment and close.
`;

function InstructionsEditor({
  agentId,
  companyId,
  serverName,
}: {
  agentId: string;
  companyId: string;
  serverName: string;
}) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.mcpInstructions(agentId, serverName),
    queryFn: () =>
      api.get<McpInstructionsResponse>(
        `/agents/${agentId}/mcp-servers/${encodeURIComponent(serverName)}/instructions?companyId=${companyId}`,
      ),
  });

  const [draft, setDraft] = useState<string | null>(null);
  const content = data?.content ?? "";

  useEffect(() => {
    setDraft(null);
  }, [content]);

  const saveMutation = useMutation({
    mutationFn: (nextContent: string) =>
      api.put<McpInstructionsResponse>(
        `/agents/${agentId}/mcp-servers/${encodeURIComponent(serverName)}/instructions?companyId=${companyId}`,
        { content: nextContent },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mcpInstructions(agentId, serverName) });
      setDraft(null);
    },
  });

  const currentValue = draft ?? content;
  const isDirty = draft !== null && draft !== content;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground/60 py-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading instructions...
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <textarea
        className={cn(inputClass, "h-40 resize-y text-xs leading-relaxed")}
        value={currentValue}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Add custom instructions for how this agent should use this MCP server..."
      />
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className="h-6 px-2 text-[11px]"
          onClick={() => saveMutation.mutate(currentValue)}
          disabled={!isDirty || saveMutation.isPending}
        >
          {saveMutation.isPending
            ? <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            : <Check className="h-3 w-3 mr-1" />}
          Save
        </Button>
        {isDirty && (
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2 text-[11px]"
            onClick={() => setDraft(null)}
            disabled={saveMutation.isPending}
          >
            Discard
          </Button>
        )}
        {!content && serverName === "AgentMail" && (
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2 text-[11px]"
            onClick={() => setDraft(AGENTMAIL_DEFAULT_INSTRUCTIONS)}
            disabled={saveMutation.isPending}
          >
            <Zap className="h-3 w-3 mr-1" />
            Load template
          </Button>
        )}
        <span className="text-[10px] text-muted-foreground/40 ml-auto">
          .agents/mcp-instructions/{serverName}.md
        </span>
      </div>
    </div>
  );
}

function ServerForm({
  name: initialName,
  server: initial,
  onSave,
  onCancel,
  isNew,
  saving,
}: {
  name: string;
  server: McpServerEntry;
  onSave: (name: string, server: McpServerEntry) => void;
  onCancel: () => void;
  isNew: boolean;
  saving?: boolean;
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
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button
          size="sm"
          className="h-7 text-xs"
          onClick={handleSave}
          disabled={!name.trim() || saving}
        >
          {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
          {isNew ? "Add" : "Update"}
        </Button>
      </div>
    </div>
  );
}

export function McpServersSection({ agentId, adapterType, companyId }: McpServersSectionProps) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [presetServer, setPresetServer] = useState<McpServerEntry | null>(null);
  const [presetName, setPresetName] = useState("");
  const [expandedInstructions, setExpandedInstructions] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.mcpServers(agentId),
    queryFn: () =>
      api.get<McpServersResponse>(`/agents/${agentId}/mcp-servers?companyId=${companyId}`),
    enabled: !!agentId,
  });

  const servers = data?.servers ?? {};

  const saveMutation = useMutation({
    mutationFn: (nextServers: McpServersMap) =>
      api.put<{ servers: McpServersMap; filePath: string }>(
        `/agents/${agentId}/mcp-servers?companyId=${companyId}`,
        { servers: nextServers },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mcpServers(agentId) });
    },
  });

  const writeInstructionsMutation = useMutation({
    mutationFn: ({ serverName, content }: { serverName: string; content: string }) =>
      api.put<McpInstructionsResponse>(
        `/agents/${agentId}/mcp-servers/${encodeURIComponent(serverName)}/instructions?companyId=${companyId}`,
        { content },
      ),
  });

  const handleAdd = useCallback(
    (name: string, server: McpServerEntry) => {
      const next = { ...servers, [name]: server };
      saveMutation.mutate(next, {
        onSuccess: () => {
          if (name === "AgentMail") {
            writeInstructionsMutation.mutate({
              serverName: "AgentMail",
              content: AGENTMAIL_DEFAULT_INSTRUCTIONS,
            });
          }
          setAdding(false);
          setPresetServer(null);
          setPresetName("");
        },
      });
    },
    [servers, saveMutation, writeInstructionsMutation],
  );

  const handleUpdate = useCallback(
    (name: string, server: McpServerEntry) => {
      const next = { ...servers };
      if (editing && editing !== name) {
        delete next[editing];
      }
      next[name] = server;
      saveMutation.mutate(next, {
        onSuccess: () => setEditing(null),
      });
    },
    [servers, saveMutation, editing],
  );

  const handleRemove = useCallback(
    (name: string) => {
      const next = { ...servers };
      delete next[name];
      saveMutation.mutate(next);
      if (expandedInstructions === name) setExpandedInstructions(null);
    },
    [servers, saveMutation, expandedInstructions],
  );

  const handleToggle = useCallback(
    (name: string) => {
      const srv = servers[name];
      if (!srv) return;
      const next = {
        ...servers,
        [name]: { ...srv, enabled: srv.enabled === false ? true : false },
      };
      saveMutation.mutate(next);
    },
    [servers, saveMutation],
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

  const toggleInstructions = useCallback((name: string) => {
    setExpandedInstructions((prev) => (prev === name ? null : name));
  }, []);

  const entries = Object.entries(servers);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-1.5">
          <Server className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">MCP Servers</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
          <Loader2 className="h-3 w-3 animate-spin" />
          Loading...
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-1.5">
          <Server className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">MCP Servers</span>
        </div>
        <div className="text-xs text-destructive">
          Failed to load MCP configuration from disk.
        </div>
      </div>
    );
  }

  if (!data?.filePath) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Server className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">MCP Servers</span>
          <span className="text-[10px] text-muted-foreground/40 font-mono">{data.filePath}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-2 text-[11px]"
            onClick={handleAgentMailConnect}
            disabled={adding || saveMutation.isPending}
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
            disabled={adding || saveMutation.isPending}
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
            saving={saveMutation.isPending}
          />
        ) : (
          <div key={name} className="rounded-md border border-border">
            <div className="flex items-center gap-2 px-3 py-2 text-xs">
              <button
                className="shrink-0"
                onClick={() => handleToggle(name)}
                title={srv.enabled !== false ? "Disable" : "Enable"}
                disabled={saveMutation.isPending}
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
                onClick={() => toggleInstructions(name)}
                title="Instructions"
              >
                <FileText className={cn("h-3 w-3", expandedInstructions === name && "text-primary")} />
              </button>
              <button
                className="text-muted-foreground/60 hover:text-foreground transition-colors"
                onClick={() => setEditing(name)}
                title="Edit"
                disabled={saveMutation.isPending}
              >
                <Pencil className="h-3 w-3" />
              </button>
              <button
                className="text-muted-foreground/60 hover:text-destructive transition-colors"
                onClick={() => handleRemove(name)}
                title="Remove"
                disabled={saveMutation.isPending}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
            {expandedInstructions === name && (
              <div className="border-t border-border px-3 py-2">
                <InstructionsEditor agentId={agentId} companyId={companyId} serverName={name} />
              </div>
            )}
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
          saving={saveMutation.isPending}
        />
      )}
    </div>
  );
}
