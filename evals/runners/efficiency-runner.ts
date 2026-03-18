import type { EvalTrace, EfficiencyMetrics } from "../types.js";

/**
 * Computes efficiency metrics from an EvalTrace.
 * Efficiency = passRate / max(1, durationMs/1000) — passes per second.
 */
export function computeEfficiency(
  trace: EvalTrace,
  checksTotal: number,
): EfficiencyMetrics {
  const checksPassed = checksTotal - trace.failedChecks.length;
  const passRate = checksTotal > 0 ? checksPassed / checksTotal : 0;
  const durationSeconds = Math.max(1, trace.durationMs / 1000);
  const efficiency = passRate / durationSeconds;

  return {
    caseId: trace.caseId,
    bundleId: trace.bundleId,
    durationMs: trace.durationMs,
    outputLengthChars: trace.output.length,
    checksPassed,
    checksTotal,
    passRate,
    efficiency,
  };
}
