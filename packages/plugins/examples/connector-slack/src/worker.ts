import {
  definePlugin,
  runWorker,
  type PaperclipPlugin,
  type PluginContext,
  type PluginEvent,
  type PluginHealthDiagnostics,
  type PluginJobContext,
  type PluginWebhookInput,
} from "@paperclipai/plugin-sdk";
import type { Issue } from "@paperclipai/shared";
import {
  PLUGIN_ID,
  WEBHOOK_KEYS,
  JOB_KEYS,
  REACTION_STATUS_MAP,
  STATUS_DISPLAY,
} from "./constants.js";
import { isOwnChange, markAsOwnChange, cleanupExpired } from "./echo.js";
import { createSlackClient, buildIssueBlocks, buildApprovalBlocks, type SlackApiClient } from "./slack-api.js";
import { verifySlackSignature } from "./verify.js";
import {
  saveIssueMapping,
  saveReverseMapping,
  getIssueMapping,
  getIssueIdFromThread,
  getProjectChannel,
  getDefaultChannel,
} from "./mapping.js";

// ---------------------------------------------------------------------------
// Config types
// ---------------------------------------------------------------------------

type SlackConnectorConfig = {
  defaultChannel?: string;
  signingSecret?: string;
  botToken?: string;
};

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

let currentCtx: PluginContext | null = null;
let slack: SlackApiClient | null = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getConfig(ctx: PluginContext): Promise<SlackConnectorConfig> {
  return (await ctx.config.get()) as SlackConnectorConfig ?? {};
}

async function resolveChannel(ctx: PluginContext, projectId?: string | null): Promise<string | null> {
  if (projectId) {
    const projectChannel = await getProjectChannel(ctx, projectId);
    if (projectChannel) return projectChannel;
  }
  const config = await getConfig(ctx);
  if (config.defaultChannel) return config.defaultChannel;
  return await getDefaultChannel(ctx);
}

function issueText(issue: Pick<Issue, "identifier" | "title" | "status" | "priority">): string {
  const status = STATUS_DISPLAY[issue.status] ?? { emoji: "❓", label: issue.status };
  return `${status.emoji} *${issue.identifier ?? ""}* ${issue.title} [${status.label}]`;
}

// ---------------------------------------------------------------------------
// OUTBOUND: Paperclip → Slack (plugin event handlers)
// ---------------------------------------------------------------------------

async function onIssueCreated(ctx: PluginContext, event: PluginEvent): Promise<void> {
  if (!slack) return;
  const payload = event.payload as Record<string, unknown>;
  const issue = payload as unknown as Issue;
  if (!issue?.id) return;

  if (isOwnChange(issue.id)) return;

  const channel = await resolveChannel(ctx, issue.projectId);
  if (!channel) {
    ctx.logger.warn("No Slack channel configured; skipping issue.created sync", { issueId: issue.id });
    return;
  }

  try {
    const blocks = buildIssueBlocks(issue);
    const text = issueText(issue);
    const result = await slack.postMessage(channel, text, blocks);

    await saveIssueMapping(ctx, issue.id, {
      threadTs: result.ts,
      channelId: result.channel,
      messageTs: result.ts,
    });
    await saveReverseMapping(ctx, result.ts, result.channel, issue.id);

    ctx.logger.info("Posted issue to Slack", { issueId: issue.id, channel, ts: result.ts });
    await ctx.metrics.write("slack.outbound.issue_created", 1);
  } catch (err) {
    ctx.logger.error("Failed to post issue to Slack", { issueId: issue.id, error: String(err) });
    await ctx.metrics.write("slack.outbound.error", 1, { handler: "issue_created" });
  }
}

async function onIssueUpdated(ctx: PluginContext, event: PluginEvent): Promise<void> {
  if (!slack) return;
  const payload = event.payload as Record<string, unknown>;
  const issue = payload as unknown as Issue;
  if (!issue?.id) return;

  if (isOwnChange(issue.id)) return;

  const mapping = await getIssueMapping(ctx, issue.id);
  if (!mapping) return;

  try {
    const blocks = buildIssueBlocks(issue);
    const text = issueText(issue);
    await slack.updateMessage(mapping.channelId, mapping.messageTs, text, blocks);
    ctx.logger.info("Updated issue in Slack", { issueId: issue.id });
    await ctx.metrics.write("slack.outbound.issue_updated", 1);
  } catch (err) {
    ctx.logger.error("Failed to update issue in Slack", { issueId: issue.id, error: String(err) });
    await ctx.metrics.write("slack.outbound.error", 1, { handler: "issue_updated" });
  }
}

async function onCommentCreated(ctx: PluginContext, event: PluginEvent): Promise<void> {
  if (!slack) return;
  const payload = event.payload as Record<string, unknown>;
  const issueId = payload.issueId as string | undefined;
  const body = payload.body as string | undefined;
  if (!issueId || !body) return;

  if (isOwnChange(issueId)) return;

  const mapping = await getIssueMapping(ctx, issueId);
  if (!mapping) return;

  try {
    const authorName = (payload.authorAgentId as string) ? "🤖 Agent" : "👤 User";
    await slack.postMessage(mapping.channelId, `${authorName}: ${body}`, undefined, mapping.threadTs);
    ctx.logger.info("Posted comment to Slack thread", { issueId });
    await ctx.metrics.write("slack.outbound.comment_created", 1);
  } catch (err) {
    ctx.logger.error("Failed to post comment to Slack", { issueId, error: String(err) });
    await ctx.metrics.write("slack.outbound.error", 1, { handler: "comment_created" });
  }
}

async function onApprovalCreated(ctx: PluginContext, event: PluginEvent): Promise<void> {
  if (!slack) return;
  const payload = event.payload as Record<string, unknown>;
  const approvalId = payload.id as string | undefined;
  const title = payload.title as string ?? payload.type as string ?? "Approval Request";
  const description = payload.description as string | undefined;

  if (!approvalId) return;

  const channel = await resolveChannel(ctx, null);
  if (!channel) return;

  try {
    const blocks = buildApprovalBlocks({ id: approvalId, title, description });
    const text = `🎫 Approval Required: ${title}`;
    const result = await slack.postMessage(channel, text, blocks);

    await ctx.state.set(
      { scopeKind: "instance", namespace: "slack", stateKey: `approval:${approvalId}:ts` },
      result.ts,
    );
    await ctx.state.set(
      { scopeKind: "instance", namespace: "slack", stateKey: `approval:${approvalId}:channel` },
      result.channel,
    );

    ctx.logger.info("Posted approval request to Slack", { approvalId, channel });
    await ctx.metrics.write("slack.outbound.approval_created", 1);
  } catch (err) {
    ctx.logger.error("Failed to post approval to Slack", { approvalId, error: String(err) });
    await ctx.metrics.write("slack.outbound.error", 1, { handler: "approval_created" });
  }
}

async function onApprovalDecided(ctx: PluginContext, event: PluginEvent): Promise<void> {
  if (!slack) return;
  const payload = event.payload as Record<string, unknown>;
  const approvalId = payload.id as string | undefined;
  const decision = payload.decision as string ?? payload.status as string ?? "unknown";
  const title = payload.title as string ?? "Approval";

  if (!approvalId) return;

  const messageTs = await ctx.state.get({
    scopeKind: "instance",
    namespace: "slack",
    stateKey: `approval:${approvalId}:ts`,
  }) as string | null;
  const channelId = await ctx.state.get({
    scopeKind: "instance",
    namespace: "slack",
    stateKey: `approval:${approvalId}:channel`,
  }) as string | null;

  if (!messageTs || !channelId) return;

  try {
    const emoji = decision === "approved" ? "✅" : decision === "rejected" ? "❌" : "❓";
    await slack.updateMessage(
      channelId,
      messageTs,
      `${emoji} *${title}* — ${decision}`,
      [{
        type: "section",
        text: { type: "mrkdwn", text: `${emoji} *${title}*\nDecision: *${decision}*` },
      }],
    );
    ctx.logger.info("Updated approval message in Slack", { approvalId, decision });
    await ctx.metrics.write("slack.outbound.approval_decided", 1);
  } catch (err) {
    ctx.logger.error("Failed to update approval in Slack", { approvalId, error: String(err) });
    await ctx.metrics.write("slack.outbound.error", 1, { handler: "approval_decided" });
  }
}

// ---------------------------------------------------------------------------
// INBOUND: Slack → Paperclip (webhook handlers)
// ---------------------------------------------------------------------------

async function handleSlackCommand(ctx: PluginContext, input: PluginWebhookInput): Promise<void> {
  const body = input.parsedBody as Record<string, unknown> | undefined;
  if (!body) return;

  const command = body.command as string;
  const text = (body.text as string ?? "").trim();
  const channelId = body.channel_id as string;

  if (command !== "/paperclip") return;

  const parts = text.split(/\s+/);
  const subcommand = parts[0]?.toLowerCase() ?? "";
  const args = parts.slice(1).join(" ").trim();

  if (subcommand === "create" && !args) {
    // /paperclip create (no args) — prompt user
    if (slack) {
      await slack.postMessage(channelId, "Usage: `/paperclip create [title]`\nExample: `/paperclip create Fix the login page CSS`");
    }
    return;
  }

  if (subcommand === "create" && args) {
    // /paperclip create Fix the auth bug
    const companies = await ctx.companies.list({ limit: 1, offset: 0 });
    const companyId = companies[0]?.id;
    if (!companyId) return;

    const issue = await ctx.issues.create({ companyId, title: args });
    markAsOwnChange(issue.id);

    // Post the issue to this channel and save mapping
    if (slack) {
      const blocks = buildIssueBlocks(issue);
      const result = await slack.postMessage(channelId, issueText(issue), blocks);
      await saveIssueMapping(ctx, issue.id, {
        threadTs: result.ts,
        channelId: result.channel,
        messageTs: result.ts,
      });
      await saveReverseMapping(ctx, result.ts, result.channel, issue.id);
    }

    ctx.logger.info("Created issue from Slack command", { issueId: issue.id, title: args });
    await ctx.metrics.write("slack.inbound.command_create", 1);
  } else if (subcommand === "status") {
    const companies = await ctx.companies.list({ limit: 1, offset: 0 });
    const companyId = companies[0]?.id;
    if (!companyId) return;

    const issues = await ctx.issues.list({ companyId, status: "in_progress" as Issue["status"], limit: 10, offset: 0 });
    if (slack && issues.length > 0) {
      const lines = issues.map((iss) => issueText(iss));
      await slack.postMessage(channelId, `*Active Issues:*\n${lines.join("\n")}`);
    } else if (slack) {
      await slack.postMessage(channelId, "No issues currently in progress.");
    }
    await ctx.metrics.write("slack.inbound.command_status", 1);
  } else if (subcommand === "agents") {
    const companies = await ctx.companies.list({ limit: 1, offset: 0 });
    const companyId = companies[0]?.id;
    if (!companyId) return;

    const agents = await ctx.agents.list({ companyId, limit: 20, offset: 0 });
    if (slack && agents.length > 0) {
      const lines = agents.map((a) => {
        const statusEmoji = a.status === "idle" ? "💤" : a.status === "active" ? "🟢" : a.status === "paused" ? "⏸️" : "❓";
        return `${statusEmoji} *${a.name}* — ${a.title ?? a.role ?? "Agent"} (${a.status})`;
      });
      await slack.postMessage(channelId, `*Agents:*\n${lines.join("\n")}`);
    } else if (slack) {
      await slack.postMessage(channelId, "No agents configured.");
    }
    await ctx.metrics.write("slack.inbound.command_agents", 1);
  } else if (subcommand === "help" || !subcommand) {
    if (slack) {
      await slack.postMessage(channelId, [
        "*Paperclip Commands:*",
        "• `/paperclip create [title]` — Create a new issue",
        "• `/paperclip status` — Show active issues",
        "• `/paperclip agents` — Show all agents and their status",
        "• `/paperclip help` — Show this help message",
        "",
        "*Emoji Reactions on issue messages:*",
        "• ✅ — Mark done",
        "• 🚀 — Start (in progress)",
        "• 🔴 — Block",
        "• 👀 — In review",
      ].join("\n"));
    }
  }
}

async function handleSlackEvent(ctx: PluginContext, input: PluginWebhookInput): Promise<void> {
  const body = input.parsedBody as Record<string, unknown> | undefined;
  if (!body) return;

  // Handle Slack URL verification challenge
  // NOTE: The Paperclip plugin webhook system returns { deliveryId, status }
  // rather than passing through the plugin's response body. Slack requires
  // { challenge: "..." } to be echoed back for URL verification.
  //
  // WORKAROUND: Before enabling Event Subscriptions in your Slack App, you must
  // verify the URL manually. Use the Slack API's "Request URL" retry mechanism:
  // Slack will retry the verification until it succeeds. The first attempt will
  // fail (Paperclip returns its standard response), but you can set up a
  // temporary proxy that echoes the challenge, then switch to the Paperclip URL.
  //
  // Alternatively, use Slack's Socket Mode which doesn't require URL verification.
  if (body.type === "url_verification") {
    ctx.logger.info("Slack URL verification challenge received", {
      challenge: body.challenge,
      note: "Plugin SDK does not support custom webhook response bodies. Use Socket Mode or verify URL manually.",
    });
    return;
  }

  const event = body.event as Record<string, unknown> | undefined;
  if (!event) return;
  const eventType = event.type as string;

  // Thread reply → add comment to Paperclip issue
  if (eventType === "message" && event.thread_ts && !event.bot_id) {
    const threadTs = event.thread_ts as string;
    const channelId = event.channel as string;
    const text = event.text as string;
    if (!text) return;

    const issueId = await getIssueIdFromThread(ctx, channelId, threadTs);
    if (!issueId) return;

    const companies = await ctx.companies.list({ limit: 1, offset: 0 });
    const companyId = companies[0]?.id;
    if (!companyId) return;

    markAsOwnChange(issueId);
    await ctx.issues.createComment(issueId, text, companyId);
    ctx.logger.info("Added comment from Slack thread reply", { issueId });
    await ctx.metrics.write("slack.inbound.thread_comment", 1);
  }

  // Reaction added → change issue status
  if (eventType === "reaction_added") {
    const reaction = event.reaction as string;
    const item = event.item as Record<string, unknown> | undefined;
    if (!item || item.type !== "message") return;

    const newStatus = REACTION_STATUS_MAP[reaction];
    if (!newStatus) return;

    const channelId = item.channel as string;
    const messageTs = item.ts as string;
    const issueId = await getIssueIdFromThread(ctx, channelId, messageTs);
    if (!issueId) return;

    const companies = await ctx.companies.list({ limit: 1, offset: 0 });
    const companyId = companies[0]?.id;
    if (!companyId) return;

    markAsOwnChange(issueId);
    await ctx.issues.update(issueId, { status: newStatus as Issue["status"] }, companyId);
    ctx.logger.info("Updated issue status from Slack reaction", { issueId, reaction, newStatus });
    await ctx.metrics.write("slack.inbound.reaction_status", 1);
  }
}

async function handleSlackInteractive(ctx: PluginContext, input: PluginWebhookInput): Promise<void> {
  const body = input.parsedBody as Record<string, unknown> | undefined;
  if (!body) return;

  // Slack sends interactive payloads as { payload: JSON_STRING }
  let interactivePayload = body;
  if (typeof body.payload === "string") {
    try {
      interactivePayload = JSON.parse(body.payload) as Record<string, unknown>;
    } catch {
      return;
    }
  }

  const actions = interactivePayload.actions as Array<Record<string, unknown>> | undefined;
  if (!actions || actions.length === 0) return;

  const action = actions[0]!;
  const actionId = action.action_id as string;
  const issueId = action.value as string;

  if (!issueId) return;

  const companies = await ctx.companies.list({ limit: 1, offset: 0 });
  const companyId = companies[0]?.id;
  if (!companyId) return;

  // Status change buttons
  const statusActions: Record<string, string> = {
    paperclip_status_done: "done",
    paperclip_status_in_progress: "in_progress",
    paperclip_status_blocked: "blocked",
    paperclip_status_in_review: "in_review",
  };

  if (statusActions[actionId]) {
    markAsOwnChange(issueId);
    await ctx.issues.update(issueId, { status: statusActions[actionId] as Issue["status"] }, companyId);
    ctx.logger.info("Updated issue from Slack button", { issueId, actionId });
    await ctx.metrics.write("slack.inbound.button_status", 1);
  }

  // Approval buttons — SDK does not yet expose ctx.approvals, so we use HTTP API
  if (actionId === "paperclip_approve" || actionId === "paperclip_reject") {
    const decision = actionId === "paperclip_approve" ? "approved" : "rejected";
    const approvalId = issueId; // value field carries the approval ID
    try {
      await ctx.http.fetch(`/api/approvals/${approvalId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      ctx.logger.info("Resolved approval from Slack", { approvalId, decision });
      await ctx.metrics.write("slack.inbound.approval_resolved", 1);
    } catch (err) {
      ctx.logger.error("Failed to resolve approval from Slack", { approvalId, error: String(err) });
      await ctx.metrics.write("slack.inbound.approval_error", 1);
    }
  }
}

// ---------------------------------------------------------------------------
// Data + Action handlers (for UI bridge)
// ---------------------------------------------------------------------------

async function registerDataHandlers(ctx: PluginContext): Promise<void> {
  ctx.data.register("config", async () => {
    return await getConfig(ctx);
  });

  ctx.data.register("stats", async () => {
    return {
      pluginId: PLUGIN_ID,
      echoPreventionActive: true,
    };
  });

  ctx.data.register("channel-mappings", async (params) => {
    const companyId = typeof params.companyId === "string" ? params.companyId : "";
    if (!companyId) return { defaultChannel: null, projectChannels: [] };

    const config = await getConfig(ctx);
    const defaultChannel = config.defaultChannel
      ?? await getDefaultChannel(ctx);

    const projects = await ctx.projects.list({ companyId, limit: 100, offset: 0 });
    const projectChannels = await Promise.all(
      projects.map(async (p) => {
        const channelId = await getProjectChannel(ctx, p.id);
        return { projectId: p.id, projectName: p.name, channelId };
      }),
    );

    return {
      defaultChannel,
      projectChannels: projectChannels.filter((p) => p.channelId),
    };
  });
}

async function registerActionHandlers(ctx: PluginContext): Promise<void> {
  ctx.actions.register("set-default-channel", async (params) => {
    const channelId = typeof params.channelId === "string" ? params.channelId : "";
    if (!channelId) throw new Error("channelId is required");
    await ctx.state.set(
      { scopeKind: "instance", namespace: "slack", stateKey: "default-channel" },
      channelId,
    );
    return { ok: true, channelId };
  });

  ctx.actions.register("set-project-channel", async (params) => {
    const projectId = typeof params.projectId === "string" ? params.projectId : "";
    const channelId = typeof params.channelId === "string" ? params.channelId : "";
    if (!projectId || !channelId) throw new Error("projectId and channelId are required");
    await ctx.state.set(
      { scopeKind: "project", scopeId: projectId, namespace: "slack", stateKey: "channel-id" },
      channelId,
    );
    return { ok: true, projectId, channelId };
  });
}

async function registerJobHandlers(ctx: PluginContext): Promise<void> {
  ctx.jobs.register(JOB_KEYS.healthCheck, async () => {
    if (!slack) {
      ctx.logger.warn("Slack health check: no Slack client configured");
      return;
    }
    try {
      const config = await getConfig(ctx);
      if (!config.botToken) return;
      const token = await ctx.secrets.resolve(config.botToken);
      const response = await ctx.http.fetch("https://slack.com/api/auth.test", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await response.json()) as Record<string, unknown>;
      if (data.ok) {
        ctx.logger.info("Slack health check passed", { team: data.team, user: data.user });
        await ctx.metrics.write("slack.health.ok", 1);
      } else {
        ctx.logger.error("Slack health check failed", { error: data.error });
        await ctx.metrics.write("slack.health.error", 1);
      }
    } catch (err) {
      ctx.logger.error("Slack health check error", { error: String(err) });
      await ctx.metrics.write("slack.health.error", 1);
    }
  });
}

// ---------------------------------------------------------------------------
// Plugin definition
// ---------------------------------------------------------------------------

const plugin: PaperclipPlugin = definePlugin({
  async setup(ctx) {
    currentCtx = ctx;

    // Initialize Slack client
    const config = await getConfig(ctx);
    if (config.botToken) {
      slack = createSlackClient(ctx, async () => {
        const cfg = await getConfig(ctx);
        if (!cfg.botToken) throw new Error("Slack bot token not configured");
        return await ctx.secrets.resolve(cfg.botToken);
      });
    }

    // Subscribe to outbound events
    ctx.events.on("issue.created", async (event: PluginEvent) => {
      await onIssueCreated(ctx, event);
    });

    ctx.events.on("issue.updated", async (event: PluginEvent) => {
      await onIssueUpdated(ctx, event);
    });

    ctx.events.on("issue.comment.created", async (event: PluginEvent) => {
      await onCommentCreated(ctx, event);
    });

    ctx.events.on("approval.created", async (event: PluginEvent) => {
      await onApprovalCreated(ctx, event);
    });

    ctx.events.on("approval.decided", async (event: PluginEvent) => {
      await onApprovalDecided(ctx, event);
    });

    // Register bridge handlers
    await registerDataHandlers(ctx);
    await registerActionHandlers(ctx);
    await registerJobHandlers(ctx);

    // Periodic echo cleanup
    setInterval(cleanupExpired, 30_000);

    ctx.logger.info("Slack connector plugin initialized");
  },

  async onHealth(): Promise<PluginHealthDiagnostics> {
    const ctx = currentCtx;
    const config = ctx ? await getConfig(ctx) : {};
    return {
      status: config.botToken ? "ok" : "degraded",
      message: config.botToken ? "Slack connector ready" : "Slack bot token not configured",
      details: {
        hasToken: Boolean(config.botToken),
        hasDefaultChannel: Boolean(config.defaultChannel),
      },
    };
  },

  async onConfigChanged(newConfig) {
    const ctx = currentCtx;
    if (!ctx) return;
    const config = newConfig as SlackConnectorConfig;
    if (config.botToken) {
      slack = createSlackClient(ctx, async () => {
        return await ctx.secrets.resolve(config.botToken!);
      });
      ctx.logger.info("Slack client reconfigured");
    }
  },

  async onWebhook(input: PluginWebhookInput) {
    const ctx = currentCtx;
    if (!ctx) return;

    // Verify Slack signature — reject all requests without a signing secret
    const config = await getConfig(ctx);
    if (!config.signingSecret) {
      ctx.logger.error("Slack signing secret not configured — rejecting webhook");
      await ctx.metrics.write("slack.inbound.signature_failed", 1);
      return;
    }
    {
      const headers = (input as unknown as Record<string, unknown>).headers as Record<string, string> | undefined;
      const signature = headers?.["x-slack-signature"] ?? "";
      const timestamp = headers?.["x-slack-request-timestamp"] ?? "";
      const signingSecret = await ctx.secrets.resolve(config.signingSecret);

      if (!verifySlackSignature({
        signingSecret,
        signature,
        timestamp,
        rawBody: input.rawBody ?? "",
      })) {
        ctx.logger.warn("Slack webhook signature verification failed", {
          endpointKey: input.endpointKey,
        });
        await ctx.metrics.write("slack.inbound.signature_failed", 1);
        return;
      }
    }

    switch (input.endpointKey) {
      case WEBHOOK_KEYS.slackCommands:
        await handleSlackCommand(ctx, input);
        break;
      case WEBHOOK_KEYS.slackEvents:
        await handleSlackEvent(ctx, input);
        break;
      case WEBHOOK_KEYS.slackInteractive:
        await handleSlackInteractive(ctx, input);
        break;
      default:
        ctx.logger.warn("Unknown webhook endpoint", { endpointKey: input.endpointKey });
    }
  },

  async onShutdown() {
    currentCtx = null;
    slack = null;
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
