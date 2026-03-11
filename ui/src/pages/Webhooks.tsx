import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { webhooksApi } from "../api/webhooks";
import { projectsApi } from "../api/projects";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Plus,
  Pencil,
  Trash2,
  Webhook,
  Copy,
  RefreshCw,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import type {
  WebhookConfig,
  WebhookActionRule,
  WebhookEvent,
  CreateWebhookActionRule,
} from "@paperclipai/shared";

const inputClass =
  "w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-foreground/30 transition-colors";

const selectClass =
  "w-full rounded-md border border-border bg-background text-foreground px-2.5 py-1.5 text-sm outline-none focus:border-foreground/30 transition-colors appearance-none bg-[length:16px_16px] bg-[right_8px_center] bg-no-repeat cursor-pointer [background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")] pr-8";

// ─── Create / Edit Config Dialog ──────────────────────────────────
function WebhookConfigDialog({
  open,
  onOpenChange,
  companyId,
  editConfig,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  editConfig: WebhookConfig | null;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [provider, setProvider] = useState("github");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [secret, setSecret] = useState("");

  const { data: projects } = useQuery({
    queryKey: queryKeys.projects.list(companyId),
    queryFn: () => projectsApi.list(companyId),
    enabled: open,
  });

  useEffect(() => {
    if (editConfig) {
      setName(editConfig.name);
      setProvider(editConfig.provider);
      setProjectId(editConfig.projectId);
      setSecret("");
    } else {
      setName("");
      setProvider("github");
      setProjectId(null);
      setSecret("");
    }
  }, [editConfig, open]);

  const createMutation = useMutation({
    mutationFn: (data: { name: string; provider: string; secret?: string }) =>
      webhooksApi.create(companyId, data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.webhooks.list(companyId) });
      onOpenChange(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { name?: string; provider?: string; secret?: string }) =>
      webhooksApi.update(editConfig!.id, data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.webhooks.list(companyId) });
      onOpenChange(false);
    },
  });

  const isLoading = createMutation.isPending || updateMutation.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name,
      provider,
      projectId: projectId || null,
      ...(secret ? { secret } : {}),
    };
    if (editConfig) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
          <h2 className="text-base font-semibold">
            {editConfig ? "Edit Webhook" : "New Webhook"}
          </h2>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Name</label>
            <input
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. GitHub CI"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Provider</label>
            <select
              className={selectClass}
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              <option value="github">GitHub</option>
              <option value="gitlab">GitLab</option>
              <option value="generic">Generic</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Project (scope)</label>
            <select
              className={selectClass}
              value={projectId ?? ""}
              onChange={(e) => setProjectId(e.target.value || null)}
            >
              <option value="">All projects (company-wide)</option>
              {projects?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <span className="text-[11px] text-muted-foreground">
              When set, only issues in this project will be matched
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Secret (HMAC verification)
            </label>
            <input
              className={inputClass}
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder={editConfig ? "Leave blank to keep current" : "Optional"}
            />
          </div>
          {(createMutation.error || updateMutation.error) && (
            <p className="text-xs text-destructive">
              {(createMutation.error ?? updateMutation.error) instanceof Error
                ? (createMutation.error ?? updateMutation.error)!.message
                : "Failed"}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isLoading || !name}>
              {isLoading ? "Saving..." : editConfig ? "Save" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete Confirm Dialog ────────────────────────────────────────
function DeleteConfirmDialog({
  open,
  onOpenChange,
  config,
  companyId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: WebhookConfig | null;
  companyId: string;
}) {
  const queryClient = useQueryClient();
  const deleteMutation = useMutation({
    mutationFn: () => webhooksApi.remove(config!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.webhooks.list(companyId) });
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0">
        <div className="flex flex-col gap-4 p-6">
          <h2 className="text-base font-semibold">Delete Webhook</h2>
          <p className="text-sm text-muted-foreground">
            Delete <strong>{config?.name}</strong>? This will also delete all associated rules.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Rule Dialog ──────────────────────────────────────────────
function AddRuleDialog({
  open,
  onOpenChange,
  webhookId,
  companyId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  webhookId: string;
  companyId: string;
}) {
  const queryClient = useQueryClient();
  const [eventType, setEventType] = useState("check_run.completed.failure");
  const [action, setAction] = useState("move_issue_to_status");
  const [targetStatus, setTargetStatus] = useState("todo");
  const [comment, setComment] = useState("");
  const [agentId, setAgentId] = useState("");

  const createMutation = useMutation({
    mutationFn: (data: CreateWebhookActionRule) =>
      webhooksApi.createRule(webhookId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.webhooks.rules(webhookId) });
      onOpenChange(false);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params: Record<string, unknown> = {};
    if (action === "move_issue_to_status") params.target_status = targetStatus;
    if (action === "add_issue_comment") params.comment = comment;
    if (action === "wake_agent") params.agent_id = agentId;

    createMutation.mutate({ eventType, action: action as any, actionParams: params, enabled: true });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
          <h2 className="text-base font-semibold">Add Action Rule</h2>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Event Type</label>
            <input
              className={inputClass}
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              placeholder="e.g. check_run.completed.failure"
              required
            />
            <span className="text-[11px] text-muted-foreground">
              Use * for all events, or event.* for wildcards
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Action</label>
            <select
              className={selectClass}
              value={action}
              onChange={(e) => setAction(e.target.value)}
            >
              <option value="move_issue_to_status">Move issue to status</option>
              <option value="add_issue_comment">Add issue comment</option>
              <option value="wake_agent">Wake agent</option>
            </select>
          </div>
          {action === "move_issue_to_status" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Target Status</label>
              <select
                className={selectClass}
                value={targetStatus}
                onChange={(e) => setTargetStatus(e.target.value)}
              >
                <option value="backlog">Backlog</option>
                <option value="todo">Todo</option>
                <option value="in_progress">In Progress</option>
                <option value="in_review">In Review</option>
                <option value="done">Done</option>
                <option value="blocked">Blocked</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          )}
          {action === "add_issue_comment" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Comment</label>
              <input
                className={inputClass}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="CI pipeline failed"
              />
            </div>
          )}
          {action === "wake_agent" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Agent ID</label>
              <input
                className={inputClass}
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                placeholder="UUID of the agent to wake"
              />
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={createMutation.isPending || !eventType}>
              {createMutation.isPending ? "Adding..." : "Add Rule"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Rules Panel ──────────────────────────────────────────────────
function RulesPanel({ webhookId, companyId }: { webhookId: string; companyId: string }) {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: queryKeys.webhooks.rules(webhookId),
    queryFn: () => webhooksApi.listRules(webhookId),
  });

  const removeMutation = useMutation({
    mutationFn: (ruleId: string) => webhooksApi.removeRule(ruleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.webhooks.rules(webhookId) });
    },
  });

  if (isLoading) return <div className="text-xs text-muted-foreground py-2">Loading rules...</div>;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Action Rules</span>
        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setAddOpen(true)}>
          <Plus className="h-3 w-3 mr-1" /> Add
        </Button>
      </div>
      {rules.length === 0 ? (
        <p className="text-xs text-muted-foreground">No rules configured.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {rules.map((rule: WebhookActionRule) => (
            <div
              key={rule.id}
              className="flex items-center justify-between rounded-md border border-border px-2.5 py-1.5 text-xs"
            >
              <div className="flex items-center gap-2">
                <code className="text-[11px] bg-muted px-1 py-0.5 rounded">
                  {rule.eventType}
                </code>
                <span className="text-muted-foreground">→</span>
                <Badge variant="secondary" className="text-[11px]">
                  {rule.action.replace(/_/g, " ")}
                </Badge>
                {rule.actionParams &&
                  Object.keys(rule.actionParams).length > 0 && (
                    <span className="text-muted-foreground text-[10px]">
                      ({Object.entries(rule.actionParams)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(", ")})
                    </span>
                  )}
              </div>
              <button
                className="text-muted-foreground hover:text-destructive transition-colors"
                onClick={() => removeMutation.mutate(rule.id)}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <AddRuleDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        webhookId={webhookId}
        companyId={companyId}
      />
    </div>
  );
}

// ─── Event Log Table ──────────────────────────────────────────────
function EventLogTable({ companyId }: { companyId: string }) {
  const { data: events = [], isLoading } = useQuery({
    queryKey: queryKeys.webhooks.events(companyId),
    queryFn: () => webhooksApi.listEvents(companyId),
    refetchInterval: 15_000,
  });

  if (isLoading) return <div className="text-xs text-muted-foreground py-4">Loading events...</div>;
  if (events.length === 0)
    return <p className="text-xs text-muted-foreground py-4">No webhook events received yet.</p>;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Time</th>
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Event Type</th>
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Status</th>
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Issues</th>
            <th className="text-right px-3 py-2 font-medium text-muted-foreground">ms</th>
          </tr>
        </thead>
        <tbody>
          {events.slice(0, 50).map((event: WebhookEvent) => (
            <tr key={event.id} className="border-b border-border last:border-b-0">
              <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">
                {new Date(event.createdAt).toLocaleString()}
              </td>
              <td className="px-3 py-1.5">
                <code className="text-[11px] bg-muted px-1 py-0.5 rounded">
                  {event.eventType}
                </code>
              </td>
              <td className="px-3 py-1.5">
                <Badge
                  variant={
                    event.status === "processed"
                      ? "default"
                      : event.status === "failed"
                        ? "destructive"
                        : "secondary"
                  }
                  className="text-[10px]"
                >
                  {event.status}
                </Badge>
              </td>
              <td className="px-3 py-1.5 text-muted-foreground">
                {event.matchedIssues?.length ?? 0}
              </td>
              <td className="px-3 py-1.5 text-right text-muted-foreground">
                {event.processingMs ?? "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Config Row (expandable) ──────────────────────────────────────
function WebhookConfigRow({
  config,
  companyId,
  projectName,
  onEdit,
  onDelete,
}: {
  config: WebhookConfig;
  companyId: string;
  projectName: string | null;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const toggleMutation = useMutation({
    mutationFn: () => webhooksApi.update(config.id, { enabled: !config.enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.webhooks.list(companyId) });
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: () => webhooksApi.regenerateToken(config.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.webhooks.list(companyId) });
    },
  });

  const webhookUrl = `${window.location.origin}/api/webhooks/incoming/${config.token}`;

  function copyUrl() {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="border border-border rounded-lg">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-accent/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{config.name}</span>
            <Badge variant="outline" className="text-[10px]">
              {config.provider}
            </Badge>
            {projectName && (
              <Badge variant="outline" className="text-[10px]">
                {projectName}
              </Badge>
            )}
            <Badge
              variant={config.enabled ? "default" : "secondary"}
              className="text-[10px]"
            >
              {config.enabled ? "enabled" : "disabled"}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => toggleMutation.mutate()}
            title={config.enabled ? "Disable" : "Enable"}
          >
            <span className="text-[10px]">{config.enabled ? "OFF" : "ON"}</span>
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border px-4 py-3 flex flex-col gap-4">
          {/* Webhook URL */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Webhook URL</span>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[11px] bg-muted px-2.5 py-1.5 rounded-md overflow-x-auto whitespace-nowrap">
                {webhookUrl}
              </code>
              <Button variant="ghost" size="icon-sm" onClick={copyUrl} title="Copy URL">
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => regenerateMutation.mutate()}
                title="Regenerate token"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
            {copied && (
              <span className="text-[10px] text-green-600">Copied to clipboard!</span>
            )}
          </div>

          {/* Rules */}
          <RulesPanel webhookId={config.id} companyId={companyId} />
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────
export function Webhooks() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editConfig, setEditConfig] = useState<WebhookConfig | null>(null);
  const [deleteConfig, setDeleteConfig] = useState<WebhookConfig | null>(null);

  useEffect(() => {
    setBreadcrumbs([{ label: "Webhooks" }]);
  }, [setBreadcrumbs]);

  const { data: configs, isLoading } = useQuery({
    queryKey: queryKeys.webhooks.list(selectedCompanyId!),
    queryFn: () => webhooksApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: projects } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const projectMap = new Map(projects?.map((p) => [p.id, p.name]) ?? []);

  if (!selectedCompanyId) return <EmptyState icon={Webhook} message="Select a company." />;
  if (isLoading) return <PageSkeleton variant="list" />;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Webhooks</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Receive events from external services like GitHub to automate issue workflows.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditConfig(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1" /> New Webhook
        </Button>
      </div>

      {/* Config list */}
      {!configs || configs.length === 0 ? (
        <EmptyState
          icon={Webhook}
          message="No webhooks configured. Create one to start receiving events from external services."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {configs.map((config: WebhookConfig) => (
            <WebhookConfigRow
              key={config.id}
              config={config}
              companyId={selectedCompanyId}
              projectName={config.projectId ? projectMap.get(config.projectId) ?? null : null}
              onEdit={() => {
                setEditConfig(config);
                setDialogOpen(true);
              }}
              onDelete={() => setDeleteConfig(config)}
            />
          ))}
        </div>
      )}

      {/* Event log */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Event Log</h2>
        <EventLogTable companyId={selectedCompanyId} />
      </div>

      {/* Dialogs */}
      <WebhookConfigDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        companyId={selectedCompanyId}
        editConfig={editConfig}
      />
      <DeleteConfirmDialog
        open={!!deleteConfig}
        onOpenChange={(open) => !open && setDeleteConfig(null)}
        config={deleteConfig}
        companyId={selectedCompanyId}
      />
    </div>
  );
}
