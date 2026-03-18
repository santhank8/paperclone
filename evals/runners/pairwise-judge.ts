import type { EvalTrace, RubricResult, PairwiseComparison } from "../types.js";

/**
 * Deterministic pairwise comparison — no LLM needed.
 * Compares two EvalTraces using their rubric scores.
 * Returns a PairwiseComparison with per-dimension winners and overall winner.
 */
export function judgePairwise(
  caseId: string,
  traceA: EvalTrace,
  rubricA: RubricResult,
  traceB: EvalTrace,
  rubricB: RubricResult,
): PairwiseComparison {
  const dimensions: Record<string, "A" | "B" | "tie"> = {};
  const EPSILON = 0.01; // scores within epsilon are a tie

  let aWins = 0;
  let bWins = 0;

  // Compare each rubric dimension
  for (const scoreA of rubricA.scores) {
    const scoreB = rubricB.scores.find((s) => s.dimension === scoreA.dimension);
    if (!scoreB) {
      dimensions[scoreA.dimension] = "A";
      aWins++;
      continue;
    }

    const diff = scoreA.score - scoreB.score;
    if (Math.abs(diff) <= EPSILON) {
      dimensions[scoreA.dimension] = "tie";
    } else if (diff > 0) {
      dimensions[scoreA.dimension] = "A";
      aWins++;
    } else {
      dimensions[scoreA.dimension] = "B";
      bWins++;
    }
  }

  // Check for dimensions only in B
  for (const scoreB of rubricB.scores) {
    if (!(scoreB.dimension in dimensions)) {
      dimensions[scoreB.dimension] = "B";
      bWins++;
    }
  }

  // Determine overall winner based on weighted total
  let winner: "A" | "B" | "tie";
  let reasoning: string;

  const totalDiff = rubricA.weightedTotal - rubricB.weightedTotal;

  if (Math.abs(totalDiff) <= EPSILON) {
    winner = "tie";
    reasoning = `Tie: both outputs scored similarly (A=${rubricA.weightedTotal.toFixed(3)}, B=${rubricB.weightedTotal.toFixed(3)}). Dimension wins: A=${aWins}, B=${bWins}.`;
  } else if (totalDiff > 0) {
    winner = "A";
    reasoning = `A wins with weighted total ${rubricA.weightedTotal.toFixed(3)} vs ${rubricB.weightedTotal.toFixed(3)}. A won ${aWins} dimension(s), B won ${bWins}.`;
  } else {
    winner = "B";
    reasoning = `B wins with weighted total ${rubricB.weightedTotal.toFixed(3)} vs ${rubricA.weightedTotal.toFixed(3)}. B won ${bWins} dimension(s), A won ${aWins}.`;
  }

  return {
    caseId,
    bundleA: traceA.bundleId,
    bundleB: traceB.bundleId,
    winner,
    reasoning,
    dimensions,
  };
}
