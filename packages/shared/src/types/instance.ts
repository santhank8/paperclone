import type { AgentAdapterType } from "../constants.js";

export interface InstanceGeneralSettings {
  censorUsernameInLogs: boolean;
  defaultAdapterType: AgentAdapterType;
}

export interface InstanceExperimentalSettings {
  enableIsolatedWorkspaces: boolean;
  autoRestartDevServerWhenIdle: boolean;
}

export interface InstanceSettings {
  id: string;
  general: InstanceGeneralSettings;
  experimental: InstanceExperimentalSettings;
  createdAt: Date;
  updatedAt: Date;
}
