import type { JsonSchema, PluginCategory, PluginStatus } from "../constants.js";

// ---------------------------------------------------------------------------
// Plugin Manifest — matches PLUGIN_SPEC.md §10.1
// ---------------------------------------------------------------------------

export interface PluginToolDeclaration {
  name: string;
  displayName: string;
  description: string;
  parametersSchema: JsonSchema;
}

export interface PluginJobDeclaration {
  name: string;
  displayName: string;
  description: string;
  schedule?: string;
}

export interface PluginWebhookDeclaration {
  name: string;
  displayName: string;
  description: string;
  /** HTTP methods this webhook accepts */
  methods?: Array<"GET" | "POST" | "PUT" | "DELETE">;
}

export interface PluginUiSlotDeclaration {
  type: "page" | "detailTab" | "dashboardWidget" | "sidebar" | "settingsPage";
  id: string;
  displayName: string;
  /** Which export name in the UI bundle provides this component */
  exportName: string;
  /** For detailTab: which entity types this tab appears on */
  entityTypes?: Array<"project" | "issue" | "agent" | "goal" | "run">;
}

export interface PluginManifestV1 {
  id: string;
  apiVersion: 1;
  version: string;
  displayName: string;
  description: string;
  categories: PluginCategory[];
  minimumPaperclipVersion?: string;
  capabilities: string[];
  entrypoints: {
    worker: string;
    ui?: string;
  };
  instanceConfigSchema?: JsonSchema;
  jobs?: PluginJobDeclaration[];
  webhooks?: PluginWebhookDeclaration[];
  tools?: PluginToolDeclaration[];
  ui?: {
    slots: PluginUiSlotDeclaration[];
  };
}

// ---------------------------------------------------------------------------
// Plugin Install Record — persisted in DB after installation
// ---------------------------------------------------------------------------

export interface PluginInstallRecord {
  id: string;
  pluginId: string;
  packageName: string;
  version: string;
  status: PluginStatus;
  capabilities: string[];
  installedAt: Date;
  updatedAt: Date;
  config: Record<string, unknown> | null;
  error: string | null;
}
