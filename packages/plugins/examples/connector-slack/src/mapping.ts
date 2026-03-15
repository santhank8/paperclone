/**
 * Mapping store — tracks Paperclip issue ID ↔ Slack thread ts.
 * Uses plugin scoped state: namespace="slack", scopeKind="issue".
 */

import type { PluginContext } from "@paperclipai/plugin-sdk";
import { STATE_NAMESPACE, STATE_KEYS } from "./constants.js";

export interface SlackMapping {
  threadTs: string;
  channelId: string;
  messageTs: string;
}

/** Save the Slack thread mapping for a Paperclip issue. */
export async function saveIssueMapping(
  ctx: PluginContext,
  issueId: string,
  mapping: SlackMapping,
): Promise<void> {
  await ctx.state.set(
    { scopeKind: "issue", scopeId: issueId, namespace: STATE_NAMESPACE, stateKey: STATE_KEYS.threadTs },
    mapping.threadTs,
  );
  await ctx.state.set(
    { scopeKind: "issue", scopeId: issueId, namespace: STATE_NAMESPACE, stateKey: STATE_KEYS.channelId },
    mapping.channelId,
  );
  await ctx.state.set(
    { scopeKind: "issue", scopeId: issueId, namespace: STATE_NAMESPACE, stateKey: STATE_KEYS.messageTs },
    mapping.messageTs,
  );
}

/** Load the Slack mapping for a Paperclip issue. Returns null if not mapped. */
export async function getIssueMapping(
  ctx: PluginContext,
  issueId: string,
): Promise<SlackMapping | null> {
  const threadTs = await ctx.state.get({
    scopeKind: "issue",
    scopeId: issueId,
    namespace: STATE_NAMESPACE,
    stateKey: STATE_KEYS.threadTs,
  }) as string | null;

  if (!threadTs) return null;

  const channelId = await ctx.state.get({
    scopeKind: "issue",
    scopeId: issueId,
    namespace: STATE_NAMESPACE,
    stateKey: STATE_KEYS.channelId,
  }) as string;

  const messageTs = await ctx.state.get({
    scopeKind: "issue",
    scopeId: issueId,
    namespace: STATE_NAMESPACE,
    stateKey: STATE_KEYS.messageTs,
  }) as string;

  return { threadTs, channelId, messageTs };
}

/**
 * Save a reverse mapping: Slack thread ts → Paperclip issue ID.
 * Used for inbound webhook lookups (thread reply → which issue?).
 */
export async function saveReverseMapping(
  ctx: PluginContext,
  threadTs: string,
  channelId: string,
  issueId: string,
): Promise<void> {
  await ctx.state.set(
    { scopeKind: "instance", namespace: STATE_NAMESPACE, stateKey: `reverse:${channelId}:${threadTs}` },
    issueId,
  );
}

/** Look up a Paperclip issue ID from a Slack channel + thread ts. */
export async function getIssueIdFromThread(
  ctx: PluginContext,
  channelId: string,
  threadTs: string,
): Promise<string | null> {
  return await ctx.state.get({
    scopeKind: "instance",
    namespace: STATE_NAMESPACE,
    stateKey: `reverse:${channelId}:${threadTs}`,
  }) as string | null;
}

/**
 * Get the default Slack channel for a project.
 * Stored as project-level plugin state.
 */
export async function getProjectChannel(
  ctx: PluginContext,
  projectId: string,
): Promise<string | null> {
  return await ctx.state.get({
    scopeKind: "project",
    scopeId: projectId,
    namespace: STATE_NAMESPACE,
    stateKey: "channel-id",
  }) as string | null;
}

/** Get the fallback default channel. */
export async function getDefaultChannel(ctx: PluginContext): Promise<string | null> {
  return await ctx.state.get({
    scopeKind: "instance",
    namespace: STATE_NAMESPACE,
    stateKey: "default-channel",
  }) as string | null;
}
