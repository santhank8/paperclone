export interface InstanceExperimentalSettings {
  enableIsolatedWorkspaces: boolean;
  enableAutoMode: boolean;
}

export interface InstanceSettings {
  id: string;
  experimental: InstanceExperimentalSettings;
  createdAt: Date;
  updatedAt: Date;
}
