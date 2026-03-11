import type {
  InstanceClaudeConnectionProbeResult,
  InstanceClaudeSubscriptionAuthResponse,
  InstanceCodexConnectionProbeResult,
  InstanceCodexSubscriptionAuthResponse,
  InstanceSettingsResponse,
  UpdateInstanceSettings,
} from "@paperclipai/shared";
import { api } from "./client";

export const instanceSettingsApi = {
  get: () => api.get<InstanceSettingsResponse>("/instance/settings"),
  update: (input: UpdateInstanceSettings) =>
    api.patch<{ ok: true; settings: InstanceSettingsResponse }>("/instance/settings", input),
  getClaudeSubscriptionAuth: () =>
    api.get<InstanceClaudeSubscriptionAuthResponse>("/instance/settings/provider-auth/claude/subscription"),
  startClaudeSubscriptionAuth: () =>
    api.post<InstanceClaudeSubscriptionAuthResponse>("/instance/settings/provider-auth/claude/subscription/start", {}),
  testClaudeApiKeyConnection: () =>
    api.post<InstanceClaudeConnectionProbeResult>("/instance/settings/provider-auth/claude/test-api-key", {}),
  testClaudeSubscriptionConnection: () =>
    api.post<InstanceClaudeConnectionProbeResult>("/instance/settings/provider-auth/claude/test-subscription", {}),
  getCodexSubscriptionAuth: () =>
    api.get<InstanceCodexSubscriptionAuthResponse>("/instance/settings/provider-auth/codex/subscription"),
  startCodexSubscriptionAuth: () =>
    api.post<InstanceCodexSubscriptionAuthResponse>("/instance/settings/provider-auth/codex/subscription/start", {}),
  testCodexApiKeyConnection: () =>
    api.post<InstanceCodexConnectionProbeResult>("/instance/settings/provider-auth/codex/test-api-key", {}),
  testCodexSubscriptionConnection: () =>
    api.post<InstanceCodexConnectionProbeResult>("/instance/settings/provider-auth/codex/test-subscription", {}),
};
