import type {
  PluginActionResponse,
  PluginListResponse,
  PluginRestartResponse,
} from "@paperclipai/shared";
import { api } from "./client";

function toInstanceQuery(instanceId?: string) {
  if (!instanceId) return "";
  const params = new URLSearchParams({ instance: instanceId });
  return `?${params.toString()}`;
}

export const pluginsApi = {
  list(instanceId?: string) {
    return api.get<PluginListResponse>(`/instance/plugins${toInstanceQuery(instanceId)}`);
  },
  installLocal(path: string, instanceId?: string) {
    return api.post<PluginActionResponse>(`/instance/plugins/install${toInstanceQuery(instanceId)}`, {
      path,
    });
  },
  setEnabled(pluginId: string, enabled: boolean, instanceId?: string) {
    return api.patch<PluginActionResponse>(
      `/instance/plugins/${encodeURIComponent(pluginId)}/enabled${toInstanceQuery(instanceId)}`,
      { enabled },
    );
  },
  restart(pluginId: string, instanceId?: string) {
    return api.post<PluginRestartResponse>(
      `/instance/plugins/${encodeURIComponent(pluginId)}/restart${toInstanceQuery(instanceId)}`,
      {},
    );
  },
};
