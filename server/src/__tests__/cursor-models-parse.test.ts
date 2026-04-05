import { describe, expect, it } from "vitest";
import { parseCursorModelsOutput } from "../adapters/cursor-models.js";

describe("parseCursorModelsOutput", () => {
  it("parses current agent models line format (id - label)", () => {
    const stdout = `
Loading models…
Available models

auto - Auto  (current)
composer-2-fast - Composer 2 Fast  (default)
composer-2 - Composer 2
composer-1.5 - Composer 1.5
`;
    const models = parseCursorModelsOutput(stdout, "");
    const ids = models.map((m) => m.id);
    expect(ids).toContain("auto");
    expect(ids).toContain("composer-2");
    expect(ids).toContain("composer-2-fast");
    expect(ids).toContain("composer-1.5");
    const c2 = models.find((m) => m.id === "composer-2");
    expect(c2?.label).toBe("Composer 2");
  });

  it("still parses legacy Available models: a, b, c", () => {
    const models = parseCursorModelsOutput(
      "Available models: auto, composer-1.5, gpt-5.3-codex-high",
      "",
    );
    expect(models.some((m) => m.id === "gpt-5.3-codex-high")).toBe(true);
  });

  it("strips ANSI progress noise before parsing", () => {
    const stdout = "\x1b[2K\x1b[GAvailable models\n\ncomposer-2 - Composer 2\n";
    const models = parseCursorModelsOutput(stdout, "");
    expect(models.some((m) => m.id === "composer-2")).toBe(true);
  });
});
