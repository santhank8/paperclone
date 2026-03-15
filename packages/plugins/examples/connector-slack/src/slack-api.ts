/**
 * Minimal Slack Web API client that uses ctx.http.fetch for outbound calls.
 * All methods are thin wrappers around Slack's JSON API.
 */

import type { PluginContext } from "@paperclipai/plugin-sdk";
import { STATUS_DISPLAY, PRIORITY_DISPLAY } from "./constants.js";

type SlackBlock = Record<string, unknown>;

export interface SlackApiClient {
  postMessage(channel: string, text: string, blocks?: SlackBlock[], threadTs?: string): Promise<{ ts: string; channel: string }>;
  updateMessage(channel: string, ts: string, text: string, blocks?: SlackBlock[]): Promise<void>;
  addReaction(channel: string, ts: string, name: string): Promise<void>;
}

export function createSlackClient(ctx: PluginContext, getToken: () => Promise<string>): SlackApiClient {
  async function slackPost(method: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const token = await getToken();
    const response = await ctx.http.fetch(`https://slack.com/api/${method}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const data = (await response.json()) as Record<string, unknown>;
    if (!data.ok) {
      ctx.logger.error(`Slack API error: ${method}`, { error: data.error });
      throw new Error(`Slack API ${method} failed: ${data.error}`);
    }
    return data;
  }

  return {
    async postMessage(channel, text, blocks, threadTs) {
      const body: Record<string, unknown> = { channel, text };
      if (blocks) body.blocks = blocks;
      if (threadTs) body.thread_ts = threadTs;
      const data = await slackPost("chat.postMessage", body);
      return { ts: data.ts as string, channel: data.channel as string };
    },

    async updateMessage(channel, ts, text, blocks) {
      const body: Record<string, unknown> = { channel, ts, text };
      if (blocks) body.blocks = blocks;
      await slackPost("chat.update", body);
    },

    async addReaction(channel, ts, name) {
      await slackPost("reactions.add", { channel, timestamp: ts, name });
    },
  };
}

/** Build Block Kit blocks for an issue message. */
export function buildIssueBlocks(issue: {
  id: string;
  identifier?: string | null;
  title: string;
  status: string;
  priority: string;
  assigneeAgentId?: string | null;
  description?: string | null;
}, dashboardUrl?: string): SlackBlock[] {
  const status = STATUS_DISPLAY[issue.status] ?? { emoji: "❓", label: issue.status };
  const priority = PRIORITY_DISPLAY[issue.priority] ?? { emoji: "❓", label: issue.priority };

  const blocks: SlackBlock[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${issue.identifier ?? issue.id}*: ${issue.title}`,
      },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Status:* ${status.emoji} ${status.label}` },
        { type: "mrkdwn", text: `*Priority:* ${priority.emoji} ${priority.label}` },
      ],
    },
  ];

  if (issue.description) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: issue.description.length > 200
          ? `${issue.description.slice(0, 200)}...`
          : issue.description,
      },
    });
  }

  // Action buttons for status transitions
  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        text: { type: "plain_text", text: "✅ Done" },
        action_id: "paperclip_status_done",
        value: issue.id,
        style: "primary",
      },
      {
        type: "button",
        text: { type: "plain_text", text: "🚀 Start" },
        action_id: "paperclip_status_in_progress",
        value: issue.id,
      },
      {
        type: "button",
        text: { type: "plain_text", text: "🔴 Block" },
        action_id: "paperclip_status_blocked",
        value: issue.id,
        style: "danger",
      },
    ],
  });

  if (dashboardUrl) {
    blocks.push({
      type: "context",
      elements: [
        { type: "mrkdwn", text: `<${dashboardUrl}|View in Paperclip>` },
      ],
    });
  }

  return blocks;
}

/** Build Block Kit blocks for an approval request. */
export function buildApprovalBlocks(approval: {
  id: string;
  title: string;
  description?: string;
}): SlackBlock[] {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `🎫 *Approval Required:* ${approval.title}`,
      },
    },
    ...(approval.description
      ? [{
          type: "section",
          text: { type: "mrkdwn", text: approval.description },
        }]
      : []),
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "✅ Approve" },
          action_id: "paperclip_approve",
          value: approval.id,
          style: "primary",
        },
        {
          type: "button",
          text: { type: "plain_text", text: "❌ Reject" },
          action_id: "paperclip_reject",
          value: approval.id,
          style: "danger",
        },
      ],
    },
  ];
}
