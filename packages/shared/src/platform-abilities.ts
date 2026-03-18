/**
 * Canonical description of what a Paperclip instance can do.
 * Merged at runtime with installed agent adapter types (see GET /api/platform/capabilities).
 */
export type PlatformCapabilityDomain = {
  id: string;
  title: string;
  description?: string;
  abilities: string[];
};

export const PLATFORM_CAPABILITY_DOMAINS: PlatformCapabilityDomain[] = [
  {
    id: "control_plane",
    title: "Control plane",
    description: "Operate AI-native companies from one place.",
    abilities: [
      "Multiple companies per instance; switch context in the board UI",
      "Dashboard: agent status, open work, spend, pending approvals",
      "Activity log for mutating actions",
    ],
  },
  {
    id: "agents",
    title: "Agents & heartbeats",
    abilities: [
      "Register agents with adapter types (CLI, cloud, process, HTTP, etc.)",
      "Scheduled heartbeats, manual invoke, and wakeups (e.g. from issue comments)",
      "Per-agent API keys; bearer auth scoped to one company",
      "Session resume and compaction for supported local adapters",
      "CRCA-Q (crca_q): first-class adapter when crca-q is on PATH — runs quant cycles with Paperclip context and optional agent JWT",
    ],
  },
  {
    id: "work",
    title: "Work & governance",
    abilities: [
      "Issues (tasks) with hierarchy, comments, attachments, linked documents",
      "Single-assignee atomic checkout for in_progress",
      "Approvals (e.g. hires, CEO strategy) when enabled",
      "Goals and projects; company secrets for adapter env",
    ],
  },
  {
    id: "costs",
    title: "Costs & budgets",
    abilities: [
      "Cost events and rollups by agent/project/company",
      "Monthly budgets with soft alerts and hard-stop auto-pause",
    ],
  },
  {
    id: "process_http",
    title: "Process & HTTP adapters",
    description: "Extend the host with scripts and webhooks.",
    abilities: [
      "Process adapter: run any command on heartbeat (e.g. Python, Node, custom CLIs)",
      "Each process run receives PAPERCLIP_CONTEXT_JSON (company, agent, run id, issue context when present)",
      "When JWT is enabled for the run, PAPERCLIP_AGENT_JWT is set for short-lived API access",
      "HTTP adapter: outbound webhook per heartbeat",
      "External toolchains (e.g. quant runners) install on the host and are invoked via process adapter — not bundled in core",
    ],
  },
  {
    id: "plugins",
    title: "Plugins",
    abilities: [
      "Load plugins from the instance plugin directory",
      "Optional UI slots, workers, jobs, and tool dispatch (when enabled)",
    ],
  },
];

export type InstalledAgentAdapterInfo = {
  type: string;
  supportsLocalAgentJwt: boolean;
  hasSessionCodec: boolean;
  modelCount: number;
};

export type PlatformCapabilitiesPayload = {
  schemaVersion: 1;
  core: typeof PLATFORM_CAPABILITY_DOMAINS;
  installedAgentAdapters: InstalledAgentAdapterInfo[];
  deploymentMode: string;
  deploymentExposure: string;
  version: string;
  features: {
    companyDeletionEnabled: boolean;
    authReady: boolean;
  };
};
