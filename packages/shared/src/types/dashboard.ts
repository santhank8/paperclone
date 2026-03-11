export interface DashboardSummary {
  companyId: string;
  agents: {
    actionable: number;
    running: number;
    paused: number;
    error: number;
    idleWithoutActionable: number;
  };
  tasks: {
    open: number;
    inProgress: number;
    blocked: number;
    done: number;
  };
  costs: {
    monthSpendCents: number;
    monthBudgetCents: number;
    monthUtilizationPercent: number;
  };
  pendingApprovals: number;
  staleTasks: number;
  runtimeHealth?: {
    windowDays: number;
    totalRuns: number;
    timerWakeSkipPct: number | null;
    stderrNoisePct: number | null;
    sessionResumeRatePct: number | null;
    medianTimerInputTokens: number | null;
  };
}
