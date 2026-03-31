import { describe, expect, it } from "vitest";
import { adapterLabels } from "../components/agent-config-primitives";

describe("adapter labels", () => {
  it("includes an explicit label for ollama_local", () => {
    expect(adapterLabels.ollama_local).toBe("Ollama (local)");
  });
});
