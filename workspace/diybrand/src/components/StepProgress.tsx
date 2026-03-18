type StepProgressProps = {
  currentStep: number;
  labels: string[];
};

export function StepProgress({ currentStep, labels }: StepProgressProps) {
  return (
    <nav aria-label="Wizard progress">
      {/* Progress bar */}
      <div className="mb-4 flex items-center gap-2" role="progressbar" aria-valuenow={currentStep} aria-valuemin={1} aria-valuemax={labels.length} aria-label={`Step ${currentStep} of ${labels.length}: ${labels[currentStep - 1]}`}>
        {labels.map((label, i) => {
          const stepNum = i + 1;
          const isActive = stepNum === currentStep;
          const isComplete = stepNum < currentStep;
          return (
            <div
              key={i}
              className={`h-2 flex-1 rounded-full transition-colors ${
                isComplete
                  ? "bg-[var(--primary)]"
                  : isActive
                    ? "bg-[var(--accent-cyan)]"
                    : "bg-white/10"
              }`}
              aria-hidden="true"
            />
          );
        })}
      </div>

      {/* Step label */}
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium" style={{ color: "var(--text-primary)" }}>
          Step {currentStep}: {labels[currentStep - 1]}
        </span>
        <span style={{ color: "var(--text-muted)" }} aria-hidden="true">
          {currentStep} of {labels.length}
        </span>
      </div>
    </nav>
  );
}
