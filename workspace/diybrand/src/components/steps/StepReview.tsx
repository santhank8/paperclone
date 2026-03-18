import type { QuestionnaireData } from "../BrandWizard";

type Props = {
  data: QuestionnaireData;
};

function ReviewSection({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div>
      <dt className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>{label}</dt>
      <dd className="mt-1 text-sm text-[var(--text-primary)]">{value || "—"}</dd>
    </div>
  );
}

export function StepReview({ data }: Props) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">Review your answers</h3>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          Make sure everything looks good before submitting. You can go back to edit any step.
        </p>
      </div>

      <dl className="divide-y divide-white/10 rounded-lg bg-white/5 px-5 py-1">
        <div className="py-4">
          <ReviewSection label="Business name" value={data.businessName} />
        </div>
        <div className="py-4">
          <ReviewSection label="Industry" value={data.industry} />
        </div>
        <div className="py-4">
          <ReviewSection label="Business description" value={data.businessDescription} />
        </div>
        <div className="py-4">
          <ReviewSection label="Target audience" value={data.targetAudience} />
        </div>
        <div className="py-4">
          <dt className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>Brand personality</dt>
          <dd className="mt-2 flex flex-wrap gap-2">
            {data.brandPersonality.length > 0 ? (
              data.brandPersonality.map((adj) => (
                <span
                  key={adj}
                  className="rounded-full border border-[var(--primary)]/30 bg-[var(--primary)]/20 px-3 py-1 text-sm font-medium text-[var(--primary)]"
                >
                  {adj}
                </span>
              ))
            ) : (
              <span className="text-sm text-[var(--text-primary)]">—</span>
            )}
          </dd>
        </div>
        <div className="py-4">
          <ReviewSection label="Brands you admire" value={data.competitors} />
        </div>
        <div className="py-4">
          <ReviewSection label="Visual preferences" value={data.visualPreferences} />
        </div>
      </dl>
    </div>
  );
}
