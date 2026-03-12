import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Loader2, Package, Plug, RefreshCw, ToggleLeft, ToggleRight } from "lucide-react";
import type { PluginRegistryRecord } from "@paperclipai/shared";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { pluginsApi } from "../api/plugins";
import { queryKeys } from "../lib/queryKeys";
import { formatDateTime, relativeTime } from "../lib/utils";
import { EmptyState } from "../components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function StatusBadge({ plugin }: { plugin: PluginRegistryRecord }) {
  if (!plugin.enabled) {
    return <Badge variant="outline">Disabled</Badge>;
  }
  if (plugin.status === "ready") {
    return <Badge variant="default">Ready</Badge>;
  }
  return <Badge variant="destructive">Error</Badge>;
}

export function InstancePluginsSettings() {
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const [localPath, setLocalPath] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setBreadcrumbs([{ label: "Instance Settings" }, { label: "Plugins" }]);
  }, [setBreadcrumbs]);

  const pluginsQuery = useQuery({
    queryKey: queryKeys.instance.plugins(),
    queryFn: () => pluginsApi.list(),
    refetchInterval: 15_000,
  });

  const installMutation = useMutation({
    mutationFn: async () => {
      const trimmed = localPath.trim();
      if (!trimmed) {
        throw new Error("Please provide a local plugin package path.");
      }
      return pluginsApi.installLocal(trimmed);
    },
    onSuccess: async () => {
      setErrorMessage(null);
      setLocalPath("");
      await queryClient.invalidateQueries({ queryKey: queryKeys.instance.plugins() });
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : "Install failed");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ pluginId, enabled }: { pluginId: string; enabled: boolean }) =>
      pluginsApi.setEnabled(pluginId, enabled),
    onSuccess: async () => {
      setErrorMessage(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.instance.plugins() });
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : "Failed to update plugin state");
    },
  });

  const restartMutation = useMutation({
    mutationFn: (pluginId: string) => pluginsApi.restart(pluginId),
    onSuccess: async () => {
      setErrorMessage(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.instance.plugins() });
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : "Restart failed");
    },
  });

  const plugins = pluginsQuery.data?.plugins ?? [];

  const stats = useMemo(() => {
    const ready = plugins.filter((plugin) => plugin.status === "ready" && plugin.enabled).length;
    const disabled = plugins.filter((plugin) => !plugin.enabled).length;
    const errors = plugins.filter((plugin) => plugin.status === "error").length;
    return { total: plugins.length, ready, disabled, errors };
  }, [plugins]);

  if (pluginsQuery.isLoading) {
    return <div className="text-sm text-muted-foreground">Loading plugins...</div>;
  }

  if (pluginsQuery.error) {
    return (
      <div className="text-sm text-destructive">
        {pluginsQuery.error instanceof Error
          ? pluginsQuery.error.message
          : "Failed to load plugin records."}
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Plug className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Plugin Host</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Manage plugins installed in the current Paperclip instance.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="text-sm font-medium">Install plugin from local path</div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="/absolute/path/to/plugin/package"
              value={localPath}
              onChange={(event) => setLocalPath(event.target.value)}
              disabled={installMutation.isPending}
            />
            <Button
              onClick={() => installMutation.mutate()}
              disabled={installMutation.isPending || localPath.trim().length === 0}
              className="sm:w-auto"
            >
              {installMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Installing...
                </>
              ) : (
                <>
                  <Package className="mr-2 h-4 w-4" /> Install
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-4 text-sm text-muted-foreground">
        <span><span className="font-semibold text-foreground">{stats.total}</span> total</span>
        <span><span className="font-semibold text-foreground">{stats.ready}</span> ready</span>
        <span><span className="font-semibold text-foreground">{stats.disabled}</span> disabled</span>
        <span><span className="font-semibold text-foreground">{stats.errors}</span> errors</span>
      </div>

      {errorMessage && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      {plugins.length === 0 ? (
        <EmptyState icon={Package} message="No plugins installed yet." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {plugins.map((plugin) => {
                const toggling =
                  toggleMutation.isPending && toggleMutation.variables?.pluginId === plugin.pluginId;
                const restarting =
                  restartMutation.isPending && restartMutation.variables === plugin.pluginId;
                return (
                  <div key={plugin.pluginId} className="px-3 py-3 text-sm space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge plugin={plugin} />
                      <span className="font-medium">{plugin.pluginId}</span>
                      <span className="text-muted-foreground">{plugin.packageVersion}</span>
                    </div>

                    <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
                      <span className="truncate" title={plugin.sourcePath}>source: {plugin.sourcePath}</span>
                      <span title={formatDateTime(plugin.updatedAt)}>updated: {relativeTime(plugin.updatedAt)}</span>
                      <span>
                        lifecycle: load {plugin.lifecycle.loadCount}, restart {plugin.lifecycle.restartCount}
                      </span>
                      <span>
                        health: {plugin.lastHealth ? "available" : "n/a"}
                      </span>
                      {plugin.lastError && (
                        <span className="text-destructive truncate" title={plugin.lastError}>
                          error: {plugin.lastError}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={toggling}
                        onClick={() =>
                          toggleMutation.mutate({
                            pluginId: plugin.pluginId,
                            enabled: !plugin.enabled,
                          })
                        }
                      >
                        {plugin.enabled ? (
                          <>
                            <ToggleLeft className="mr-1.5 h-4 w-4" /> Disable
                          </>
                        ) : (
                          <>
                            <ToggleRight className="mr-1.5 h-4 w-4" /> Enable
                          </>
                        )}
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        disabled={restarting}
                        onClick={() => restartMutation.mutate(plugin.pluginId)}
                      >
                        {restarting ? (
                          <>
                            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Restarting...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="mr-1.5 h-4 w-4" /> Restart
                          </>
                        )}
                      </Button>

                      <span className="text-xs text-muted-foreground inline-flex items-center">
                        <Activity className="mr-1 h-3.5 w-3.5" /> health/status shown from registry snapshot
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
