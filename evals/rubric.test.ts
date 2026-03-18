import { describe, it, expect } from "vitest";
import { runScenario } from "./runners/scenario-runner.js";
import { scoreRubric } from "./runners/rubric-scorer.js";
import { computeEfficiency } from "./runners/efficiency-runner.js";
import * as coreCases from "./cases/core/index.js";
import type { EvalCase } from "./types.js";

describe("Rubric Scorer", () => {
  const cases = Object.values(coreCases).filter(
    (v): v is EvalCase => typeof v === "object" && v !== null && "id" in v,
  );

  for (const evalCase of cases) {
    it(`${evalCase.id}: rubric score should pass (>= 0.6)`, () => {
      const trace = runScenario(evalCase);
      const rubric = scoreRubric(trace);

      expect(rubric.caseId).toBe(evalCase.id);
      expect(rubric.bundleId).toBe("deterministic-sim");
      expect(rubric.scores).toHaveLength(4);
      expect(rubric.weightedTotal).toBeGreaterThanOrEqual(0.6);
      expect(rubric.pass).toBe(true);

      // Every dimension should have a reasoning string
      for (const score of rubric.scores) {
        expect(score.reasoning).toBeTruthy();
        expect(score.score).toBeGreaterThanOrEqual(0);
        expect(score.score).toBeLessThanOrEqual(1);
      }
    });
  }

  it("should return pass=false for low-quality output", () => {
    const badTrace = {
      caseId: "test.bad",
      bundleId: "test",
      passed: false,
      failedChecks: [],
      durationMs: 100,
      output: "x",
    };
    const rubric = scoreRubric(badTrace);
    expect(rubric.weightedTotal).toBeLessThan(0.6);
    expect(rubric.pass).toBe(false);
  });
});

describe("Efficiency Metrics", () => {
  const cases = Object.values(coreCases).filter(
    (v): v is EvalCase => typeof v === "object" && v !== null && "id" in v,
  );

  for (const evalCase of cases) {
    it(`${evalCase.id}: efficiency metrics should be computed`, () => {
      const trace = runScenario(evalCase);
      const checksTotal = evalCase.checks.hard.length;
      const metrics = computeEfficiency(trace, checksTotal);

      expect(metrics.caseId).toBe(evalCase.id);
      expect(metrics.bundleId).toBe("deterministic-sim");
      expect(metrics.checksTotal).toBe(checksTotal);
      expect(metrics.checksPassed).toBe(checksTotal); // scenario runner passes all
      expect(metrics.passRate).toBe(1);
      expect(metrics.efficiency).toBeGreaterThan(0);
      expect(metrics.outputLengthChars).toBeGreaterThan(0);
      expect(metrics.durationMs).toBeGreaterThanOrEqual(0);
    });
  }

  it("should compute correct passRate for partial failures", () => {
    const trace = {
      caseId: "test.partial",
      bundleId: "test",
      passed: false,
      failedChecks: ["check1", "check2"],
      durationMs: 2000,
      output: "some output",
    };
    const metrics = computeEfficiency(trace, 5);

    expect(metrics.checksPassed).toBe(3);
    expect(metrics.checksTotal).toBe(5);
    expect(metrics.passRate).toBeCloseTo(0.6);
    expect(metrics.efficiency).toBeCloseTo(0.3); // 0.6 / 2 seconds
  });
});
