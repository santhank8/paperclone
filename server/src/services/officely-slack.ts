// Handles the Slack connection check and the lightweight customer-feedback pull for Officely.
import { unprocessable } from "../errors.js";

const SLACK_API_BASE_URL = "https://slack.com/api";
const SLACK_API_TIMEOUT_MS = 15_000;
const SLACK_DEFAULT_FEEDBACK_LOOKBACK_DAYS = 365;
const SLACK_HISTORY_LIMIT = 200;
const SLACK_CHANNEL_PAGE_LIMIT = 200;

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function validateSlackBotToken(botToken: string) {
  const normalized = botToken.trim();
  if (!normalized.startsWith("xoxb-")) {
    throw unprocessable("Slack needs a bot token that starts with xoxb-.");
  }
  return normalized;
}

function validateSlackAppToken(appToken: string) {
  const normalized = appToken.trim();
  if (!normalized.startsWith("xapp-")) {
    throw unprocessable("Slack needs an app token that starts with xapp-.");
  }
  return normalized;
}

async function readResponseBody(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function fetchWithTimeout(input: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SLACK_API_TIMEOUT_MS);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw unprocessable("Slack took too long to respond. Try again in a moment.");
    }
    throw unprocessable("Slack could not be reached. Check the connection and try again.");
  } finally {
    clearTimeout(timeout);
  }
}

async function callSlackApi(input: {
  token: string;
  path: string;
  method?: "GET" | "POST";
}) {
  const response = await fetchWithTimeout(`${SLACK_API_BASE_URL}${input.path}`, {
    method: input.method ?? "POST",
    headers: {
      authorization: `Bearer ${input.token}`,
      accept: "application/json",
    },
  });
  const body = await readResponseBody(response);

  if (!response.ok) {
    throw unprocessable("Slack rejected the connection. Check the token and try again.");
  }

  if (!isRecord(body) || body.ok !== true) {
    const errorCode = isRecord(body) ? asString(body.error) : null;
    if (errorCode === "invalid_auth" || errorCode === "not_authed") {
      throw unprocessable("Slack rejected the token. Check that you pasted the right one.");
    }
    throw unprocessable(`Slack returned an error${errorCode ? `: ${errorCode}` : ""}.`);
  }

  return body;
}

function normalizeSlackText(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slackTimestampToIso(value: string | null) {
  if (!value) return new Date().toISOString();
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return new Date(numeric * 1000).toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

type SlackChannelBucket = "customer_feedback" | "tech_issues" | "other";

function classifySlackChannelBucket(channelName: string | null): SlackChannelBucket {
  const normalized = channelName?.trim().toLowerCase().replace(/[_\s]+/g, "-") ?? "";
  if (!normalized) return "other";
  if (
    normalized.includes("customer-feedback") ||
    normalized.includes("customer-voice") ||
    normalized.includes("voice-of-customer") ||
    normalized === "feedback" ||
    normalized.endsWith("-feedback")
  ) {
    return "customer_feedback";
  }
  if (
    normalized.includes("tech-issues") ||
    normalized.includes("technical-issues") ||
    normalized.includes("bug") ||
    normalized.includes("incident") ||
    normalized.includes("engineering-support")
  ) {
    return "tech_issues";
  }
  return "other";
}

function classifySlackFeedback(text: string) {
  const normalized = text.toLowerCase();
  const categories: string[] = [];
  const addCategory = (category: string, phrases: string[]) => {
    if (phrases.some((phrase) => normalized.includes(phrase))) {
      categories.push(category);
    }
  };

  addCategory("bug", ["bug", "broken", "error", "issue", "problem", "not working", "crash", "failing", "failure"]);
  addCategory("feature_request", ["feature request", "can you add", "could you add", "would love", "missing", "integration", "support for", "please add"]);
  addCategory("churn_risk", ["cancel", "cancelling", "churn", "leave", "leaving", "not renew", "refund", "switch away", "too expensive"]);
  addCategory("praise", ["love", "great", "amazing", "awesome", "thanks", "thank you", "helpful"]);
  addCategory("support", ["help", "question", "how do", "how can", "confused", "stuck"]);

  return [...new Set(categories)];
}

export interface OfficelySlackFeedbackPreview {
  checkedAt: string;
  channelId: string | null;
  channelsReviewed: number;
  channelsWithMessages: number;
  messageCount: number;
  customerMessageCount: number;
  customerFeedbackMessages: number;
  techIssueMessages: number;
  bugMentions: number;
  featureRequestMentions: number;
  churnRiskMentions: number;
  praiseMentions: number;
  supportMentions: number;
  highlights: Array<{
    postedAt: string;
    channelName: string | null;
    channelBucket: SlackChannelBucket;
    authorLabel: string | null;
    text: string;
    categories: string[];
  }>;
}

export interface OfficelySlackPreview {
  teamId: string | null;
  teamName: string | null;
  botUserId: string | null;
  botUserName: string | null;
  appId: string | null;
  checkedAt: string;
}

export async function loadOfficelySlackConnection(input: {
  botToken: string;
  appToken: string;
}): Promise<OfficelySlackPreview> {
  const botToken = validateSlackBotToken(input.botToken);
  const appToken = validateSlackAppToken(input.appToken);

  const [authBody, appBody] = await Promise.all([
    callSlackApi({
      token: botToken,
      path: "/auth.test",
    }),
    callSlackApi({
      token: appToken,
      path: "/apps.connections.open",
    }),
  ]);

  return {
    teamId: asString(authBody.team_id),
    teamName: asString(authBody.team),
    botUserId: asString(authBody.user_id),
    botUserName: asString(authBody.user),
    appId: asString(appBody.app_id),
    checkedAt: new Date().toISOString(),
  };
}

export async function loadOfficelySlackFeedback(input: {
  botToken: string;
  channelId?: string | null;
  lookbackDays?: number;
}): Promise<OfficelySlackFeedbackPreview> {
  const botToken = validateSlackBotToken(input.botToken);
  const lookbackDays = Number.isFinite(input.lookbackDays)
    ? Math.max(1, Math.min(365, Math.trunc(input.lookbackDays!)))
    : SLACK_DEFAULT_FEEDBACK_LOOKBACK_DAYS;
  const oldest = `${Math.floor(Date.now() / 1000) - lookbackDays * 24 * 60 * 60}`;

  const channels: Array<{ id: string; name: string | null; bucket: SlackChannelBucket }> = [];
  let cursor: string | null = null;

  do {
    const query = new URLSearchParams({
      types: "public_channel,private_channel,mpim,im",
      exclude_archived: "true",
      limit: String(SLACK_CHANNEL_PAGE_LIMIT),
    });
    if (cursor) query.set("cursor", cursor);

    const body = await callSlackApi({
      token: botToken,
      method: "GET",
      path: `/conversations.list?${query.toString()}`,
    });

    const pageChannels = Array.isArray(body.channels) ? body.channels.filter(isRecord) : [];
    for (const channel of pageChannels) {
      const channelId = asString(channel.id);
      if (!channelId) continue;
      const isMember = channel.is_member === true;
      if (!isMember) continue;
      const channelName = asString(channel.name);
      channels.push({
        id: channelId,
        name: channelName,
        bucket: classifySlackChannelBucket(channelName),
      });
    }

    cursor = isRecord(body.response_metadata)
      ? asString(body.response_metadata.next_cursor)
      : null;
  } while (cursor);

  const defaultChannelId = input.channelId?.trim() || null;

  if (channels.length === 0) {
    throw unprocessable("Slack could not find any joined channels to read. Invite the bot to the customer channels first.");
  }

  const messages: Array<{
    postedAt: string;
    channelId: string;
    channelName: string | null;
    channelBucket: SlackChannelBucket;
    authorLabel: string | null;
    text: string;
    categories: string[];
  }> = [];
  let channelsWithMessages = 0;

  for (const channel of channels) {
    let historyCursor: string | null = null;
    const customerMessages: typeof messages = [];

    do {
      const query = new URLSearchParams({
        channel: channel.id,
        limit: String(SLACK_HISTORY_LIMIT),
        oldest,
        inclusive: "true",
      });
      if (historyCursor) query.set("cursor", historyCursor);

      const body = await callSlackApi({
        token: botToken,
        method: "GET",
        path: `/conversations.history?${query.toString()}`,
      });

      const historyMessages = Array.isArray(body.messages) ? body.messages.filter(isRecord) : [];
      customerMessages.push(
        ...historyMessages
          .filter((message) => !asString(message.bot_id))
          .filter((message) => !asString(message.subtype))
          .map((message) => {
            const text = normalizeSlackText(asString(message.text) ?? "");
            return {
              postedAt: slackTimestampToIso(asString(message.ts)),
              channelId: channel.id,
              channelName: channel.name,
              channelBucket: channel.bucket,
              authorLabel: asString(message.username) ?? asString(message.user),
              text,
              categories: classifySlackFeedback(text),
            };
          })
          .filter((message) => message.text.length > 0),
      );

      historyCursor = isRecord(body.response_metadata)
        ? asString(body.response_metadata.next_cursor)
        : null;
    } while (historyCursor);

    if (customerMessages.length > 0) {
      channelsWithMessages += 1;
      messages.push(...customerMessages);
    }
  }

  return {
    checkedAt: new Date().toISOString(),
    channelId: defaultChannelId,
    channelsReviewed: channels.length,
    channelsWithMessages,
    messageCount: messages.length,
    customerMessageCount: messages.length,
    customerFeedbackMessages: messages.filter((message) => message.channelBucket === "customer_feedback").length,
    techIssueMessages: messages.filter((message) => message.channelBucket === "tech_issues").length,
    bugMentions: messages.filter((message) => message.categories.includes("bug")).length,
    featureRequestMentions: messages.filter((message) => message.categories.includes("feature_request")).length,
    churnRiskMentions: messages.filter((message) => message.categories.includes("churn_risk")).length,
    praiseMentions: messages.filter((message) => message.categories.includes("praise")).length,
    supportMentions: messages.filter((message) => message.categories.includes("support")).length,
    highlights: messages
      .filter((message) => message.categories.length > 0)
      .slice(0, 5),
  };
}
