import type { PluginContext } from "@paperclipai/plugin-sdk";

export interface GoogleDrivePluginConfig {
  clientId: string;
  clientSecretSecretRef: string;
  refreshTokenSecretRef: string;
  defaultFolderId?: string;
  defaultUserEmail?: string;
  defaultPageSize?: number;
}

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface GoogleDocumentTextRun {
  content?: string;
}

interface GoogleDocumentParagraphElement {
  textRun?: GoogleDocumentTextRun;
}

interface GoogleDocumentParagraph {
  elements?: GoogleDocumentParagraphElement[];
}

interface GoogleDocumentContentBlock {
  endIndex?: number;
  paragraph?: GoogleDocumentParagraph;
  table?: {
    tableRows?: Array<{
      tableCells?: Array<{
        content?: GoogleDocumentContentBlock[];
      }>;
    }>;
  };
  tableOfContents?: {
    content?: GoogleDocumentContentBlock[];
  };
}

export interface GoogleDocumentResponse {
  title?: string;
  body?: {
    content?: GoogleDocumentContentBlock[];
  };
}

const DEFAULT_PAGE_SIZE = 10;
const TOKEN_SAFETY_MS = 30_000;
const DOC_TEXT_LIMIT = 12_000;
const accessTokenCache = new Map<string, { accessToken: string; expiresAt: number }>();

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function mapMimeTypeFilter(value: unknown): string | null {
  switch (value) {
    case "document":
      return "application/vnd.google-apps.document";
    case "folder":
      return "application/vnd.google-apps.folder";
    case "pdf":
      return "application/pdf";
    default:
      return null;
  }
}

function summarizeApiError(body: unknown): string {
  if (typeof body === "string" && body.trim().length > 0) {
    return body.slice(0, 300);
  }

  if (body && typeof body === "object") {
    const candidate = body as {
      error?: { message?: string } | string;
      error_description?: string;
      message?: string;
    };

    if (typeof candidate.error === "object" && typeof candidate.error.message === "string") {
      return candidate.error.message;
    }

    if (typeof candidate.error_description === "string") return candidate.error_description;
    if (typeof candidate.message === "string") return candidate.message;
    if (typeof candidate.error === "string") return candidate.error;
  }

  return "Unexpected Google API error";
}

async function parseJsonSafe(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export function extractDocumentPlainText(document: GoogleDocumentResponse): string {
  const chunks: string[] = [];

  function walk(content: GoogleDocumentContentBlock[] | undefined): void {
    if (!content) return;

    for (const block of content) {
      const paragraphText = (block.paragraph?.elements ?? [])
        .map((element: GoogleDocumentParagraphElement) => element.textRun?.content ?? "")
        .join("")
        .replace(/\u000b/g, "\n");

      if (paragraphText.trim().length > 0) {
        chunks.push(paragraphText.trimEnd());
      }

      for (const row of block.table?.tableRows ?? []) {
        for (const cell of row.tableCells ?? []) {
          walk(cell.content);
        }
      }

      walk(block.tableOfContents?.content);
    }
  }

  walk(document.body?.content);
  return chunks.join("\n\n").trim();
}

export function buildDriveSearchQuery(input: {
  query?: string;
  folderId?: string;
  mimeType?: unknown;
}): string {
  const parts = ["trashed = false"];

  if (input.query && input.query.trim().length > 0) {
    parts.push(`name contains '${escapeDriveQueryValue(input.query.trim())}'`);
  }

  if (input.folderId && input.folderId.trim().length > 0) {
    parts.push(`'${escapeDriveQueryValue(input.folderId.trim())}' in parents`);
  }

  const mimeType = mapMimeTypeFilter(input.mimeType);
  if (mimeType) {
    parts.push(`mimeType = '${mimeType}'`);
  }

  return parts.join(" and ");
}

export async function getPluginConfig(ctx: PluginContext): Promise<GoogleDrivePluginConfig> {
  const raw = await ctx.config.get();
  return {
    clientId: asString(raw.clientId).trim(),
    clientSecretSecretRef: asString(raw.clientSecretSecretRef).trim(),
    refreshTokenSecretRef: asString(raw.refreshTokenSecretRef).trim(),
    defaultFolderId: asString(raw.defaultFolderId).trim() || undefined,
    defaultUserEmail: asString(raw.defaultUserEmail).trim() || undefined,
    defaultPageSize: asNumber(raw.defaultPageSize, DEFAULT_PAGE_SIZE),
  };
}

async function getAccessToken(ctx: PluginContext, config?: GoogleDrivePluginConfig): Promise<string> {
  const resolvedConfig = config ?? await getPluginConfig(ctx);
  if (!resolvedConfig.clientId || !resolvedConfig.clientSecretSecretRef || !resolvedConfig.refreshTokenSecretRef) {
    throw new Error("Google Drive plugin is not configured");
  }

  const [clientSecret, refreshToken] = await Promise.all([
    ctx.secrets.resolve(resolvedConfig.clientSecretSecretRef),
    ctx.secrets.resolve(resolvedConfig.refreshTokenSecretRef),
  ]);

  const cacheKey = `${resolvedConfig.clientId}:${resolvedConfig.refreshTokenSecretRef}`;
  const cached = accessTokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + TOKEN_SAFETY_MS) {
    return cached.accessToken;
  }

  const response = await ctx.http.fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: resolvedConfig.clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const payload = await parseJsonSafe(response) as GoogleTokenResponse;
  if (!response.ok || typeof payload.access_token !== "string" || payload.access_token.length === 0) {
    throw new Error(`Google OAuth refresh failed: ${summarizeApiError(payload)}`);
  }

  const expiresIn = typeof payload.expires_in === "number" ? payload.expires_in : 3600;
  accessTokenCache.set(cacheKey, {
    accessToken: payload.access_token,
    expiresAt: Date.now() + expiresIn * 1000,
  });

  return payload.access_token;
}

export async function googleJson<T>(
  ctx: PluginContext,
  input: {
    url: string;
    method?: string;
    body?: unknown;
    config?: GoogleDrivePluginConfig;
  },
): Promise<T> {
  const accessToken = await getAccessToken(ctx, input.config);
  const headers: Record<string, string> = {
    authorization: `Bearer ${accessToken}`,
  };

  let body: string | undefined;
  if (input.body !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(input.body);
  }

  const response = await ctx.http.fetch(input.url, {
    method: input.method ?? (body ? "POST" : "GET"),
    headers,
    body,
  });

  const payload = await parseJsonSafe(response);
  if (!response.ok) {
    throw new Error(`Google API ${response.status}: ${summarizeApiError(payload)}`);
  }

  return payload as T;
}

export function formatDriveFilesForAgent(
  files: Array<{ id: string; name: string; mimeType?: string; webViewLink?: string; modifiedTime?: string }>,
): string {
  if (files.length === 0) return "No se han encontrado archivos.";

  return files
    .map((file, index) => {
      const details = [
        file.mimeType ? `mime=${file.mimeType}` : null,
        file.modifiedTime ? `updated=${file.modifiedTime}` : null,
        file.webViewLink ? `url=${file.webViewLink}` : null,
      ].filter(Boolean);

      return `${index + 1}. ${file.name} (${file.id})${details.length > 0 ? ` - ${details.join(" | ")}` : ""}`;
    })
    .join("\n");
}

export function truncateForAgent(text: string, maxLength = DOC_TEXT_LIMIT): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}\n\n[truncated]`;
}

export function getDocumentAppendIndex(document: GoogleDocumentResponse): number {
  const lastEndIndex = document.body?.content?.at(-1)?.endIndex;
  if (typeof lastEndIndex === "number" && lastEndIndex > 1) {
    return lastEndIndex - 1;
  }
  return 1;
}

export function normalizePageSize(value: unknown, fallback: number): number {
  const candidate = asNumber(value, fallback);
  return Math.max(1, Math.min(100, candidate));
}

export function buildGoogleDocUrl(documentId: string): string {
  return `https://docs.google.com/document/d/${documentId}/edit`;
}
