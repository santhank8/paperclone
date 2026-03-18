"use client";

import { useState } from "react";

type Props = {
  questionnaireId: string;
  brandName: string;
};

const TIERS = [
  {
    id: "basic" as const,
    name: "Basic",
    price: "$19",
    features: [
      "Logo files (PNG)",
      "Color palette (CSS, JSON, HTML swatch)",
      "Typography guide (CSS, JSON, HTML specimen)",
    ],
  },
  {
    id: "premium" as const,
    name: "Premium",
    price: "$49",
    popular: true,
    features: [
      "Everything in Basic",
      "Social media templates",
      "Business card mockup",
    ],
  },
];

export function StepExport({ questionnaireId, brandName }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckout(tier: "basic" | "premium") {
    setLoading(tier);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionnaireId, tier }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Checkout failed");
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not start checkout."
      );
      setLoading(null);
    }
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full" style={{ background: "rgba(0, 245, 255, 0.1)", boxShadow: "0 0 30px rgba(0, 245, 255, 0.2)" }}>
          <svg
            className="h-8 w-8"
            style={{ color: "var(--accent-cyan)" }}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.5 12.75l6 6 9-13.5"
            />
          </svg>
        </div>
        <h3 className="mt-4 text-xl font-bold text-[var(--text-primary)]">
          Your <span className="gradient-text">{brandName}</span> brand kit is ready!
        </h3>
        <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
          Choose a plan to download your complete brand kit.
        </p>
      </div>

      {/* Pricing cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {TIERS.map((tier) => (
          <div
            key={tier.id}
            className={`relative rounded-xl border-2 p-6 transition-all ${
              tier.popular
                ? "border-[var(--primary)] bg-[var(--primary)]/5 shadow-[0_0_40px_var(--primary)20]"
                : "border-white/10 bg-white/5 hover:border-white/20"
            }`}
          >
            {tier.popular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--primary)] px-3 py-0.5 text-xs font-semibold text-white shadow-[0_0_20px_var(--primary)]">
                Most Popular
              </span>
            )}
            <h4 className="text-lg font-bold text-[var(--text-primary)]">{tier.name}</h4>
            <p className="mt-1 text-3xl font-bold text-[var(--text-primary)]">
              {tier.price}
              <span className="text-sm font-normal" style={{ color: "var(--text-muted)" }}>
                {" "}one-time
              </span>
            </p>
            <ul className="mt-4 space-y-2">
              {tier.features.map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-2 text-sm"
                  style={{ color: "var(--text-muted)" }}
                >
                  <svg
                    className="mt-0.5 h-4 w-4 shrink-0"
                    style={{ color: "var(--accent-cyan)" }}
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.5 12.75l6 6 9-13.5"
                    />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => handleCheckout(tier.id)}
              disabled={loading !== null}
              className={`mt-6 w-full rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-50 transition-all ${
                tier.popular
                  ? "cta-glow bg-[var(--primary)] text-white hover:brightness-110"
                  : "bg-white/10 text-[var(--text-primary)] border border-white/20 hover:bg-white/15"
              }`}
            >
              {loading === tier.id ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Redirecting...
                </span>
              ) : (
                `Get ${tier.name} Kit`
              )}
            </button>
          </div>
        ))}
      </div>

      {error && (
        <p className="text-center text-sm text-red-400">{error}</p>
      )}

      <div className="text-center">
        <a
          href="/"
          className="text-sm underline transition-colors hover:text-[var(--text-primary)]"
          style={{ color: "var(--text-muted)" }}
        >
          Back to home
        </a>
      </div>
    </div>
  );
}
