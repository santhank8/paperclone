import { afterEach, describe, expect, it } from "vitest";
import {
  ensurePicoClawModelConfiguredIfPresent,
  listPicoClawModels,
  parsePicoClawModelsOutput,
  resetPicoClawModelsCacheForTests,
} from "./models.js";

describe("picoclaw models", () => {
  afterEach(() => {
    delete process.env.PAPERCLIP_PICOCLAW_COMMAND;
    resetPicoClawModelsCacheForTests();
  });

  it("parses configured models from `picoclaw model` output", () => {
    expect(
      parsePicoClawModelsOutput(`
Current default model: gpt-5.4

Available models in your config:
> - gpt-5.4 (openai/gpt-5.4)
  - ark-code-latest (volcengine/ark-code-latest)
      `),
    ).toEqual([
      { id: "gpt-5.4", label: "gpt-5.4 (openai/gpt-5.4)" },
      { id: "ark-code-latest", label: "ark-code-latest (volcengine/ark-code-latest)" },
    ]);
  });

  it("returns an empty list when discovery command is unavailable", async () => {
    process.env.PAPERCLIP_PICOCLAW_COMMAND = "__paperclip_missing_picoclaw_command__";
    await expect(listPicoClawModels()).resolves.toEqual([]);
  });

  it("allows blank model to defer to PicoClaw default", async () => {
    await expect(
      ensurePicoClawModelConfiguredIfPresent({ model: "" }),
    ).resolves.toEqual([]);
  });

  it("rejects when discovery cannot run for configured model", async () => {
    process.env.PAPERCLIP_PICOCLAW_COMMAND = "__paperclip_missing_picoclaw_command__";
    await expect(
      ensurePicoClawModelConfiguredIfPresent({
        model: "gpt-5.4",
      }),
    ).rejects.toThrow(/picoclaw/i);
  });
});
