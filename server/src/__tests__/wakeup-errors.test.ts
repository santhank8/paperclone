import { describe, expect, it } from "vitest";
import { HttpError, conflict } from "../errors.js";
import { getAgentNotInvokableStatus, isAgentNotInvokableWakeupError } from "../services/wakeup-errors.js";

describe("wakeup errors", () => {
  it("classifies canonical non-invokable conflicts", () => {
    const error = conflict("Agent is not invokable in its current state", { status: "paused" });
    expect(isAgentNotInvokableWakeupError(error)).toBe(true);
    expect(getAgentNotInvokableStatus(error)).toBe("paused");
  });

  it("classifies status-based non-invokable conflicts", () => {
    const error = new HttpError(409, "any conflict", { status: "pending_approval" });
    expect(isAgentNotInvokableWakeupError(error)).toBe(true);
    expect(getAgentNotInvokableStatus(error)).toBe("pending_approval");
  });

  it("does not classify unrelated conflicts", () => {
    const error = conflict("another conflict", { status: "rate_limited" });
    expect(isAgentNotInvokableWakeupError(error)).toBe(false);
    expect(getAgentNotInvokableStatus(error)).toBeNull();
  });
});
