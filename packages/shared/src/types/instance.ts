export type InstanceLanguage = "en" | "pt-BR";

export interface InstanceGeneralSettings {
  language: InstanceLanguage;
}

export interface InstanceExperimentalSettings {
  enableIsolatedWorkspaces: boolean;
}

export interface InstanceSettings {
  id: string;
  general: InstanceGeneralSettings;
  experimental: InstanceExperimentalSettings;
  createdAt: Date;
  updatedAt: Date;
}
