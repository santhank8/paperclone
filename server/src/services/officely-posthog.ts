// Handles the small PostHog verifier used by Officely analytics setup.
import { unprocessable } from "../errors.js";

const POSTHOG_DEFAULT_BASE_URL = "https://us.posthog.com";
const POSTHOG_DEFAULT_ACTIVITY_WINDOW_DAYS = 30;
const POSTHOG_API_TIMEOUT_MS = 15_000;
const SAFE_POSTHOG_TEXT_RE = /^[A-Za-z0-9 _./:+@#$\-[\]$]{1,120}$/;

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value.trim();
    if (normalized.length === 0) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function validateApiKey(apiKey: string) {
  const normalized = apiKey.trim();
  if (normalized.length === 0) {
    throw unprocessable("PostHog needs an API key.");
  }
  return normalized;
}

function validateProjectId(projectId: string) {
  const normalized = projectId.trim();
  if (!SAFE_POSTHOG_TEXT_RE.test(normalized)) {
    throw unprocessable("PostHog project ID contains unsupported characters.");
  }
  return normalized;
}

function validateEventName(eventName: string, label: string) {
  const normalized = eventName.trim();
  if (!SAFE_POSTHOG_TEXT_RE.test(normalized)) {
    throw unprocessable(`${label} contains unsupported characters.`);
  }
  return normalized;
}

function quoteHogQLString(value: string) {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function normalizeBaseUrl(baseUrl?: string | null) {
  const rawValue = baseUrl?.trim() || POSTHOG_DEFAULT_BASE_URL;
  let url: URL;

  try {
    url = new URL(rawValue);
  } catch {
    throw unprocessable("PostHog base URL must be a valid URL.");
  }

  const isLocalhost = ["localhost", "127.0.0.1"].includes(url.hostname);
  if (url.protocol !== "https:" && !(isLocalhost && url.protocol === "http:")) {
    throw unprocessable("PostHog base URL must use HTTPS.");
  }

  url.pathname = "";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function rowsFromQueryResponse(payload: unknown): JsonRecord[] {
  if (!isRecord(payload)) return [];
  const results = Array.isArray(payload.results) ? payload.results : [];
  const columns = Array.isArray(payload.columns) ? payload.columns : [];

  if (results.length > 0 && isRecord(results[0])) {
    return results.filter(isRecord);
  }

  if (columns.length === 0) return [];

  return results
    .filter((row): row is unknown[] => Array.isArray(row))
    .map((row) => Object.fromEntries(columns.map((column, index) => [String(column), row[index]])));
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
  const timeout = setTimeout(() => controller.abort(), POSTHOG_API_TIMEOUT_MS);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw unprocessable("PostHog took too long to respond. Try again in a moment.");
    }
    throw unprocessable("PostHog could not be reached. Check the connection and try again.");
  } finally {
    clearTimeout(timeout);
  }
}

async function runHogQLQuery(input: {
  apiKey: string;
  projectId: string;
  baseUrl: string;
  query: string;
}) {
  const response = await fetchWithTimeout(`${input.baseUrl}/api/projects/${input.projectId}/query/`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${input.apiKey}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      query: {
        kind: "HogQLQuery",
        query: input.query,
      },
    }),
  });
  const body = await readResponseBody(response);

  if (!response.ok) {
    const errorMessage =
      isRecord(body) && typeof body.detail === "string"
        ? body.detail
        : "PostHog rejected the query.";
    throw unprocessable(`${errorMessage} Check the API key, project ID, and base URL.`);
  }

  return rowsFromQueryResponse(body);
}

export interface OfficelyPostHogPreview {
  eventCount: number;
  activeUserTotal: number;
  onboardingEvent: string | null;
  onboardingEventCount: number;
  importantEvents: string[];
  importantEventCounts: Array<{ eventName: string; count: number }>;
  checkedAt: string;
}

export async function loadOfficelyPostHogProject(input: {
  apiKey: string;
  projectId: string;
  baseUrl?: string | null;
  onboardingEvent?: string | null;
  importantEvents?: string[];
  activityWindowDays?: number;
}): Promise<OfficelyPostHogPreview> {
  const apiKey = validateApiKey(input.apiKey);
  const projectId = validateProjectId(input.projectId);
  const baseUrl = normalizeBaseUrl(input.baseUrl);
  const activityWindowDays = Number.isFinite(input.activityWindowDays)
    ? Math.max(1, Math.min(365, Math.trunc(input.activityWindowDays!)))
    : POSTHOG_DEFAULT_ACTIVITY_WINDOW_DAYS;
  const onboardingEvent = input.onboardingEvent?.trim()
    ? validateEventName(input.onboardingEvent, "PostHog onboarding event")
    : null;
  const importantEvents = [...new Set((input.importantEvents ?? [])
    .map((eventName) => eventName.trim())
    .filter((eventName) => eventName.length > 0)
    .map((eventName) => validateEventName(eventName, "PostHog important event")))]
    .slice(0, 8);

  const summaryRows = await runHogQLQuery({
    apiKey,
    projectId,
    baseUrl,
    query: [
      "SELECT",
      "  count() AS event_count,",
      "  uniq(distinct_id) AS active_users",
      "FROM events",
      `WHERE timestamp >= now() - INTERVAL ${activityWindowDays} DAY`,
    ].join("\n"),
  });
  const eventRows = (onboardingEvent || importantEvents.length > 0)
    ? await runHogQLQuery({
        apiKey,
        projectId,
        baseUrl,
        query: [
          "SELECT",
          "  event,",
          "  count() AS event_count",
          "FROM events",
          `WHERE timestamp >= now() - INTERVAL ${activityWindowDays} DAY`,
          `  AND event IN (${[onboardingEvent, ...importantEvents].filter((value): value is string => Boolean(value)).map((value) => quoteHogQLString(value)).join(", ")})`,
          "GROUP BY event",
          "ORDER BY event_count DESC",
        ].join("\n"),
      })
    : [];

  const row = summaryRows[0] ?? {};
  const countsByEvent = new Map(
    eventRows
      .map((eventRow) => {
        const eventName = asString(eventRow.event);
        const count = Math.max(0, Math.trunc(asNumber(eventRow.event_count) ?? 0));
        return eventName ? [eventName, count] as const : null;
      })
      .filter((entry): entry is readonly [string, number] => Boolean(entry)),
  );

  return {
    eventCount: Math.max(0, Math.trunc(asNumber(row.event_count) ?? 0)),
    activeUserTotal: Math.max(0, Math.trunc(asNumber(row.active_users) ?? 0)),
    onboardingEvent,
    onboardingEventCount: onboardingEvent ? (countsByEvent.get(onboardingEvent) ?? 0) : 0,
    importantEvents,
    importantEventCounts: importantEvents.map((eventName) => ({
      eventName,
      count: countsByEvent.get(eventName) ?? 0,
    })),
    checkedAt: new Date().toISOString(),
  };
}
