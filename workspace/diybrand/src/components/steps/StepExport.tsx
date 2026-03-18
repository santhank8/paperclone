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
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
          <svg
            className="h-8 w-8 text-emerald-600"
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
        <h3 className="mt-4 text-xl font-bold text-gray-900">
          Your {brandName} brand kit is ready!
        </h3>
        <p className="mt-2 text-sm text-gray-500">
          Choose a plan to download your complete brand kit.
        </p>
      </div>

      {/* Pricing cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {TIERS.map((tier) => (
          <div
            key={tier.id}
            className={`relative rounded-xl border-2 p-6 ${
              tier.popular
                ? "border-violet-600 bg-violet-50/50"
                : "border-gray-200 bg-white"
            }`}
          >
            {tier.popular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-violet-600 px-3 py-0.5 text-xs font-semibold text-white">
                Most Popular
              </span>
            )}
            <h4 className="text-lg font-bold text-gray-900">{tier.name}</h4>
            <p className="mt-1 text-3xl font-bold text-gray-900">
              {tier.price}
              <span className="text-sm font-normal text-gray-500">
                {" "}one-time
              </span>
            </p>
            <ul className="mt-4 space-y-2">
              {tier.features.map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-2 text-sm text-gray-600"
                >
                  <svg
                    className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500"
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
              className={`mt-6 w-full rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-50 ${
                tier.popular
                  ? "bg-violet-600 text-white hover:bg-violet-700"
                  : "bg-gray-900 text-white hover:bg-gray-800"
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
        <p className="text-center text-sm text-red-600">{error}</p>
      )}

      <div className="text-center">
        <a
          href="/"
          className="text-sm text-gray-500 underline hover:text-gray-700"
        >
          Back to home
        </a>
      </div>
    </div>
  );
}
