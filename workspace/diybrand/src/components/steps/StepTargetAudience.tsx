import type { QuestionnaireData } from "../BrandWizard";

type Props = {
  data: QuestionnaireData;
  updateData: (partial: Partial<QuestionnaireData>) => void;
  errors: Record<string, string>;
};

export function StepTargetAudience({ data, updateData, errors }: Props) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">Who are your customers?</h3>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          Describe your ideal customer. Think about their age, interests, problems they&apos;re
          trying to solve, and what draws them to your business.
        </p>
      </div>

      <div>
        <label htmlFor="targetAudience" className="block text-sm font-medium text-[var(--text-primary)]">
          Target audience
        </label>
        <textarea
          id="targetAudience"
          value={data.targetAudience}
          onChange={(e) => updateData({ targetAudience: e.target.value })}
          rows={5}
          placeholder="e.g. Young professionals aged 25-35 who care about sustainability and are willing to pay a premium for ethically-sourced coffee. They're active on Instagram and value aesthetics and community."
          aria-invalid={!!errors.targetAudience}
          aria-describedby={errors.targetAudience ? "targetAudience-error" : undefined}
          className={`mt-1.5 block w-full rounded-lg border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-[var(--text-primary)] shadow-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] transition-colors ${
            errors.targetAudience ? "border-red-400/60" : ""
          }`}
        />
        {errors.targetAudience && (
          <p id="targetAudience-error" className="mt-1 text-sm text-[var(--accent-pink)]" role="alert">{errors.targetAudience}</p>
        )}
      </div>
    </div>
  );
}
