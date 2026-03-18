import type { QuestionnaireData } from "../BrandWizard";

type Props = {
  data: QuestionnaireData;
  updateData: (partial: Partial<QuestionnaireData>) => void;
  errors: Record<string, string>;
};

const ADJECTIVES = [
  "Bold",
  "Playful",
  "Elegant",
  "Minimal",
  "Warm",
  "Trustworthy",
  "Innovative",
  "Edgy",
  "Friendly",
  "Luxurious",
  "Rustic",
  "Modern",
  "Classic",
  "Energetic",
  "Calm",
  "Professional",
  "Quirky",
  "Sophisticated",
  "Organic",
  "Techy",
];

export function StepBrandPersonality({ data, updateData, errors }: Props) {
  const toggle = (adj: string) => {
    const current = data.brandPersonality;
    if (current.includes(adj)) {
      updateData({ brandPersonality: current.filter((a) => a !== adj) });
    } else if (current.length < 5) {
      updateData({ brandPersonality: [...current, adj] });
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">Brand personality</h3>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          Select 3 to 5 adjectives that best describe how your brand should feel.
        </p>
      </div>

      <div className="flex flex-wrap gap-2.5" role="group" aria-label="Brand personality adjectives">
        {ADJECTIVES.map((adj) => {
          const selected = data.brandPersonality.includes(adj);
          return (
            <button
              key={adj}
              type="button"
              onClick={() => toggle(adj)}
              aria-pressed={selected}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                selected
                  ? "border-[var(--primary)] bg-[var(--primary)] text-white shadow-[0_0_20px_var(--primary)]"
                  : "border-white/15 bg-white/5 text-[var(--text-primary)] hover:border-[var(--primary)]/50 hover:bg-white/10"
              }`}
            >
              {selected ? `✓ ${adj}` : adj}
            </button>
          );
        })}
      </div>

      {errors.brandPersonality && (
        <p className="text-sm text-[var(--accent-pink)]" role="alert">{errors.brandPersonality}</p>
      )}

      {data.brandPersonality.length > 0 && (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Selected: {data.brandPersonality.join(", ")} ({data.brandPersonality.length}/5)
        </p>
      )}
    </div>
  );
}
