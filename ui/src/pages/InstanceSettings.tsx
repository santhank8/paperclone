import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock3, ExternalLink, Settings } from "lucide-react";
import type { InstanceSchedulerHeartbeatAgent } from "@paperclipai/shared";
import { Link } from "@/lib/router";
import { heartbeatsApi } from "../api/heartbeats";
import { agentsApi } from "../api/agents";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useGeneralSettings } from "../context/GeneralSettingsContext";
import { EmptyState } from "../components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { queryKeys } from "../lib/queryKeys";
import { formatDateTime, relativeTime } from "../lib/utils";
import { textFor } from "../lib/ui-language";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function humanize(value: string) {
  return value.replaceAll("_", " ");
}

function buildAgentHref(agent: InstanceSchedulerHeartbeatAgent) {
  return `/${agent.companyIssuePrefix}/agents/${encodeURIComponent(agent.agentUrlKey)}`;
}

export function InstanceSettings() {
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const { uiLanguage } = useGeneralSettings();

  const copy = {
    instanceSettings: textFor(uiLanguage, {
      en: "Instance Settings",
      "zh-CN": "实例设置",
    }),
    heartbeats: textFor(uiLanguage, {
      en: "Heartbeats",
      "zh-CN": "心跳",
    }),
    title: textFor(uiLanguage, {
      en: "Scheduler Heartbeats",
      "zh-CN": "调度器心跳",
    }),
    description: textFor(uiLanguage, {
      en: "Agents with a timer heartbeat enabled across all of your companies.",
      "zh-CN": "展示你所有公司中启用了定时心跳的 agent。",
    }),
    loading: textFor(uiLanguage, {
      en: "Loading scheduler heartbeats...",
      "zh-CN": "正在加载调度器心跳...",
    }),
    loadError: textFor(uiLanguage, {
      en: "Failed to load scheduler heartbeats.",
      "zh-CN": "加载调度器心跳失败。",
    }),
    updateError: textFor(uiLanguage, {
      en: "Failed to update heartbeat.",
      "zh-CN": "更新心跳失败。",
    }),
    disableAllError: textFor(uiLanguage, {
      en: "Failed to disable all heartbeats.",
      "zh-CN": "批量关闭心跳失败。",
    }),
    active: textFor(uiLanguage, {
      en: "active",
      "zh-CN": "活跃",
    }),
    disabled: textFor(uiLanguage, {
      en: "disabled",
      "zh-CN": "已关闭",
    }),
    company: textFor(uiLanguage, {
      en: "company",
      "zh-CN": "个公司",
    }),
    companies: textFor(uiLanguage, {
      en: "companies",
      "zh-CN": "个公司",
    }),
    disableAll: textFor(uiLanguage, {
      en: "Disable All",
      "zh-CN": "全部关闭",
    }),
    disabling: textFor(uiLanguage, {
      en: "Disabling...",
      "zh-CN": "关闭中...",
    }),
    disableConfirm: (count: number, noun: string) =>
      textFor(uiLanguage, {
        en: `Disable timer heartbeats for all ${count} enabled ${noun}?`,
        "zh-CN": `确认关闭全部 ${count} 个已启用${noun === "agent" ? " agent" : "个 agent"}的定时心跳吗？`,
      }),
    noHeartbeats: textFor(uiLanguage, {
      en: "No scheduler heartbeats match the current criteria.",
      "zh-CN": "当前条件下没有匹配的调度器心跳。",
    }),
    statusOn: textFor(uiLanguage, {
      en: "On",
      "zh-CN": "开",
    }),
    statusOff: textFor(uiLanguage, {
      en: "Off",
      "zh-CN": "关",
    }),
    never: textFor(uiLanguage, {
      en: "never",
      "zh-CN": "从未",
    }),
    fullConfig: textFor(uiLanguage, {
      en: "Full agent config",
      "zh-CN": "完整 agent 配置",
    }),
    disableTimerHeartbeat: textFor(uiLanguage, {
      en: "Disable Timer Heartbeat",
      "zh-CN": "关闭定时心跳",
    }),
    enableTimerHeartbeat: textFor(uiLanguage, {
      en: "Enable Timer Heartbeat",
      "zh-CN": "开启定时心跳",
    }),
  };

  useEffect(() => {
    setBreadcrumbs([
      { label: copy.instanceSettings },
      { label: copy.heartbeats },
    ]);
  }, [copy.heartbeats, copy.instanceSettings, setBreadcrumbs]);

  const heartbeatsQuery = useQuery({
    queryKey: queryKeys.instance.schedulerHeartbeats,
    queryFn: () => heartbeatsApi.listInstanceSchedulerAgents(),
    refetchInterval: 15_000,
  });

  const toggleMutation = useMutation({
    mutationFn: async (agentRow: InstanceSchedulerHeartbeatAgent) => {
      const agent = await agentsApi.get(agentRow.id, agentRow.companyId);
      const runtimeConfig = asRecord(agent.runtimeConfig) ?? {};
      const heartbeat = asRecord(runtimeConfig.heartbeat) ?? {};

      return agentsApi.update(
        agentRow.id,
        {
          runtimeConfig: {
            ...runtimeConfig,
            heartbeat: {
              ...heartbeat,
              enabled: !agentRow.heartbeatEnabled,
            },
          },
        },
        agentRow.companyId,
      );
    },
    onSuccess: async (_, agentRow) => {
      setActionError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.instance.schedulerHeartbeats }),
        queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(agentRow.companyId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.agents.detail(agentRow.id) }),
      ]);
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : copy.updateError);
    },
  });

  const disableAllMutation = useMutation({
    mutationFn: async (agentRows: InstanceSchedulerHeartbeatAgent[]) => {
      const enabled = agentRows.filter((a) => a.heartbeatEnabled);
      if (enabled.length === 0) return enabled;

      const results = await Promise.allSettled(
        enabled.map(async (agentRow) => {
          const agent = await agentsApi.get(agentRow.id, agentRow.companyId);
          const runtimeConfig = asRecord(agent.runtimeConfig) ?? {};
          const heartbeat = asRecord(runtimeConfig.heartbeat) ?? {};
          await agentsApi.update(
            agentRow.id,
            {
              runtimeConfig: {
                ...runtimeConfig,
                heartbeat: { ...heartbeat, enabled: false },
              },
            },
            agentRow.companyId,
          );
        }),
      );

      const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
      if (failures.length > 0) {
        const firstError = failures[0]?.reason;
        const detail = firstError instanceof Error ? firstError.message : "Unknown error";
        throw new Error(
          failures.length === 1
            ? `Failed to disable 1 timer heartbeat: ${detail}`
            : `Failed to disable ${failures.length} of ${enabled.length} timer heartbeats. First error: ${detail}`,
        );
      }
      return enabled;
    },
    onSuccess: async (updatedRows) => {
      setActionError(null);
      const companies = new Set(updatedRows.map((row) => row.companyId));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.instance.schedulerHeartbeats }),
        ...Array.from(companies, (companyId) =>
          queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(companyId) }),
        ),
        ...updatedRows.map((row) =>
          queryClient.invalidateQueries({ queryKey: queryKeys.agents.detail(row.id) }),
        ),
      ]);
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : copy.disableAllError);
    },
  });

  const agents = heartbeatsQuery.data ?? [];
  const activeCount = agents.filter((agent) => agent.schedulerActive).length;
  const disabledCount = agents.length - activeCount;
  const enabledCount = agents.filter((agent) => agent.heartbeatEnabled).length;
  const anyEnabled = enabledCount > 0;

  const grouped = useMemo(() => {
    const map = new Map<string, { companyName: string; agents: InstanceSchedulerHeartbeatAgent[] }>();
    for (const agent of agents) {
      let group = map.get(agent.companyId);
      if (!group) {
        group = { companyName: agent.companyName, agents: [] };
        map.set(agent.companyId, group);
      }
      group.agents.push(agent);
    }
    return [...map.values()];
  }, [agents]);

  if (heartbeatsQuery.isLoading) {
    return <div className="text-sm text-muted-foreground">{copy.loading}</div>;
  }

  if (heartbeatsQuery.error) {
    return (
      <div className="text-sm text-destructive">
        {heartbeatsQuery.error instanceof Error
          ? heartbeatsQuery.error.message
          : copy.loadError}
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">{copy.title}</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {copy.description}
        </p>
      </div>

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span><span className="font-semibold text-foreground">{activeCount}</span> {copy.active}</span>
        <span><span className="font-semibold text-foreground">{disabledCount}</span> {copy.disabled}</span>
        <span><span className="font-semibold text-foreground">{grouped.length}</span> {grouped.length === 1 ? copy.company : copy.companies}</span>
        {anyEnabled && (
          <Button
            variant="destructive"
            size="sm"
            className="ml-auto h-7 text-xs"
            disabled={disableAllMutation.isPending}
            onClick={() => {
              const noun = enabledCount === 1 ? "agent" : "agents";
              if (!window.confirm(copy.disableConfirm(enabledCount, noun))) {
                return;
              }
              disableAllMutation.mutate(agents);
            }}
          >
            {disableAllMutation.isPending ? copy.disabling : copy.disableAll}
          </Button>
        )}
      </div>

      {actionError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {actionError}
        </div>
      )}

      {agents.length === 0 ? (
        <EmptyState
          icon={Clock3}
          message={copy.noHeartbeats}
        />
      ) : (
        <div className="space-y-4">
          {grouped.map((group) => (
            <Card key={group.companyName}>
              <CardContent className="p-0">
                <div className="border-b px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.companyName}
                </div>
                <div className="divide-y">
                  {group.agents.map((agent) => {
                    const saving = toggleMutation.isPending && toggleMutation.variables?.id === agent.id;
                    return (
                      <div
                        key={agent.id}
                        className="flex items-center gap-3 px-3 py-2 text-sm"
                      >
                        <Badge
                          variant={agent.schedulerActive ? "default" : "outline"}
                          className="shrink-0 text-[10px] px-1.5 py-0"
                        >
                          {agent.schedulerActive ? copy.statusOn : copy.statusOff}
                        </Badge>
                        <Link
                          to={buildAgentHref(agent)}
                          className="font-medium truncate hover:underline"
                        >
                          {agent.agentName}
                        </Link>
                        <span className="hidden sm:inline text-muted-foreground truncate">
                          {humanize(agent.title ?? agent.role)}
                        </span>
                        <span className="text-muted-foreground tabular-nums shrink-0">
                          {agent.intervalSec}s
                        </span>
                        <span
                          className="hidden md:inline text-muted-foreground truncate"
                          title={agent.lastHeartbeatAt ? formatDateTime(agent.lastHeartbeatAt) : undefined}
                        >
                          {agent.lastHeartbeatAt
                            ? relativeTime(agent.lastHeartbeatAt)
                            : copy.never}
                        </span>
                        <span className="ml-auto flex items-center gap-1.5 shrink-0">
                          <Link
                            to={buildAgentHref(agent)}
                            className="text-muted-foreground hover:text-foreground"
                            title={copy.fullConfig}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            disabled={saving}
                            onClick={() => toggleMutation.mutate(agent)}
                          >
                            {saving ? "..." : agent.heartbeatEnabled ? copy.disableTimerHeartbeat : copy.enableTimerHeartbeat}
                          </Button>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
