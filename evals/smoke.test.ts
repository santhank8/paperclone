import { describe, it, expect } from "vitest";
import { runScenario } from "./runners/scenario-runner.js";
import { scoreRubric } from "./runners/rubric-scorer.js";
import * as coreCases from "./cases/core/index.js";
import { CORE_CASE_COUNT } from "./cases/core/index.js";

describe("Evals Smoke Suite", () => {
  const cases = Object.values(coreCases).filter(
    (v): v is import("./types.js").EvalCase => typeof v === "object" && v !== null && "id" in v,
  );

  for (const evalCase of cases) {
    it(`${evalCase.id}: ${evalCase.description}`, () => {
      const trace = runScenario(evalCase);
      expect(trace.passed, `Failed checks: ${trace.failedChecks.join(", ")}`).toBe(true);
      expect(trace.durationMs).toBeLessThan(5000);
    });
  }

  it("should have exactly 5 core cases", () => {
    expect(cases).toHaveLength(CORE_CASE_COUNT);
  });

  it("rubric scores should all pass for core cases", () => {
    for (const evalCase of cases) {
      const trace = runScenario(evalCase);
      const rubric = scoreRubric(trace);
      expect(rubric.pass, `Rubric failed for ${evalCase.id}: weightedTotal=${rubric.weightedTotal}`).toBe(true);
    }
  });
});
