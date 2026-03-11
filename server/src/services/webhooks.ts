import crypto from "node:crypto";
import { and, eq, desc } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  webhookConfigs,
  webhookActionRules,
  webhookEventLog,
  webhookIssueLinks,
} from "@paperclipai/db";
import type {
  CreateWebhookConfig,
  UpdateWebhookConfig,
  CreateWebhookActionRule,
  UpdateWebhookActionRule,
  CreateWebhookIssueLink,
} from "@paperclipai/shared";
import { conflict } from "../errors.js";

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function webhookService(db: Db) {
  async function getConfigById(id: string) {
    return db
      .select()
      .from(webhookConfigs)
      .where(eq(webhookConfigs.id, id))
      .then((rows) => rows[0] ?? null);
  }

  async function getConfigByToken(token: string) {
    return db
      .select()
      .from(webhookConfigs)
      .where(eq(webhookConfigs.token, token))
      .then((rows) => rows[0] ?? null);
  }

  return {
    getConfigById,
    getConfigByToken,

    listConfigs: async (companyId: string) => {
      return db
        .select()
        .from(webhookConfigs)
        .where(eq(webhookConfigs.companyId, companyId))
        .orderBy(desc(webhookConfigs.createdAt));
    },

    createConfig: async (companyId: string, input: CreateWebhookConfig) => {
      const existing = await db
        .select()
        .from(webhookConfigs)
        .where(and(eq(webhookConfigs.companyId, companyId), eq(webhookConfigs.name, input.name)))
        .then((rows) => rows[0] ?? null);
      if (existing) throw conflict(`Webhook config with name "${input.name}" already exists`);

      const [created] = await db
        .insert(webhookConfigs)
        .values({
          companyId,
          name: input.name,
          provider: input.provider ?? "github",
          projectId: input.projectId ?? null,
          token: generateToken(),
          secret: input.secret ?? null,
          enabled: true,
        })
        .returning();
      return created;
    },

    updateConfig: async (id: string, patch: UpdateWebhookConfig) => {
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (patch.name !== undefined) updates.name = patch.name;
      if (patch.provider !== undefined) updates.provider = patch.provider;
      if (patch.projectId !== undefined) updates.projectId = patch.projectId;
      if (patch.secret !== undefined) updates.secret = patch.secret;
      if (patch.enabled !== undefined) updates.enabled = patch.enabled;

      const [updated] = await db
        .update(webhookConfigs)
        .set(updates)
        .where(eq(webhookConfigs.id, id))
        .returning();
      return updated ?? null;
    },

    removeConfig: async (id: string) => {
      const [deleted] = await db
        .delete(webhookConfigs)
        .where(eq(webhookConfigs.id, id))
        .returning();
      return deleted ?? null;
    },

    regenerateToken: async (id: string) => {
      const [updated] = await db
        .update(webhookConfigs)
        .set({ token: generateToken(), updatedAt: new Date() })
        .where(eq(webhookConfigs.id, id))
        .returning();
      return updated ?? null;
    },

    // Action rules
    listRules: async (webhookConfigId: string) => {
      return db
        .select()
        .from(webhookActionRules)
        .where(eq(webhookActionRules.webhookConfigId, webhookConfigId))
        .orderBy(desc(webhookActionRules.createdAt));
    },

    createRule: async (webhookConfigId: string, input: CreateWebhookActionRule) => {
      const [created] = await db
        .insert(webhookActionRules)
        .values({
          webhookConfigId,
          eventType: input.eventType,
          action: input.action,
          actionParams: input.actionParams ?? {},
          enabled: input.enabled ?? true,
        })
        .returning();
      return created;
    },

    getRuleById: async (id: string) => {
      return db
        .select()
        .from(webhookActionRules)
        .where(eq(webhookActionRules.id, id))
        .then((rows) => rows[0] ?? null);
    },

    updateRule: async (id: string, patch: UpdateWebhookActionRule) => {
      const updates: Record<string, unknown> = {};
      if (patch.eventType !== undefined) updates.eventType = patch.eventType;
      if (patch.action !== undefined) updates.action = patch.action;
      if (patch.actionParams !== undefined) updates.actionParams = patch.actionParams;
      if (patch.enabled !== undefined) updates.enabled = patch.enabled;

      const [updated] = await db
        .update(webhookActionRules)
        .set(updates)
        .where(eq(webhookActionRules.id, id))
        .returning();
      return updated ?? null;
    },

    removeRule: async (id: string) => {
      const [deleted] = await db
        .delete(webhookActionRules)
        .where(eq(webhookActionRules.id, id))
        .returning();
      return deleted ?? null;
    },

    // Event log
    listEvents: async (companyId: string, limit = 100) => {
      return db
        .select()
        .from(webhookEventLog)
        .where(eq(webhookEventLog.companyId, companyId))
        .orderBy(desc(webhookEventLog.createdAt))
        .limit(limit);
    },

    logEvent: async (data: {
      webhookConfigId: string | null;
      companyId: string;
      provider: string;
      eventType: string;
      deliveryId?: string | null;
      payload?: Record<string, unknown>;
      headers?: Record<string, unknown>;
      status: string;
      errorMessage?: string | null;
      matchedIssues?: Record<string, unknown>[];
      processingMs?: number;
    }) => {
      const [event] = await db
        .insert(webhookEventLog)
        .values({
          webhookConfigId: data.webhookConfigId,
          companyId: data.companyId,
          provider: data.provider,
          eventType: data.eventType,
          deliveryId: data.deliveryId ?? null,
          payload: data.payload,
          headers: data.headers,
          status: data.status,
          errorMessage: data.errorMessage ?? null,
          matchedIssues: data.matchedIssues,
          processingMs: data.processingMs,
        })
        .returning();
      return event;
    },

    updateEventStatus: async (
      id: string,
      status: string,
      extra?: { errorMessage?: string; matchedIssues?: Record<string, unknown>[]; processingMs?: number },
    ) => {
      const updates: Record<string, unknown> = { status };
      if (extra?.errorMessage !== undefined) updates.errorMessage = extra.errorMessage;
      if (extra?.matchedIssues !== undefined) updates.matchedIssues = extra.matchedIssues;
      if (extra?.processingMs !== undefined) updates.processingMs = extra.processingMs;

      const [updated] = await db
        .update(webhookEventLog)
        .set(updates)
        .where(eq(webhookEventLog.id, id))
        .returning();
      return updated ?? null;
    },

    // Issue links
    listIssueLinks: async (issueId: string) => {
      return db
        .select()
        .from(webhookIssueLinks)
        .where(eq(webhookIssueLinks.issueId, issueId));
    },

    createIssueLink: async (companyId: string, issueId: string, input: CreateWebhookIssueLink) => {
      const [created] = await db
        .insert(webhookIssueLinks)
        .values({
          companyId,
          issueId,
          provider: input.provider,
          externalType: input.externalType,
          externalId: input.externalId,
        })
        .returning();
      return created;
    },

    getIssueLinkById: async (id: string) => {
      return db
        .select()
        .from(webhookIssueLinks)
        .where(eq(webhookIssueLinks.id, id))
        .then((rows) => rows[0] ?? null);
    },

    removeIssueLink: async (id: string) => {
      const [deleted] = await db
        .delete(webhookIssueLinks)
        .where(eq(webhookIssueLinks.id, id))
        .returning();
      return deleted ?? null;
    },
  };
}
