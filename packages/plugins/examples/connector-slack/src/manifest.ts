import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";
import {
  EXPORT_NAMES,
  JOB_KEYS,
  PLUGIN_ID,
  PLUGIN_VERSION,
  SLOT_IDS,
  WEBHOOK_KEYS,
} from "./constants.js";

const manifest: PaperclipPluginManifestV1 = {
  id: PLUGIN_ID,
  apiVersion: 1,
  version: PLUGIN_VERSION,
  displayName: "Slack Connector",
  description:
    "Bidirectional Slack integration — create, update, and comment on Paperclip issues from Slack. " +
    "Manage approvals with interactive buttons. React with emoji to change status.",
  author: "agentsmith",
  categories: ["connector"],
  capabilities: [
    // Read company/project context
    "companies.read",
    "projects.read",
    // Issue CRUD
    "issues.read",
    "issues.create",
    "issues.update",
    "issue.comments.read",
    "issue.comments.create",
    // Agent awareness
    "agents.read",
    // Event subscription (outbound sync)
    "events.subscribe",
    // State storage (mapping + config)
    "plugin.state.read",
    "plugin.state.write",
    // Secrets (Slack tokens)
    "secrets.read-ref",
    // Outbound HTTP (Slack API calls)
    "http.outbound",
    // Inbound webhooks (Slack events, commands, interactive)
    "webhooks.receive",
    // Activity logging
    "activity.log.write",
    // Metrics
    "metrics.write",
    // UI surfaces
    "ui.page.register",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui",
  },
  instanceConfigSchema: {
    type: "object",
    properties: {
      defaultChannel: {
        type: "string",
        title: "Default Slack Channel",
        description: "Slack channel ID where issues without a project mapping are posted (e.g. C0123456789)",
      },
      signingSecret: {
        type: "string",
        title: "Slack Signing Secret Reference",
        description: "Paperclip secret reference for the Slack signing secret (used to verify webhooks)",
        format: "secret-ref",
      },
      botToken: {
        type: "string",
        title: "Slack Bot Token Reference",
        description: "Paperclip secret reference for the Slack Bot OAuth token (xoxb-...)",
        format: "secret-ref",
      },
    },
    required: ["botToken"],
  },
  webhooks: [
    {
      endpointKey: WEBHOOK_KEYS.slackEvents,
      displayName: "Slack Events",
      description: "Receives Slack Event API payloads (message events, reactions, etc.)",
    },
    {
      endpointKey: WEBHOOK_KEYS.slackInteractive,
      displayName: "Slack Interactive",
      description: "Receives Slack interactive component payloads (button clicks, modal submissions)",
    },
    {
      endpointKey: WEBHOOK_KEYS.slackCommands,
      displayName: "Slack Commands",
      description: "Receives Slack slash command payloads (/paperclip create, /paperclip status)",
    },
  ],
  jobs: [
    {
      jobKey: JOB_KEYS.healthCheck,
      displayName: "Slack Health Check",
      description: "Periodic check that the Slack API is reachable",
      schedule: "*/30 * * * *",
    },
  ],
  ui: {
    slots: [
      {
        type: "settingsPage",
        id: SLOT_IDS.settingsPage,
        displayName: "Slack Connector Settings",
        exportName: EXPORT_NAMES.settingsPage,
      },
    ],
  },
};

export default manifest;
