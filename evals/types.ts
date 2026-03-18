export interface HardCheck {
  type: "contains" | "regex" | "json_path";
  value: string;
  path?: string;
  /** If true, the check asserts the value is NOT present */
  negate?: boolean;
}

export interface EvalCase {
  id: string;
  description: string;
  tags: string[];
  setup: {
    fixture: string;
    agentRole?: string;
    trigger: "assignment" | "timer" | "on_demand" | "comment" | "approval";
  };
  /** Simulated input to the agent */
  input: {
    issueTitle: string;
    issueBody: string;
    existingComments?: string[];
  };
  checks: {
    hard: HardCheck[];
  };
}

export interface EvalBundle {
  id: string;
  adapter: string;
  model: string;
  skills: string[];
}

export interface EvalTrace {
  caseId: string;
  bundleId: string;
  passed: boolean;
  failedChecks: string[];
  durationMs: number;
  output: string;
}

export interface EvalResult {
  bundle: EvalBundle;
  traces: EvalTrace[];
  totalPassed: number;
  totalFailed: number;
}

// --- Phase 2: Rubric Scorer + Efficiency Metrics ---

export interface RubricDimension {
  name: string;
  weight: number; // 0-1
  description: string;
}

export interface RubricScore {
  dimension: string;
  score: number; // 0-1
  reasoning: string;
}

export interface RubricResult {
  caseId: string;
  bundleId: string;
  scores: RubricScore[];
  weightedTotal: number; // weighted avg 0-1
  pass: boolean; // weightedTotal >= threshold
}

export interface EfficiencyMetrics {
  caseId: string;
  bundleId: string;
  durationMs: number;
  outputLengthChars: number;
  checksPassed: number;
  checksTotal: number;
  passRate: number; // 0-1
  efficiency: number; // passRate / max(1, durationMs/1000) — passes per second
}

// --- Phase 3: Pairwise Judge ---

export interface PairwiseComparison {
  caseId: string;
  bundleA: string;
  bundleB: string;
  winner: "A" | "B" | "tie";
  reasoning: string;
  dimensions: Record<string, "A" | "B" | "tie">;
}
