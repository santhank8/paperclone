import { describe, expect, it } from "vitest";
import { normalizeAgentPermissions } from "../services/agent-permissions.js";

describe("normalizeAgentPermissions", () => {
  it("always preserves CEO create-agent capability", () => {
    expect(normalizeAgentPermissions({}, "ceo").canCreateAgents).toBe(true);
    expect(normalizeAgentPermissions({ canCreateAgents: false }, "ceo").canCreateAgents).toBe(true);
  });

  it("respects explicit non-CEO overrides", () => {
    expect(normalizeAgentPermissions({}, "engineer").canCreateAgents).toBe(false);
    expect(normalizeAgentPermissions({ canCreateAgents: true }, "engineer").canCreateAgents).toBe(true);
  });
});
