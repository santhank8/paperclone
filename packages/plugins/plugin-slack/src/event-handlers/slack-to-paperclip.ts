import type { PluginContext } from "@paperclipai/plugin-sdk";
import type {
  SlackConfig,
  SlackEventEnvelope,
  SlackMessageEvent,
  SlackReactionEvent,
  SlackAppMentionEvent,
} from "../types.js";
import { SlackClient } from "../slack-client.js";
import { buildAgentMaps, isOurBot, resolveToken, findChannelMapping } from "../sync/agent-mapper.js";
import {
  saveThread,
  saveThreadReverse,
  getIssueIdForThread,
  isEventProcessed,
  markEventProcessed,
} from "../sync/thread-mapper.js";
import {
  issueToSlackBlocks,
  issueCreatedConfirmation,
} from "../utils/message-format.js";
import { EMOJI_TO_STATUS, PLUGIN_ID } from "../constants.js";

// ---------------------------------------------------------------------------
// Main router
// ---------------------------------------------------------------------------

export async function handleSlackEvent(
  ctx: PluginContext,
  config: SlackConfig,
  envelope: SlackEventEnvelope,
): Promise<void> {
  // URL verification challenge — log the challenge so the operator can retrieve it
  if (envelope.type === "url_verification") {
    ctx.logger.info("Slack URL verification challenge received", { challenge: envelope.challenge });
    return;
  }

  const event = envelope.event;
  if (!event) return;

  const eventId = (event as { event_id?: string }).event_id;
  if (eventId) {
    if (await isEventProcessed(ctx, eventId)) return;
    await markEventProcessed(ctx, eventId);
  }

  const maps = buildAgentMaps(config);

  switch (event.type) {
    case "app_mention":
      await handleMention(ctx, config, maps, event as SlackAppMentionEvent, envelope.team_id);
      break;

    case "message": {
      const msg = event as SlackMessageEvent;
      // Ignore edited/deleted/bot_message subtypes
      if (msg.subtype) return;
      // Echo prevention: ignore messages from our own bots
      if (msg.bot_id && isOurBot(msg.bot_id, maps)) return;
      if (msg.user && isOurBot(msg.user, maps)) return;

      if (msg.channel_type === "im") {
        await handleDM(ctx, config, maps, msg);
      } else if (msg.thread_ts && msg.thread_ts !== msg.ts) {
        // Reply in a thread — add comment to existing issue
        await handleThreadReply(ctx, config, maps, msg);
      }
      // Regular channel message (not a mention, not a thread reply) → no issue created
      break;
    }

    case "reaction_added":
      await handleReaction(ctx, config, maps, event as SlackReactionEvent);
      break;
  }
}

// ---------------------------------------------------------------------------
// @mention in a channel → create issue assigned to the mentioned agent
// ---------------------------------------------------------------------------

async function handleMention(
  ctx: PluginContext,
  config: SlackConfig,
  maps: ReturnType<typeof buildAgentMaps>,
  event: SlackAppMentionEvent,
  teamId: string | undefined,
): Promise<void> {
  // Identify which agent was mentioned via api_app_id → botUserId lookup isn't direct,
  // so we use the channel mapping to find the project, and assignee = default agent
  const mapping = findChannelMapping(config, event.channel);
  const agentToken = resolveToken(config, maps, config.defaultAgentId);
  if (!agentToken) return;

  const companyId = await resolveCompanyId(ctx);
  if (!companyId) return;

  const title = cleanMentionText(event.text).slice(0, 120) || "Task from Slack mention";
  const description = `Slack mention in <#${event.channel}> by <@${event.user}>\n\n${event.text}`;

  const issue = await ctx.issues.create({
    companyId,
    projectId: mapping?.paperclipProjectId,
    title,
    description,
    assigneeAgentId: config.defaultAgentId ?? undefined,
  });

  // Post tracking reaction on the original message
  const client = new SlackClient(agentToken, ctx.http);
  await client.addReaction(event.channel, event.ts, "pencil").catch(() => {});

  // Post issue card as a reply in thread
  const url = buildIssueUrl(companyId, issue.id);
  const projectName = mapping?.channelName ?? "Slack";
  const res = await client.postMessage(
    event.channel,
    issueCreatedConfirmation(issue, url),
    issueToSlackBlocks(issue, projectName, url),
    event.thread_ts ?? event.ts,
  );

  await saveThread(ctx, issue.id, {
    channelId: event.channel,
    threadTs: res.ts,
    slackUrl: buildSlackUrl(teamId, event.channel, res.ts),
    createdAt: new Date().toISOString(),
  });
  await saveThreadReverse(ctx, event.channel, res.ts, issue.id);

  await ctx.activity.log({
    companyId,
    entityType: "issue",
    entityId: issue.id,
    message: `Issue created from Slack mention in <#${event.channel}>`,
    metadata: { plugin: PLUGIN_ID, slackChannel: event.channel, slackTs: event.ts },
  });
}

// ---------------------------------------------------------------------------
// Direct message to a bot → create issue assigned to that agent
// ---------------------------------------------------------------------------

async function handleDM(
  ctx: PluginContext,
  config: SlackConfig,
  maps: ReturnType<typeof buildAgentMaps>,
  event: SlackMessageEvent,
): Promise<void> {
  // In a DM, we can't directly map channel → agent bot user ID without a lookup.
  // We use the default agent as the assignee and first bot token to reply.
  const agentToken = resolveToken(config, maps, config.defaultAgentId);
  if (!agentToken) return;

  const companyId = await resolveCompanyId(ctx);
  if (!companyId) return;

  const title = (event.text ?? "").slice(0, 120) || "Task from Slack DM";
  const description = `Slack DM from <@${event.user ?? "unknown"}>\n\n${event.text ?? ""}`;

  const issue = await ctx.issues.create({
    companyId,
    title,
    description,
    assigneeAgentId: config.defaultAgentId ?? undefined,
  });

  const url = buildIssueUrl(companyId, issue.id);
  const client = new SlackClient(agentToken, ctx.http);
  await client.postMessage(event.channel, issueCreatedConfirmation(issue, url));

  await ctx.activity.log({
    companyId,
    entityType: "issue",
    entityId: issue.id,
    message: "Issue created from Slack DM",
    metadata: { plugin: PLUGIN_ID, slackChannel: event.channel, slackTs: event.ts },
  });
}

// ---------------------------------------------------------------------------
// Thread reply → add comment to existing Paperclip issue
// ---------------------------------------------------------------------------

async function handleThreadReply(
  ctx: PluginContext,
  config: SlackConfig,
  maps: ReturnType<typeof buildAgentMaps>,
  event: SlackMessageEvent,
): Promise<void> {
  if (!event.thread_ts) return;

  const issueId = await getIssueIdForThread(ctx, event.channel, event.thread_ts);
  if (!issueId) return; // thread not tracked by this plugin

  const companyId = await resolveCompanyId(ctx);
  if (!companyId) return;

  const body = `_Slack reply from <@${event.user ?? "unknown"}>_\n\n${event.text ?? ""}`;
  await ctx.issues.createComment(issueId, body, companyId);

  // Acknowledge with a ✅ reaction
  const agentToken = resolveToken(config, maps, config.defaultAgentId);
  if (agentToken) {
    const client = new SlackClient(agentToken, ctx.http);
    await client.addReaction(event.channel, event.ts, "white_check_mark").catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Reaction → update issue status
// ---------------------------------------------------------------------------

async function handleReaction(
  ctx: PluginContext,
  _config: SlackConfig,
  _maps: ReturnType<typeof buildAgentMaps>,
  event: SlackReactionEvent,
): Promise<void> {
  const newStatus = EMOJI_TO_STATUS[event.reaction];
  if (!newStatus) return;

  // Find issue linked to this message (covers both thread replies and the thread root itself)
  const issueId = await getIssueIdForThread(ctx, event.item.channel, event.item.ts);
  if (!issueId) return;

  const companyId = await resolveCompanyId(ctx);
  if (!companyId) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await ctx.issues.update(issueId, { status: newStatus as any }, companyId);

  await ctx.activity.log({
    companyId,
    entityType: "issue",
    entityId: issueId,
    message: `Issue status updated to "${newStatus}" via Slack reaction :${event.reaction}:`,
    metadata: { plugin: PLUGIN_ID, reaction: event.reaction },
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function resolveCompanyId(ctx: PluginContext): Promise<string | null> {
  const companies = await ctx.companies.list({ limit: 1, offset: 0 });
  return companies[0]?.id ?? null;
}

function cleanMentionText(text: string): string {
  // Remove <@Uxxxxxx> mentions and leading/trailing whitespace
  return text.replace(/<@[A-Z0-9]+>/g, "").replace(/\s+/g, " ").trim();
}

function buildIssueUrl(_companyId: string, _issueId: string): string {
  // The host doesn't provide a URL builder, so we return a placeholder.
  // In a real deployment you'd configure PAPERCLIP_URL in your env.
  const base = process.env.PAPERCLIP_URL ?? "https://app.paperclip.ai";
  return `${base}/issues/${_issueId}`;
}

function buildSlackUrl(teamId: string | undefined, channelId: string, ts: string): string {
  const tsFormatted = ts.replace(".", "");
  if (teamId) {
    return `https://slack.com/archives/${channelId}/p${tsFormatted}`;
  }
  return `https://slack.com/archives/${channelId}/p${tsFormatted}`;
}
