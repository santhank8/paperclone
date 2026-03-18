import type { QuestionnaireData } from "../BrandWizard";

type Props = {
  data: QuestionnaireData;
  updateData: (partial: Partial<QuestionnaireData>) => void;
  errors: Record<string, string>;
};

const INDUSTRIES = [
  "Technology",
  "E-commerce",
  "Food & Beverage",
  "Health & Wellness",
  "Education",
  "Finance",
  "Creative & Design",
  "Real Estate",
  "Fashion & Apparel",
  "Travel & Hospitality",
  "Entertainment",
  "Consulting",
  "Non-profit",
  "Other",
];

const inputBase =
  "mt-1.5 block w-full rounded-lg border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-[var(--text-primary)] shadow-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] transition-colors";
const inputError = "border-red-400/60";

export function StepBusinessBasics({ data, updateData, errors }: Props) {
  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="businessName" className="block text-sm font-medium text-[var(--text-primary)]">
          Business name
        </label>
        <input
          id="businessName"
          type="text"
          value={data.businessName}
          onChange={(e) => updateData({ businessName: e.target.value })}
          placeholder="e.g. Sunrise Coffee Co."
          aria-invalid={!!errors.businessName}
          aria-describedby={errors.businessName ? "businessName-error" : undefined}
          className={`${inputBase} ${errors.businessName ? inputError : ""}`}
        />
        {errors.businessName && (
          <p id="businessName-error" className="mt-1 text-sm text-[var(--accent-pink)]" role="alert">{errors.businessName}</p>
        )}
      </div>

      <div>
        <label htmlFor="industry" className="block text-sm font-medium text-[var(--text-primary)]">
          Industry
        </label>
        <select
          id="industry"
          value={data.industry}
          onChange={(e) => updateData({ industry: e.target.value })}
          aria-invalid={!!errors.industry}
          aria-describedby={errors.industry ? "industry-error" : undefined}
          className={`${inputBase} ${errors.industry ? inputError : ""} ${!data.industry ? "text-white/30" : ""}`}
        >
          <option value="">Select an industry</option>
          {INDUSTRIES.map((ind) => (
            <option key={ind} value={ind}>
              {ind}
            </option>
          ))}
        </select>
        {errors.industry && (
          <p id="industry-error" className="mt-1 text-sm text-[var(--accent-pink)]" role="alert">{errors.industry}</p>
        )}
      </div>

      <div>
        <label htmlFor="businessDescription" className="block text-sm font-medium text-[var(--text-primary)]">
          Describe your business in a few sentences
        </label>
        <textarea
          id="businessDescription"
          value={data.businessDescription}
          onChange={(e) => updateData({ businessDescription: e.target.value })}
          rows={3}
          placeholder="What do you do? What makes you different?"
          aria-invalid={!!errors.businessDescription}
          aria-describedby={errors.businessDescription ? "businessDescription-error" : undefined}
          className={`${inputBase} ${errors.businessDescription ? inputError : ""}`}
        />
        {errors.businessDescription && (
          <p id="businessDescription-error" className="mt-1 text-sm text-[var(--accent-pink)]" role="alert">{errors.businessDescription}</p>
        )}
      </div>
    </div>
  );
}
