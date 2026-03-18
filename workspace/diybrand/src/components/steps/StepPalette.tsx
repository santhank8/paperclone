"use client";

import { useState, useEffect, useCallback, useRef } from "react";

type PaletteColor = {
  role: string;
  hex: string;
  hsl: { h: number; s: number; l: number };
};

type PaletteOption = {
  id: string;
  name: string;
  colors: PaletteColor[];
};

type Props = {
  questionnaireId: string;
  onComplete: () => void;
};

const ROLE_LABELS: Record<string, string> = {
  primary: "Primary",
  secondary: "Secondary",
  accent: "Accent",
  background: "Background",
  text: "Text",
};

export function StepPalette({ questionnaireId, onComplete }: Props) {
  const [palettes, setPalettes] = useState<PaletteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generateCalled = useRef(false);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate/palette", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionnaireId }),
      });
      if (!res.ok) throw new Error("Failed to generate palettes");
      const data = await res.json();
      setPalettes(data.palettes);
    } catch {
      setError("Could not generate palettes. Please try again.");
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
    async (paletteId: string) => {
      setSelectedId(paletteId);
      setSaving(true);
      try {
        const res = await fetch("/api/palette/select", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paletteId, questionnaireId }),
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
        <p className="mt-4 text-sm" style={{ color: "var(--text-muted)" }}>Generating your color palettes...</p>
      </div>
    );
  }

  if (error && palettes.length === 0) {
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

  const selectedPalette = palettes.find((p) => p.id === selectedId);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">Choose your color palette</h3>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          We generated these palettes based on your industry and brand personality.
          Pick the one that feels right.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2" role="radiogroup" aria-label="Color palette options">
        {palettes.map((palette) => {
          const isSelected = selectedId === palette.id;
          return (
            <button
              key={palette.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`${palette.name}${isSelected ? " (selected)" : ""}`}
              onClick={() => handleSelect(palette.id)}
              className={`group rounded-xl border-2 p-4 text-left transition-all ${
                isSelected
                  ? "border-[var(--primary)] shadow-[0_0_30px_var(--primary)30]"
                  : "border-white/10 hover:border-white/20 hover:bg-white/5"
              }`}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  {palette.name}
                </span>
                {isSelected && (
                  <span className="rounded-full bg-[var(--primary)]/20 border border-[var(--primary)]/30 px-2 py-0.5 text-xs font-medium text-[var(--primary)]">
                    ✓ Selected
                  </span>
                )}
              </div>

              {/* Color swatches row */}
              <div className="flex gap-1 overflow-hidden rounded-lg">
                {palette.colors
                  .filter((c) => c.role !== "background" && c.role !== "text")
                  .map((c) => (
                    <div
                      key={c.role}
                      className="h-16 flex-1"
                      style={{ backgroundColor: c.hex }}
                      role="img"
                      aria-label={`${ROLE_LABELS[c.role] ?? c.role}: ${c.hex}`}
                    />
                  ))}
              </div>

              {/* Full palette detail */}
              <div className="mt-3 flex flex-wrap gap-2">
                {palette.colors.map((c) => (
                  <div key={c.role} className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-4 w-4 rounded-full border border-white/20"
                      style={{ backgroundColor: c.hex }}
                      aria-hidden="true"
                    />
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {ROLE_LABELS[c.role] ?? c.role}
                    </span>
                    <span className="font-mono text-xs text-white/30">
                      {c.hex}
                    </span>
                  </div>
                ))}
              </div>

              {/* Preview: text on background */}
              {(() => {
                const bg = palette.colors.find((c) => c.role === "background");
                const txt = palette.colors.find((c) => c.role === "text");
                const primary = palette.colors.find((c) => c.role === "primary");
                if (!bg || !txt || !primary) return null;
                return (
                  <div
                    className="mt-3 rounded-md px-3 py-2"
                    style={{ backgroundColor: bg.hex }}
                  >
                    <p className="text-sm font-semibold" style={{ color: primary.hex }}>
                      Brand Name
                    </p>
                    <p className="text-xs" style={{ color: txt.hex }}>
                      Sample body text for preview
                    </p>
                  </div>
                );
              })()}
            </button>
          );
        })}
      </div>

      <div aria-live="polite" className="sr-only">
        {selectedPalette ? `Selected palette: ${selectedPalette.name}` : ""}
      </div>

      {error && palettes.length > 0 && (
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
            {saving ? "Saving..." : "Continue with this palette"}
          </button>
        </div>
      )}
    </div>
  );
}
