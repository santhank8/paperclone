import type { Db } from "@paperclipai/db";
import { githubProvider } from "../lib/webhook-providers/github.js";
import type { NormalizedWebhookEvent, WebhookProviderHandler } from "../lib/webhook-providers/types.js";
import { webhookService } from "./webhooks.js";
import { webhookIssueResolverService } from "./webhook-issue-resolver.js";
import { webhookActionExecutor } from "./webhook-actions.js";
import { publishLiveEvent } from "./live-events.js";

const providers: Record<string, WebhookProviderHandler> = {
  github: githubProvider,
};

export function webhookDispatcher(db: Db) {
  const svc = webhookService(db);
  const resolver = webhookIssueResolverService(db);
  const actions = webhookActionExecutor(db);

  return {
    async dispatch(
      token: string,
      rawBody: Buffer,
      headers: Record<string, string | string[] | undefined>,
    ): Promise<{ ok: boolean; eventId?: string; error?: string }> {
      const startMs = Date.now();

      // Look up config by token
      const config = await svc.getConfigByToken(token);
      if (!config) {
        return { ok: false, error: "Unknown webhook token" };
      }

      if (!config.enabled) {
        return { ok: false, error: "Webhook is disabled" };
      }

      const provider = providers[config.provider];

      // Parse the raw body as JSON
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(rawBody.toString("utf-8"));
      } catch {
        const event = await svc.logEvent({
          webhookConfigId: config.id,
          companyId: config.companyId,
          provider: config.provider,
          eventType: "unknown",
          status: "failed",
          errorMessage: "Invalid JSON payload",
          headers: sanitizeHeaders(headers),
        });
        return { ok: false, eventId: event.id, error: "Invalid JSON payload" };
      }

      // Verify signature if secret is configured
      if (config.secret && provider) {
        const signature =
          (headers["x-hub-signature-256"] as string) ??
          (headers["x-gitlab-token"] as string);
        if (!provider.verifySignature(rawBody, signature, config.secret)) {
          const event = await svc.logEvent({
            webhookConfigId: config.id,
            companyId: config.companyId,
            provider: config.provider,
            eventType: "unknown",
            status: "failed",
            errorMessage: "Signature verification failed",
            payload,
            headers: sanitizeHeaders(headers),
          });
          return { ok: false, eventId: event.id, error: "Signature verification failed" };
        }
      }

      // Parse event
      const eventHeader =
        (headers["x-github-event"] as string) ??
        (headers["x-gitlab-event"] as string) ??
        "unknown";
      const deliveryId =
        (headers["x-github-delivery"] as string) ??
        (headers["x-gitlab-delivery"] as string) ??
        null;

      let normalized: NormalizedWebhookEvent;
      if (provider) {
        normalized = provider.parseEvent(eventHeader, payload);
      } else {
        // Generic provider — pass through
        normalized = {
          eventType: eventHeader,
          branches: [],
          prNumbers: [],
          prTitle: null,
          prBody: null,
          repoFullName: null,
          conclusion: null,
          sender: null,
          raw: payload,
        };
      }

      // Log event
      const event = await svc.logEvent({
        webhookConfigId: config.id,
        companyId: config.companyId,
        provider: config.provider,
        eventType: normalized.eventType,
        deliveryId,
        payload,
        headers: sanitizeHeaders(headers),
        status: "received",
      });

      try {
        // Resolve matching issues (scoped to project if configured)
        const resolvedIssues = await resolver.resolve(
          normalized,
          config.companyId,
          config.provider,
          config.projectId,
        );

        // Get matching action rules
        const rules = await svc.listRules(config.id);
        const matchingRules = rules.filter(
          (r) => r.enabled && matchesEventType(normalized.eventType, r.eventType),
        );

        if (matchingRules.length === 0 || resolvedIssues.length === 0) {
          await svc.updateEventStatus(event.id, "ignored", {
            matchedIssues: resolvedIssues.map((i) => ({
              id: i.id,
              identifier: i.identifier,
              source: i.source,
            })),
            processingMs: Date.now() - startMs,
          });

          publishLiveEvent({
            companyId: config.companyId,
            type: "webhook.received",
            payload: { eventId: event.id, eventType: normalized.eventType, status: "ignored" },
          });

          return { ok: true, eventId: event.id };
        }

        // Execute actions for each matched issue × matching rule
        for (const issue of resolvedIssues) {
          for (const rule of matchingRules) {
            await actions.execute(rule.action, {
              issueId: issue.id,
              companyId: config.companyId,
              params: (rule.actionParams as Record<string, unknown>) ?? {},
            });
          }
        }

        await svc.updateEventStatus(event.id, "processed", {
          matchedIssues: resolvedIssues.map((i) => ({
            id: i.id,
            identifier: i.identifier,
            source: i.source,
          })),
          processingMs: Date.now() - startMs,
        });

        publishLiveEvent({
          companyId: config.companyId,
          type: "webhook.received",
          payload: {
            eventId: event.id,
            eventType: normalized.eventType,
            status: "processed",
            matchedIssues: resolvedIssues.length,
          },
        });

        return { ok: true, eventId: event.id };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Processing failed";
        await svc.updateEventStatus(event.id, "failed", {
          errorMessage,
          processingMs: Date.now() - startMs,
        });
        return { ok: false, eventId: event.id, error: errorMessage };
      }
    },
  };
}

function matchesEventType(actual: string, pattern: string): boolean {
  if (pattern === "*") return true;
  if (pattern.endsWith(".*")) {
    return actual.startsWith(pattern.slice(0, -1));
  }
  return actual === pattern;
}

function sanitizeHeaders(
  headers: Record<string, string | string[] | undefined>,
): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(headers)) {
    // Skip authorization-related headers
    if (key.toLowerCase() === "authorization" || key.toLowerCase() === "cookie") continue;
    safe[key] = value;
  }
  return safe;
}
