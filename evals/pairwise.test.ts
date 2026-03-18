import { describe, it, expect } from "vitest";
import { judgePairwise } from "./runners/pairwise-judge.js";
import { scoreRubric } from "./runners/rubric-scorer.js";
import type { EvalTrace, RubricResult } from "./types.js";

function makeTrace(overrides: Partial<EvalTrace> = {}): EvalTrace {
  return {
    caseId: "test.pairwise",
    bundleId: "bundle-default",
    passed: true,
    failedChecks: [],
    durationMs: 50,
    output: JSON.stringify({
      action: "acknowledge_assignment",
      issueId: "eval-issue-001",
      comment: 'I\'ve picked up the task: "Test task". Starting work now. My plan:\n1. Review requirements\n2. Implement solution\n3. Submit for review',
      status: "in_progress",
    }),
    ...overrides,
  };
}

function makeDegradedTrace(overrides: Partial<EvalTrace> = {}): EvalTrace {
  return {
    caseId: "test.pairwise",
    bundleId: "bundle-degraded",
    passed: false,
    failedChecks: ["contains(acknowledge)"],
    durationMs: 500,
    output: JSON.stringify({
      action: "unknown",
      status: "pending_unknown",
    }),
    ...overrides,
  };
}

describe("Pairwise Judge", () => {
  it("should return tie when outputs are identical", () => {
    const traceA = makeTrace({ bundleId: "bundle-A" });
    const traceB = makeTrace({ bundleId: "bundle-B" });
    const rubricA = scoreRubric(traceA);
    const rubricB = scoreRubric(traceB);

    const result = judgePairwise("test.pairwise", traceA, rubricA, traceB, rubricB);

    expect(result.caseId).toBe("test.pairwise");
    expect(result.bundleA).toBe("bundle-A");
    expect(result.bundleB).toBe("bundle-B");
    expect(result.winner).toBe("tie");

    // All dimensions should be ties
    for (const dim of Object.values(result.dimensions)) {
      expect(dim).toBe("tie");
    }
  });

  it("should select winner when one output is clearly better", () => {
    const traceA = makeTrace({ bundleId: "bundle-good" });
    const traceB = makeDegradedTrace({ bundleId: "bundle-bad" });
    const rubricA = scoreRubric(traceA);
    const rubricB = scoreRubric(traceB);

    const result = judgePairwise("test.pairwise", traceA, rubricA, traceB, rubricB);

    expect(result.winner).toBe("A");
    expect(result.reasoning).toContain("A wins");

    // A should win at least some dimensions
    const aWins = Object.values(result.dimensions).filter((v) => v === "A").length;
    expect(aWins).toBeGreaterThan(0);
  });

  it("should select B when B is better", () => {
    const traceA = makeDegradedTrace({ bundleId: "bundle-bad" });
    const traceB = makeTrace({ bundleId: "bundle-good" });
    const rubricA = scoreRubric(traceA);
    const rubricB = scoreRubric(traceB);

    const result = judgePairwise("test.pairwise", traceA, rubricA, traceB, rubricB);

    expect(result.winner).toBe("B");
    expect(result.reasoning).toContain("B wins");
  });

  it("should include all standard dimensions in comparison", () => {
    const traceA = makeTrace({ bundleId: "A" });
    const traceB = makeTrace({ bundleId: "B" });
    const rubricA = scoreRubric(traceA);
    const rubricB = scoreRubric(traceB);

    const result = judgePairwise("test.pairwise", traceA, rubricA, traceB, rubricB);

    const expectedDims = ["task_acknowledgment", "action_clarity", "status_correctness", "information_completeness"];
    for (const dim of expectedDims) {
      expect(result.dimensions).toHaveProperty(dim);
    }
  });
});
