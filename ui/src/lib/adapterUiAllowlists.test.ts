// Changes: Assert OpenClaw gateway adapter is enabled in UI allowlists.
import { describe, expect, it } from "vitest";
import {
  ENABLED_AGENT_CONFIG_ADAPTER_TYPES,
  ENABLED_INVITE_ADAPTER_TYPES,
  ISSUE_OVERRIDE_ADAPTER_TYPES,
} from "./adapterUiAllowlists";

describe("adapterUiAllowlists", () => {
  it("includes openclaw_gateway for invites, agent config, and issue overrides", () => {
    expect(ENABLED_INVITE_ADAPTER_TYPES.has("openclaw_gateway")).toBe(true);
    expect(ENABLED_AGENT_CONFIG_ADAPTER_TYPES.has("openclaw_gateway")).toBe(true);
    expect(ISSUE_OVERRIDE_ADAPTER_TYPES.has("openclaw_gateway")).toBe(true);
  });
});
