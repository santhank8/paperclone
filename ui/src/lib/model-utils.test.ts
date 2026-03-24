import { describe, expect, it } from "vitest";
import {
  extractModelName,
  extractProviderId,
  isProviderModelId,
  shouldOfferCustomModelEntry,
} from "./model-utils";

describe("model utils", () => {
  it("extracts provider and model names from hierarchical ids", () => {
    expect(extractProviderId("github-models/openai/gpt-4.1")).toBe("github-models");
    expect(extractModelName("github-models/openai/gpt-4.1")).toBe("openai/gpt-4.1");
  });

  it("accepts provider/model ids with nested model paths", () => {
    expect(isProviderModelId("opencode-go/minimax-m2.5")).toBe(true);
    expect(isProviderModelId("github-models/openai/gpt-4.1")).toBe(true);
  });

  it("rejects blank or malformed provider/model ids", () => {
    expect(isProviderModelId("")).toBe(false);
    expect(isProviderModelId("gpt-5")).toBe(false);
    expect(isProviderModelId("/gpt-5")).toBe(false);
    expect(isProviderModelId("openai/")).toBe(false);
  });

  it("offers custom model entries only for valid unseen ids", () => {
    const discovered = ["openai/gpt-5.4", "github-models/openai/gpt-4.1"];
    expect(shouldOfferCustomModelEntry("openai/gpt-5.4", discovered)).toBe(false);
    expect(shouldOfferCustomModelEntry("openai/gpt-5.5-preview", discovered)).toBe(true);
    expect(shouldOfferCustomModelEntry("gpt-5.5-preview", discovered)).toBe(false);
  });
});
