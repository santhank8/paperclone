import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "paperclipai.plugin-google-drive-tools",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Google Drive Tools",
  description: "Google Drive and Google Docs tools for Paperclip agents.",
  author: "Paperclip",
  categories: ["connector"],
  capabilities: [
    "http.outbound",
    "secrets.read-ref",
    "agent.tools.register"
  ],
  entrypoints: {
    worker: "./dist/worker.js"
  },
  instanceConfigSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      clientId: {
        type: "string",
        title: "Google OAuth Client ID",
        minLength: 1
      },
      clientSecretSecretRef: {
        type: "string",
        title: "Client secret secret ref",
        format: "secret-ref"
      },
      refreshTokenSecretRef: {
        type: "string",
        title: "Refresh token secret ref",
        format: "secret-ref"
      },
      defaultFolderId: {
        type: "string",
        title: "Default folder ID"
      },
      defaultUserEmail: {
        type: "string",
        title: "Default Google account email"
      },
      defaultPageSize: {
        type: "integer",
        title: "Default page size",
        minimum: 1,
        maximum: 100,
        default: 10
      }
    },
    required: ["clientId", "clientSecretSecretRef", "refreshTokenSecretRef"]
  },
  tools: [
    {
      name: "search-drive-files",
      displayName: "Search Drive Files",
      description: "Search files in Google Drive by name and optional filters.",
      parametersSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          query: { type: "string", minLength: 1 },
          folderId: { type: "string" },
          mimeType: {
            type: "string",
            enum: ["any", "document", "folder", "pdf"],
            default: "any"
          },
          pageSize: { type: "integer", minimum: 1, maximum: 100 }
        },
        required: ["query"]
      }
    },
    {
      name: "list-drive-items",
      displayName: "List Drive Items",
      description: "List files and folders inside a Google Drive folder.",
      parametersSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          folderId: { type: "string" },
          pageSize: { type: "integer", minimum: 1, maximum: 100 }
        }
      }
    },
    {
      name: "read-google-doc",
      displayName: "Read Google Doc",
      description: "Read a Google Doc and return plain text content.",
      parametersSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          documentId: { type: "string", minLength: 1 }
        },
        required: ["documentId"]
      }
    },
    {
      name: "create-google-doc",
      displayName: "Create Google Doc",
      description: "Create a Google Doc, optionally with initial content and folder placement.",
      parametersSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string", minLength: 1 },
          content: { type: "string" },
          folderId: { type: "string" }
        },
        required: ["title"]
      }
    },
    {
      name: "append-google-doc",
      displayName: "Append Google Doc",
      description: "Append text to the end of an existing Google Doc.",
      parametersSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          documentId: { type: "string", minLength: 1 },
          content: { type: "string", minLength: 1 }
        },
        required: ["documentId", "content"]
      }
    }
  ]
};

export default manifest;
