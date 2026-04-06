/**
 * Role-based provisioning preset configuration.
 *
 * Maps Raava agent roles to FleetOS provisioning defaults including
 * template, system prompt orientation, and integration hints.
 */

export interface RolePreset {
  /** FleetOS template name */
  template: string;
  /** System prompt orientation for the role */
  systemPromptHint: string;
  /** Default integrations to enable */
  integrations: string[];
  /** Extra provisioning fields passed to FleetOS */
  extraFields?: Record<string, string>;
}

const DEFAULT_TEMPLATE = "hermes";

export const ROLE_PRESETS: Record<string, RolePreset> = {
  sales: {
    template: DEFAULT_TEMPLATE,
    systemPromptHint: "sales-oriented",
    integrations: ["crm", "email", "calendar"],
    extraFields: {
      system_prompt_role: "sales",
    },
  },
  ops: {
    template: DEFAULT_TEMPLATE,
    systemPromptHint: "operations",
    integrations: ["logistics", "inventory", "scheduling"],
    extraFields: {
      system_prompt_role: "operations",
    },
  },
  data: {
    template: DEFAULT_TEMPLATE,
    systemPromptHint: "analytics",
    integrations: ["data-warehouse", "bi-tools", "etl"],
    extraFields: {
      system_prompt_role: "analytics",
    },
  },
  support: {
    template: DEFAULT_TEMPLATE,
    systemPromptHint: "support",
    integrations: ["ticketing", "knowledge-base", "live-chat"],
    extraFields: {
      system_prompt_role: "support",
    },
  },
  marketing: {
    template: DEFAULT_TEMPLATE,
    systemPromptHint: "marketing",
    integrations: ["content-management", "social-media", "analytics"],
    extraFields: {
      system_prompt_role: "marketing",
    },
  },
  general: {
    template: DEFAULT_TEMPLATE,
    systemPromptHint: "general-purpose",
    integrations: [],
    extraFields: {
      system_prompt_role: "general",
    },
  },
};

/**
 * Resolve the provisioning preset for a given agent role.
 * Falls back to the "general" preset if the role is not recognized.
 */
export function resolveRolePreset(role: string): RolePreset {
  const normalized = role.toLowerCase().trim();
  return ROLE_PRESETS[normalized] ?? ROLE_PRESETS.general;
}
