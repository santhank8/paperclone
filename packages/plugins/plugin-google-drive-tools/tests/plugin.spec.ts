import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import manifest from "../src/manifest.js";
import plugin from "../src/worker.js";
import {
  buildDriveSearchQuery,
  extractDocumentPlainText,
  getDocumentAppendIndex,
} from "../src/google-drive.js";

describe("plugin-google-drive-tools", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("builds a safe Drive query", () => {
    expect(buildDriveSearchQuery({
      query: "LinkedIn plan",
      folderId: "folder-123",
      mimeType: "document",
    })).toBe(
      "trashed = false and name contains 'LinkedIn plan' and 'folder-123' in parents and mimeType = 'application/vnd.google-apps.document'",
    );
  });

  it("extracts plain text from a Google Doc response", () => {
    const text = extractDocumentPlainText({
      title: "Test",
      body: {
        content: [
          {
            paragraph: {
              elements: [
                { textRun: { content: "Hola" } },
                { textRun: { content: " mundo" } },
              ],
            },
          },
          {
            table: {
              tableRows: [
                {
                  tableCells: [
                    {
                      content: [
                        {
                          paragraph: {
                            elements: [{ textRun: { content: "Celda" } }],
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        ],
      },
    });

    expect(text).toContain("Hola mundo");
    expect(text).toContain("Celda");
  });

  it("computes the append index from the document tail", () => {
    expect(getDocumentAppendIndex({
      body: { content: [{ endIndex: 1 }, { endIndex: 14 }] },
    })).toBe(13);
  });

  it("registers the search tool and calls Google Drive through OAuth refresh", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        clientId: "client-id",
        clientSecretSecretRef: "secret-ref",
        refreshTokenSecretRef: "refresh-ref",
        defaultPageSize: 5,
      },
    });
    await plugin.definition.setup(harness.ctx);

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "access-token",
            expires_in: 3600,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            files: [
              {
                id: "doc-1",
                name: "LinkedIn Q2",
                mimeType: "application/vnd.google-apps.document",
                webViewLink: "https://docs.google.com/document/d/doc-1/edit",
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );

    const result = await harness.executeTool("search-drive-files", {
      query: "LinkedIn",
      mimeType: "document",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.content).toContain("LinkedIn Q2");
    expect(result.data).toEqual({
      files: [
        {
          id: "doc-1",
          name: "LinkedIn Q2",
          mimeType: "application/vnd.google-apps.document",
          webViewLink: "https://docs.google.com/document/d/doc-1/edit",
        },
      ],
    });
  });
});
