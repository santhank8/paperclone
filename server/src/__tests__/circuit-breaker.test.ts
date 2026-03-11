import { describe, expect, it, vi } from "vitest";

vi.mock("../middleware/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { hasMeaningfulRunProgress, parseCircuitBreakerConfig } from "../services/circuit-breaker.js";

describe("parseCircuitBreakerConfig", () => {
  it("returns defaults when no config is set", () => {
    const config = parseCircuitBreakerConfig(makeAgent({}));
    expect(config).toEqual({
      enabled: true,
      maxConsecutiveFailures: 3,
      maxConsecutiveNoProgress: 0,
      tokenVelocityMultiplier: 3.0,
    });
  });

  it("respects explicit config values", () => {
    const config = parseCircuitBreakerConfig(makeAgent({
      runtimeConfig: {
        circuitBreaker: {
          enabled: false,
          maxConsecutiveFailures: 5,
          maxConsecutiveNoProgress: 10,
          tokenVelocityMultiplier: 5.0,
        },
      },
    }));
    expect(config).toEqual({
      enabled: false,
      maxConsecutiveFailures: 5,
      maxConsecutiveNoProgress: 10,
      tokenVelocityMultiplier: 5.0,
    });
  });

  it("clamps minimum values", () => {
    const config = parseCircuitBreakerConfig(makeAgent({
      runtimeConfig: {
        circuitBreaker: {
          maxConsecutiveFailures: 0,
          maxConsecutiveNoProgress: -1,
          tokenVelocityMultiplier: 1.0,
        },
      },
    }));
    expect(config.maxConsecutiveFailures).toBe(1);
    expect(config.maxConsecutiveNoProgress).toBe(0);
    expect(config.tokenVelocityMultiplier).toBe(1.5);
  });

  it("handles malformed runtimeConfig gracefully", () => {
    const config = parseCircuitBreakerConfig(makeAgent({ runtimeConfig: "not-an-object" as unknown }));
    expect(config.enabled).toBe(true);
    expect(config.maxConsecutiveFailures).toBe(3);
  });

  it("handles null circuitBreaker key", () => {
    const config = parseCircuitBreakerConfig(makeAgent({ runtimeConfig: { circuitBreaker: null } }));
    expect(config.enabled).toBe(true);
  });

  it("handles missing runtimeConfig", () => {
    const config = parseCircuitBreakerConfig(makeAgent({ runtimeConfig: null }));
    expect(config).toEqual({
      enabled: true,
      maxConsecutiveFailures: 3,
      maxConsecutiveNoProgress: 0,
      tokenVelocityMultiplier: 3.0,
    });
  });

  it("allows disabling the breaker entirely", () => {
    const config = parseCircuitBreakerConfig(makeAgent({
      runtimeConfig: { circuitBreaker: { enabled: false } },
    }));
    expect(config.enabled).toBe(false);
    // other values remain at defaults
    expect(config.maxConsecutiveFailures).toBe(3);
  });

  it("allows re-enabling consecutive no-progress pausing explicitly", () => {
    const config = parseCircuitBreakerConfig(makeAgent({
      runtimeConfig: { circuitBreaker: { maxConsecutiveNoProgress: 5 } },
    }));
    expect(config.maxConsecutiveNoProgress).toBe(5);
  });
});

describe("hasMeaningfulRunProgress", () => {
  it("treats control-plane activity as meaningful progress", () => {
    expect(hasMeaningfulRunProgress(null, 1)).toBe(true);
  });

  it("treats adapter result counters as meaningful progress", () => {
    expect(hasMeaningfulRunProgress({ commentsPosted: 1 }, 0)).toBe(true);
    expect(hasMeaningfulRunProgress({ issuesCreated: 1 }, 0)).toBe(true);
    expect(hasMeaningfulRunProgress({ issuesMoved: 1 }, 0)).toBe(true);
  });

  it("treats empty runs as no progress", () => {
    expect(hasMeaningfulRunProgress(null, 0)).toBe(false);
    expect(hasMeaningfulRunProgress({}, 0)).toBe(false);
  });
});

function makeAgent(overrides: Record<string, unknown>) {
  return {
    id: "agent-1",
    companyId: "company-1",
    name: "Test Agent",
    role: "general",
    title: null,
    icon: null,
    status: "idle",
    reportsTo: null,
    capabilities: null,
    adapterType: "process",
    adapterConfig: {},
    runtimeConfig: {},
    budgetMonthlyCents: 0,
    spentMonthlyCents: 0,
    permissions: {},
    lastHeartbeatAt: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Parameters<typeof parseCircuitBreakerConfig>[0];
}
