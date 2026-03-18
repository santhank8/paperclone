import type { EvalTrace, RubricDimension, RubricScore, RubricResult } from "../types.js";

const PASS_THRESHOLD = 0.6;

export const STANDARD_DIMENSIONS: RubricDimension[] = [
  {
    name: "task_acknowledgment",
    weight: 0.2,
    description: "Does the output acknowledge the task/issue?",
  },
  {
    name: "action_clarity",
    weight: 0.3,
    description: "Is the action clear and specific?",
  },
  {
    name: "status_correctness",
    weight: 0.3,
    description: "Is the status field correct for the scenario?",
  },
  {
    name: "information_completeness",
    weight: 0.2,
    description: "Does the output contain all required info?",
  },
];

/**
 * Deterministic rubric scorer — no LLM needed.
 * Scores output against predefined rubric dimensions using
 * keyword presence and structure checks.
 */
export function scoreRubric(
  trace: EvalTrace,
  dimensions: RubricDimension[] = STANDARD_DIMENSIONS,
): RubricResult {
  const output = trace.output;
  const scores: RubricScore[] = dimensions.map((dim) => scoreDimension(dim, output));

  const totalWeight = dimensions.reduce((sum, d) => sum + d.weight, 0);
  const weightedTotal =
    totalWeight > 0
      ? scores.reduce((sum, s, i) => sum + s.score * dimensions[i].weight, 0) / totalWeight
      : 0;

  return {
    caseId: trace.caseId,
    bundleId: trace.bundleId,
    scores,
    weightedTotal,
    pass: weightedTotal >= PASS_THRESHOLD,
  };
}

function scoreDimension(dim: RubricDimension, output: string): RubricScore {
  switch (dim.name) {
    case "task_acknowledgment":
      return scoreTaskAcknowledgment(output);
    case "action_clarity":
      return scoreActionClarity(output);
    case "status_correctness":
      return scoreStatusCorrectness(output);
    case "information_completeness":
      return scoreInformationCompleteness(output);
    default:
      return { dimension: dim.name, score: 0, reasoning: `Unknown dimension: ${dim.name}` };
  }
}

function scoreTaskAcknowledgment(output: string): RubricScore {
  const lower = output.toLowerCase();
  let score = 0;
  const reasons: string[] = [];

  // Check for task-related keywords
  const acknowledgmentKeywords = ["task", "issue", "picked up", "acknowledge", "starting", "working on", "request"];
  const matchCount = acknowledgmentKeywords.filter((kw) => lower.includes(kw)).length;
  score += Math.min(matchCount / 2, 0.5);

  if (matchCount > 0) {
    reasons.push(`Found ${matchCount} acknowledgment keyword(s)`);
  } else {
    reasons.push("No acknowledgment keywords found");
  }

  // Check for issue/title reference
  try {
    const parsed = JSON.parse(output);
    if (parsed.comment && typeof parsed.comment === "string" && parsed.comment.length > 10) {
      score += 0.3;
      reasons.push("Comment field present with content");
    }
    if (parsed.issueId) {
      score += 0.2;
      reasons.push("Issue ID referenced");
    }
  } catch {
    // Not JSON — check raw text
    if (lower.length > 20) {
      score += 0.2;
      reasons.push("Output has substantial content");
    }
  }

  return { dimension: "task_acknowledgment", score: Math.min(score, 1), reasoning: reasons.join("; ") };
}

function scoreActionClarity(output: string): RubricScore {
  const lower = output.toLowerCase();
  let score = 0;
  const reasons: string[] = [];

  // Check for action field in JSON
  try {
    const parsed = JSON.parse(output);
    if (parsed.action && typeof parsed.action === "string") {
      score += 0.4;
      reasons.push(`Action field present: "${parsed.action}"`);

      // Check action is specific (not generic)
      const specificActions = [
        "acknowledge_assignment", "progress_comment", "blocked_report",
        "request_approval", "access_denied", "complete", "review",
      ];
      if (specificActions.some((a) => parsed.action.includes(a))) {
        score += 0.3;
        reasons.push("Action is specific and well-named");
      }
    }
  } catch {
    reasons.push("Output is not valid JSON");
  }

  // Check for plan/steps
  const planKeywords = ["plan", "step", "1.", "2.", "review", "implement", "submit", "completed", "progress", "blocker"];
  const planMatches = planKeywords.filter((kw) => lower.includes(kw)).length;
  if (planMatches >= 2) {
    score += 0.3;
    reasons.push(`Found ${planMatches} plan/step keywords`);
  } else if (planMatches === 1) {
    score += 0.15;
    reasons.push("Found 1 plan/step keyword");
  }

  return { dimension: "action_clarity", score: Math.min(score, 1), reasoning: reasons.join("; ") };
}

function scoreStatusCorrectness(output: string): RubricScore {
  let score = 0;
  const reasons: string[] = [];

  try {
    const parsed = JSON.parse(output);
    if (parsed.status && typeof parsed.status === "string") {
      score += 0.5;
      reasons.push(`Status field present: "${parsed.status}"`);

      // Valid statuses
      const validStatuses = [
        "in_progress", "blocked", "waiting_approval", "completed",
        "failed", "pending", "review", "cancelled",
      ];
      if (validStatuses.includes(parsed.status)) {
        score += 0.5;
        reasons.push("Status is a recognized valid value");
      } else {
        score += 0.2;
        reasons.push("Status is present but not a standard value");
      }
    } else {
      reasons.push("No status field in output");
    }
  } catch {
    // Check raw text for status-like words
    const lower = output.toLowerCase();
    const statusWords = ["status", "in progress", "blocked", "completed", "approved", "failed"];
    const found = statusWords.filter((w) => lower.includes(w)).length;
    if (found > 0) {
      score += 0.3;
      reasons.push(`Found ${found} status keyword(s) in raw text`);
    } else {
      reasons.push("No status information found");
    }
  }

  return { dimension: "status_correctness", score: Math.min(score, 1), reasoning: reasons.join("; ") };
}

function scoreInformationCompleteness(output: string): RubricScore {
  let score = 0;
  const reasons: string[] = [];

  try {
    const parsed = JSON.parse(output);
    const fields = Object.keys(parsed);
    const fieldCount = fields.length;

    // Minimum expected: action, issueId, comment, status
    if (fieldCount >= 4) {
      score += 0.5;
      reasons.push(`${fieldCount} fields present (>=4 expected)`);
    } else if (fieldCount >= 2) {
      score += 0.3;
      reasons.push(`Only ${fieldCount} fields present`);
    }

    // Check comment length
    if (parsed.comment && typeof parsed.comment === "string") {
      if (parsed.comment.length >= 50) {
        score += 0.3;
        reasons.push("Comment is detailed (50+ chars)");
      } else if (parsed.comment.length >= 20) {
        score += 0.15;
        reasons.push("Comment is present but brief");
      }
    }

    // Check for context-specific fields
    if (parsed.blockerType || parsed.approvalRequired || parsed.companyIsolation) {
      score += 0.2;
      reasons.push("Contains scenario-specific metadata");
    } else if (parsed.action === "acknowledge_assignment" || parsed.action === "progress_comment") {
      // These don't need extra metadata
      score += 0.2;
      reasons.push("Standard action, no extra metadata needed");
    }
  } catch {
    if (output.length >= 100) {
      score += 0.3;
      reasons.push("Non-JSON output with substantial content");
    } else {
      reasons.push("Output too short or unparseable");
    }
  }

  return { dimension: "information_completeness", score: Math.min(score, 1), reasoning: reasons.join("; ") };
}
