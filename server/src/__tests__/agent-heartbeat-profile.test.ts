import { describe, expect, it } from "vitest";
import {
  applyAgentHeartbeatProfileDefaults,
  applyCompanyHeartbeatPolicyToRuntimeConfig,
  defaultHeartbeatIntervalSecForRole,
} from "../services/agent-heartbeat-profile.ts";

describe("defaultHeartbeatIntervalSecForRole", () => {
  it("returns fast management intervals for CEO/CTO", () => {
    expect(defaultHeartbeatIntervalSecForRole("ceo")).toBe(120);
    expect(defaultHeartbeatIntervalSecForRole("cto")).toBe(120);
  });

  it("returns conservative fallback for unknown roles", () => {
    expect(defaultHeartbeatIntervalSecForRole("unknown-role")).toBe(300);
  });

  it("prefers company policy overrides when present", () => {
    expect(
      defaultHeartbeatIntervalSecForRole("engineer", {
        heartbeat: { intervalsByRole: { engineer: 90 } },
      }),
    ).toBe(90);
  });
});

describe("applyAgentHeartbeatProfileDefaults", () => {
  it("fills missing heartbeat defaults based on role", () => {
    expect(applyAgentHeartbeatProfileDefaults("qa", {})).toEqual({
      heartbeat: {
        enabled: true,
        cooldownSec: 10,
        intervalSec: 180,
        wakeOnDemand: true,
        maxConcurrentRuns: 1,
      },
    });
  });

  it("preserves explicit heartbeat intervals", () => {
    expect(
      applyAgentHeartbeatProfileDefaults("engineer", {
        heartbeat: { intervalSec: 45, enabled: false, cooldownSec: 3, wakeOnDemand: false, maxConcurrentRuns: 2 },
      }),
    ).toEqual({
      heartbeat: {
        intervalSec: 45,
        enabled: false,
        cooldownSec: 3,
        wakeOnDemand: false,
        maxConcurrentRuns: 2,
      },
    });
  });

  it("applies company policy when interval is missing", () => {
    expect(
      applyAgentHeartbeatProfileDefaults(
        "engineer",
        {},
        { heartbeat: { intervalsByRole: { engineer: 75 } } },
      ),
    ).toEqual({
      heartbeat: {
        enabled: true,
        cooldownSec: 10,
        intervalSec: 75,
        wakeOnDemand: true,
        maxConcurrentRuns: 1,
      },
    });
  });
});

describe("applyCompanyHeartbeatPolicyToRuntimeConfig", () => {
  it("overrides an existing interval with the company policy", () => {
    expect(
      applyCompanyHeartbeatPolicyToRuntimeConfig(
        "qa",
        { heartbeat: { intervalSec: 1800, enabled: true, cooldownSec: 10, wakeOnDemand: true, maxConcurrentRuns: 1 } },
        { heartbeat: { intervalsByRole: { qa: 150 } } },
      ),
    ).toEqual({
      heartbeat: {
        intervalSec: 150,
        enabled: true,
        cooldownSec: 10,
        wakeOnDemand: true,
        maxConcurrentRuns: 1,
      },
    });
  });
});
