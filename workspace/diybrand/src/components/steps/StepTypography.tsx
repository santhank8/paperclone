"use client";

import { useState, useEffect, useCallback, useRef } from "react";

type FontInfo = {
  family: string;
  weight: number;
  category: string;
};

type TypographyOption = {
  id: string;
  name: string;
  heading: FontInfo;
  body: FontInfo;
};

type Props = {
  questionnaireId: string;
  onComplete: () => void;
};

function googleFontsUrl(pairs: TypographyOption[]): string {
  const families = new Set<string>();
  for (const pair of pairs) {
    families.add(
      `family=${encodeURIComponent(pair.heading.family)}:wght@${pair.heading.weight}`
    );
    families.add(
      `family=${encodeURIComponent(pair.body.family)}:wght@${pair.body.weight}`
    );
  }
  return `https://fonts.googleapis.com/css2?${[...families].join("&")}&display=swap`;
}

export function StepTypography({ questionnaireId, onComplete }: Props) {
  const [pairs, setPairs] = useState<TypographyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const generateCalled = useRef(false);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate/typography", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionnaireId }),
      });
      if (!res.ok) throw new Error("Failed to generate typography pairs");
      const data = await res.json();
      setPairs(data.pairs);

      // Load Google Fonts
      if (data.pairs.length > 0) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = googleFontsUrl(data.pairs);
        link.onload = () => setFontsLoaded(true);
        document.head.appendChild(link);
      }
    } catch {
      setError("Could not generate typography pairs. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [questionnaireId]);

  useEffect(() => {
    if (generateCalled.current) return;
    generateCalled.current = true;
    generate();
  }, [generate]);

  const handleSelect = useCallback(
    async (typographyId: string) => {
      setSelectedId(typographyId);
      setSaving(true);
      try {
        const res = await fetch("/api/typography/select", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ typographyId, questionnaireId }),
        });
        if (!res.ok) throw new Error("Failed to save selection");
      } catch {
        setError("Could not save selection.");
      } finally {
        setSaving(false);
      }
    },
    [questionnaireId]
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16" role="status" aria-busy="true" aria-live="polite">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/10 border-t-[var(--accent-cyan)]" aria-hidden="true" />
        <p className="mt-4 text-sm" style={{ color: "var(--text-muted)" }}>Finding the perfect font pairs...</p>
      </div>
    );
  }

  if (error && pairs.length === 0) {
    return (
      <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-6 text-center" role="alert">
        <p className="text-sm text-red-400">{error}</p>
        <button
          type="button"
          onClick={() => {
            generateCalled.current = false;
            generate();
          }}
          className="cta-glow mt-4 rounded-lg bg-[var(--primary)] px-5 py-2 text-sm font-semibold text-white hover:brightness-110"
        >
          Retry
        </button>
      </div>
    );
  }

  const selectedPair = pairs.find((p) => p.id === selectedId);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">Choose your typography</h3>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          We paired heading and body fonts based on your brand personality.
          Pick the combination that feels right.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-3" role="radiogroup" aria-label="Typography options">
        {pairs.map((pair) => {
          const isSelected = selectedId === pair.id;
          return (
            <button
              key={pair.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`${pair.name}: ${pair.heading.family} heading with ${pair.body.family} body${isSelected ? " (selected)" : ""}`}
              onClick={() => handleSelect(pair.id)}
              className={`group rounded-xl border-2 p-5 text-left transition-all ${
                isSelected
                  ? "border-[var(--primary)] shadow-[0_0_30px_var(--primary)30]"
                  : "border-white/10 hover:border-white/20 hover:bg-white/5"
              }`}
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  {pair.name}
                </span>
                {isSelected && (
                  <span className="rounded-full bg-[var(--primary)]/20 border border-[var(--primary)]/30 px-2 py-0.5 text-xs font-medium text-[var(--primary)]">
                    ✓ Selected
                  </span>
                )}
              </div>

              {/* Font preview */}
              <div
                className="rounded-lg bg-white/5 p-4"
                style={{ opacity: fontsLoaded ? 1 : 0.6, transition: "opacity 0.3s" }}
              >
                <p
                  className="text-2xl leading-tight text-[var(--text-primary)]"
                  style={{
                    fontFamily: `"${pair.heading.family}", ${pair.heading.category}`,
                    fontWeight: pair.heading.weight,
                  }}
                >
                  The quick brown fox
                </p>
                <p
                  className="mt-2 text-sm leading-relaxed"
                  style={{
                    fontFamily: `"${pair.body.family}", ${pair.body.category}`,
                    fontWeight: pair.body.weight,
                    color: "var(--text-muted)",
                  }}
                >
                  Pack my box with five dozen liquor jugs. The quick brown fox
                  jumps over the lazy dog near the riverbank.
                </p>
              </div>

              {/* Font details */}
              <div className="mt-3 space-y-1">
                <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                  <span className="inline-block w-14 font-medium text-[var(--text-primary)]">Heading</span>
                  <span>{pair.heading.family}</span>
                  <span className="text-white/20">·</span>
                  <span>{pair.heading.weight}</span>
                  <span className="text-white/20">·</span>
                  <span>{pair.heading.category}</span>
                </div>
                <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                  <span className="inline-block w-14 font-medium text-[var(--text-primary)]">Body</span>
                  <span>{pair.body.family}</span>
                  <span className="text-white/20">·</span>
                  <span>{pair.body.weight}</span>
                  <span className="text-white/20">·</span>
                  <span>{pair.body.category}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div aria-live="polite" className="sr-only">
        {selectedPair ? `Selected typography: ${selectedPair.name}` : ""}
      </div>

      {error && pairs.length > 0 && (
        <p className="text-sm text-red-400" role="alert">{error}</p>
      )}

      {selectedId && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onComplete}
            disabled={saving}
            className="cta-glow rounded-lg bg-[var(--primary)] px-6 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50 transition-all"
          >
            {saving ? "Saving..." : "Continue with this typography"}
          </button>
        </div>
      )}
    </div>
  );
}
