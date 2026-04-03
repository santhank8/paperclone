import type { ToolResult } from "@paperclipai/plugin-sdk";
import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import {
  buildDriveSearchQuery,
  buildGoogleDocUrl,
  extractDocumentPlainText,
  formatDriveFilesForAgent,
  getDocumentAppendIndex,
  getPluginConfig,
  type GoogleDocumentResponse,
  googleJson,
  normalizePageSize,
  truncateForAgent,
} from "./google-drive.js";

type DriveFile = {
  id: string;
  name: string;
  mimeType?: string;
  webViewLink?: string;
  modifiedTime?: string;
};

function getTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

const plugin = definePlugin({
  async setup(ctx) {
    ctx.tools.register(
      "search-drive-files",
      {
        displayName: "Search Drive Files",
        description: "Search files in Google Drive by name and optional filters.",
        parametersSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            query: { type: "string", minLength: 1 },
            folderId: { type: "string" },
            mimeType: { type: "string" },
            pageSize: { type: "integer", minimum: 1, maximum: 100 },
          },
          required: ["query"],
        },
      },
      async (params): Promise<ToolResult> => {
        const config = await getPluginConfig(ctx);
        const typedParams = params as {
          query?: unknown;
          folderId?: unknown;
          mimeType?: unknown;
          pageSize?: unknown;
        };

        const queryValue = getTrimmedString(typedParams.query);
        if (!queryValue) throw new Error("Missing or invalid \"query\"");

        const pageSize = normalizePageSize(typedParams.pageSize, config.defaultPageSize ?? 10);
        const query = buildDriveSearchQuery({
          query: queryValue,
          folderId: getTrimmedString(typedParams.folderId) || undefined,
          mimeType: typedParams.mimeType,
        });

        const searchParams = new URLSearchParams({
          q: query,
          pageSize: String(pageSize),
          includeItemsFromAllDrives: "true",
          supportsAllDrives: "true",
          orderBy: "modifiedTime desc",
          fields: "files(id,name,mimeType,webViewLink,modifiedTime)",
        });

        const response = await googleJson<{ files?: DriveFile[] }>(ctx, {
          url: `https://www.googleapis.com/drive/v3/files?${searchParams.toString()}`,
          config,
        });

        const files = response.files ?? [];
        return {
          content: formatDriveFilesForAgent(files),
          data: { files },
        };
      },
    );

    ctx.tools.register(
      "list-drive-items",
      {
        displayName: "List Drive Items",
        description: "List files and folders inside a Google Drive folder.",
        parametersSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            folderId: { type: "string" },
            pageSize: { type: "integer", minimum: 1, maximum: 100 },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        const config = await getPluginConfig(ctx);
        const typedParams = params as {
          folderId?: unknown;
          pageSize?: unknown;
        };

        const folderId = getTrimmedString(typedParams.folderId) || config.defaultFolderId || "root";
        const pageSize = normalizePageSize(typedParams.pageSize, config.defaultPageSize ?? 10);
        const searchParams = new URLSearchParams({
          q: buildDriveSearchQuery({ folderId }),
          pageSize: String(pageSize),
          includeItemsFromAllDrives: "true",
          supportsAllDrives: "true",
          orderBy: "folder,name",
          fields: "files(id,name,mimeType,webViewLink,modifiedTime)",
        });

        const response = await googleJson<{ files?: DriveFile[] }>(ctx, {
          url: `https://www.googleapis.com/drive/v3/files?${searchParams.toString()}`,
          config,
        });

        const files = response.files ?? [];
        return {
          content: formatDriveFilesForAgent(files),
          data: { folderId, files },
        };
      },
    );

    ctx.tools.register(
      "read-google-doc",
      {
        displayName: "Read Google Doc",
        description: "Read a Google Doc and return plain text content.",
        parametersSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            documentId: { type: "string", minLength: 1 },
          },
          required: ["documentId"],
        },
      },
      async (params): Promise<ToolResult> => {
        const config = await getPluginConfig(ctx);
        const documentId = getTrimmedString((params as { documentId?: unknown }).documentId);
        if (!documentId) throw new Error("Missing or invalid \"documentId\"");

        const document = await googleJson<GoogleDocumentResponse>(ctx, {
          url: `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}`,
          config,
        });

        const text = extractDocumentPlainText(document);
        const url = buildGoogleDocUrl(documentId);
        return {
          content: `Documento: ${document.title ?? documentId}\nURL: ${url}\n\n${truncateForAgent(text)}`,
          data: { documentId, title: document.title ?? null, text, url },
        };
      },
    );

    ctx.tools.register(
      "create-google-doc",
      {
        displayName: "Create Google Doc",
        description: "Create a Google Doc, optionally with initial content and folder placement.",
        parametersSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string", minLength: 1 },
            content: { type: "string" },
            folderId: { type: "string" },
          },
          required: ["title"],
        },
      },
      async (params): Promise<ToolResult> => {
        const config = await getPluginConfig(ctx);
        const typedParams = params as {
          title?: unknown;
          content?: unknown;
          folderId?: unknown;
        };

        const title = getTrimmedString(typedParams.title);
        if (!title) throw new Error("Missing or invalid \"title\"");

        const content = typeof typedParams.content === "string" ? typedParams.content : "";
        const folderId = getTrimmedString(typedParams.folderId) || config.defaultFolderId;

        const created = await googleJson<{ documentId: string; title?: string }>(ctx, {
          url: "https://docs.googleapis.com/v1/documents",
          method: "POST",
          body: { title },
          config,
        });

        if (content.trim().length > 0) {
          await googleJson(ctx, {
            url: `https://docs.googleapis.com/v1/documents/${encodeURIComponent(created.documentId)}:batchUpdate`,
            method: "POST",
            body: {
              requests: [
                {
                  insertText: {
                    location: { index: 1 },
                    text: content,
                  },
                },
              ],
            },
            config,
          });
        }

        if (folderId) {
          await googleJson(ctx, {
            url: `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(created.documentId)}?addParents=${encodeURIComponent(folderId)}&removeParents=root&supportsAllDrives=true`,
            method: "PATCH",
            body: {},
            config,
          });
        }

        const url = buildGoogleDocUrl(created.documentId);
        return {
          content: `Documento creado: ${created.title ?? title}\nID: ${created.documentId}\nURL: ${url}`,
          data: {
            documentId: created.documentId,
            title: created.title ?? title,
            url,
            folderId: folderId ?? null,
          },
        };
      },
    );

    ctx.tools.register(
      "append-google-doc",
      {
        displayName: "Append Google Doc",
        description: "Append text to the end of an existing Google Doc.",
        parametersSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            documentId: { type: "string", minLength: 1 },
            content: { type: "string", minLength: 1 },
          },
          required: ["documentId", "content"],
        },
      },
      async (params): Promise<ToolResult> => {
        const config = await getPluginConfig(ctx);
        const typedParams = params as {
          documentId?: unknown;
          content?: unknown;
        };

        const documentId = getTrimmedString(typedParams.documentId);
        const content = typeof typedParams.content === "string" ? typedParams.content : "";
        if (!documentId) throw new Error("Missing or invalid \"documentId\"");
        if (!content.trim()) throw new Error("Missing or invalid \"content\"");

        const document = await googleJson<GoogleDocumentResponse>(ctx, {
          url: `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}`,
          config,
        });
        const insertionIndex = getDocumentAppendIndex(document);

        await googleJson(ctx, {
          url: `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}:batchUpdate`,
          method: "POST",
          body: {
            requests: [
              {
                insertText: {
                  location: { index: insertionIndex },
                  text: `\n\n${content}`,
                },
              },
            ],
          },
          config,
        });

        const url = buildGoogleDocUrl(documentId);
        return {
          content: `Contenido anadido al documento ${documentId}\nURL: ${url}`,
          data: { documentId, url, insertedCharacters: content.length },
        };
      },
    );
  },

  async onValidateConfig(config) {
    const errors: string[] = [];

    if (typeof config.clientId !== "string" || config.clientId.trim().length === 0) {
      errors.push("clientId is required");
    }
    if (typeof config.clientSecretSecretRef !== "string" || config.clientSecretSecretRef.trim().length === 0) {
      errors.push("clientSecretSecretRef is required");
    }
    if (typeof config.refreshTokenSecretRef !== "string" || config.refreshTokenSecretRef.trim().length === 0) {
      errors.push("refreshTokenSecretRef is required");
    }

    return errors.length > 0 ? { ok: false, errors } : { ok: true };
  },

  async onHealth() {
    return { status: "ok", message: "Google Drive Tools worker is running" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
