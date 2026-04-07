import { beforeEach, describe, expect, it, vi } from "vitest";
import { models as codexFallbackModels } from "@paperclipai/adapter-codex-local";
import { models as cursorFallbackModels } from "@paperclipai/adapter-cursor-local";
import { models as opencodeFallbackModels } from "@paperclipai/adapter-opencode-local";
import { resetOpenCodeModelsCacheForTests } from "@paperclipai/adapter-opencode-local/server";
import { listAdapterModels } from "../adapters/index.js";
import { resetCodexModelsCacheForTests } from "../adapters/codex-models.js";
import { resetCursorModelsCacheForTests, setCursorModelsRunnerForTests } from "../adapters/cursor-models.js";
import { resetHermesModelsCacheForTests } from "../adapters/hermes-models.js";
import { readFile } from "node:fs/promises";

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return { ...actual, readFile: vi.fn() };
});

describe("adapter model listing", () => {
  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.PAPERCLIP_OPENCODE_COMMAND;
    resetCodexModelsCacheForTests();
    resetCursorModelsCacheForTests();
    setCursorModelsRunnerForTests(null);
    resetOpenCodeModelsCacheForTests();
    resetHermesModelsCacheForTests();
    vi.restoreAllMocks();
  });

  it("returns an empty list for unknown adapters", async () => {
    const models = await listAdapterModels("unknown_adapter");
    expect(models).toEqual([]);
  });

  it("returns codex fallback models when no OpenAI key is available", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const models = await listAdapterModels("codex_local");

    expect(models).toEqual(codexFallbackModels);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("loads codex models dynamically and merges fallback options", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: "gpt-5-pro" },
          { id: "gpt-5" },
        ],
      }),
    } as Response);

    const first = await listAdapterModels("codex_local");
    const second = await listAdapterModels("codex_local");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
    expect(first.some((model) => model.id === "gpt-5-pro")).toBe(true);
    expect(first.some((model) => model.id === "codex-mini-latest")).toBe(true);
  });

  it("falls back to static codex models when OpenAI model discovery fails", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    } as Response);

    const models = await listAdapterModels("codex_local");
    expect(models).toEqual(codexFallbackModels);
  });


  it("returns cursor fallback models when CLI discovery is unavailable", async () => {
    setCursorModelsRunnerForTests(() => ({
      status: null,
      stdout: "",
      stderr: "",
      hasError: true,
    }));

    const models = await listAdapterModels("cursor");
    expect(models).toEqual(cursorFallbackModels);
  });

  it("returns opencode fallback models including gpt-5.4", async () => {
    process.env.PAPERCLIP_OPENCODE_COMMAND = "__paperclip_missing_opencode_command__";

    const models = await listAdapterModels("opencode_local");

    expect(models).toEqual(opencodeFallbackModels);
  });

  it("loads cursor models dynamically and caches them", async () => {
    const runner = vi.fn(() => ({
      status: 0,
      stdout: "Available models: auto, composer-1.5, gpt-5.3-codex-high, sonnet-4.6",
      stderr: "",
      hasError: false,
    }));
    setCursorModelsRunnerForTests(runner);

    const first = await listAdapterModels("cursor");
    const second = await listAdapterModels("cursor");

    expect(runner).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
    expect(first.some((model) => model.id === "auto")).toBe(true);
    expect(first.some((model) => model.id === "gpt-5.3-codex-high")).toBe(true);
    expect(first.some((model) => model.id === "composer-1")).toBe(true);
  });

  describe("hermes_local", () => {
    const validConfig = [
      "model:",
      "  base_url: http://localhost:1234/v1",
      "  model: test-model",
    ].join("\n");

    function mockConfigFile(content: string | null) {
      if (content === null) {
        vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));
      } else {
        vi.mocked(readFile).mockResolvedValue(content);
      }
    }

    function mockFetchModels(models: { id: string }[], ok = true) {
      return vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok,
        json: async () => ({ data: models }),
      } as Response);
    }

    it("returns empty list when config file is missing", async () => {
      mockConfigFile(null);
      const models = await listAdapterModels("hermes_local");
      expect(models).toEqual([]);
    });

    it("returns empty list when config has no base_url", async () => {
      mockConfigFile("model:\n  model: test-model\n");
      const models = await listAdapterModels("hermes_local");
      expect(models).toEqual([]);
    });

    it("returns models from OpenAI-compatible endpoint", async () => {
      mockConfigFile(validConfig);
      const fetchSpy = mockFetchModels([{ id: "gemma-4-31b" }, { id: "llama-3.3" }]);

      const models = await listAdapterModels("hermes_local");

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(models.some((m) => m.id === "gemma-4-31b")).toBe(true);
      expect(models.some((m) => m.id === "llama-3.3")).toBe(true);
    });

    it("caches results across calls", async () => {
      mockConfigFile(validConfig);
      const fetchSpy = mockFetchModels([{ id: "model-a" }]);

      const first = await listAdapterModels("hermes_local");
      const second = await listAdapterModels("hermes_local");

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(first).toEqual(second);
    });

    it("returns stale cache when fetch fails after expiry", async () => {
      vi.useFakeTimers();
      try {
        mockConfigFile(validConfig);
        mockFetchModels([{ id: "cached-model" }]);
        await listAdapterModels("hermes_local");

        // Advance past the 60s cache TTL
        vi.advanceTimersByTime(61_000);

        // Second call: config still readable, but fetch fails → should return stale cache
        mockConfigFile(validConfig);
        vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));

        const stale = await listAdapterModels("hermes_local");
        expect(stale.some((m) => m.id === "cached-model")).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });

    it("returns empty list when endpoint returns no models", async () => {
      mockConfigFile(validConfig);
      mockFetchModels([]);

      const models = await listAdapterModels("hermes_local");
      expect(models).toEqual([]);
    });

    it("returns empty list when fetch returns non-ok response", async () => {
      mockConfigFile(validConfig);
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({}),
      } as Response);

      const models = await listAdapterModels("hermes_local");
      expect(models).toEqual([]);
    });

    it("handles quoted base_url in config", async () => {
      mockConfigFile('model:\n  base_url: "http://localhost:1234/v1"\n');
      const fetchSpy = mockFetchModels([{ id: "quoted-test" }]);

      const models = await listAdapterModels("hermes_local");
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(models.some((m) => m.id === "quoted-test")).toBe(true);
    });

    it("deduplicates models from endpoint", async () => {
      mockConfigFile(validConfig);
      mockFetchModels([{ id: "dup-model" }, { id: "dup-model" }, { id: "other" }]);

      const models = await listAdapterModels("hermes_local");
      const dupCount = models.filter((m) => m.id === "dup-model").length;
      expect(dupCount).toBe(1);
      expect(models.some((m) => m.id === "other")).toBe(true);
    });
  });

});
