"use client";

import { useState, useEffect, useCallback, useRef } from "react";

type LogoOption = {
  id: string;
  name: string;
  variant: string;
  imageUrl: string;
};

type Props = {
  questionnaireId: string;
  onComplete: () => void;
};

const GENERATION_TIMEOUT_MS = 120_000; // 2 minutes

export function StepLogo({ questionnaireId, onComplete }: Props) {
  const [logos, setLogos] = useState<LogoOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const generateCalled = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setTimedOut(false);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const timeout = setTimeout(() => {
      controller.abort();
      setTimedOut(true);
    }, GENERATION_TIMEOUT_MS);

    try {
      const res = await fetch("/api/generate/logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionnaireId }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to generate logos");
      }
      const data = await res.json();
      setLogos(data.logos);
    } catch (err) {
      if (controller.signal.aborted) {
        setError("Logo generation is taking too long. Please try again.");
        setTimedOut(true);
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "Could not generate logos. Please try again."
        );
      }
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }, [questionnaireId]);

  useEffect(() => {
    if (generateCalled.current) return;
    generateCalled.current = true;
    generate();
    return () => {
      abortRef.current?.abort();
    };
  }, [generate]);

  const handleRetry = useCallback(() => {
    generateCalled.current = false;
    generate();
  }, [generate]);

  const handleSelect = useCallback(
    async (logoId: string) => {
      setSelectedId(logoId);
      setSaving(true);
      try {
        const res = await fetch("/api/logo/select", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ logoId, questionnaireId }),
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
        <p className="mt-4 text-sm" style={{ color: "var(--text-muted)" }}>
          Generating your logo concepts...
        </p>
        <p className="mt-2 text-xs text-white/30">
          This may take a minute while our AI creates unique designs for your
          brand.
        </p>
      </div>
    );
  }

  if (error && logos.length === 0) {
    return (
      <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-6 text-center" role="alert">
        <p className="text-sm text-red-400">{error}</p>
        {timedOut && (
          <p className="mt-1 text-xs text-red-400/70">
            The AI took too long to respond. This can happen during peak hours.
          </p>
        )}
        <button
          type="button"
          onClick={handleRetry}
          className="cta-glow mt-4 rounded-lg bg-[var(--primary)] px-5 py-2 text-sm font-semibold text-white hover:brightness-110"
        >
          Retry
        </button>
      </div>
    );
  }

  const selectedLogo = logos.find((l) => l.id === selectedId);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">
          Choose your logo
        </h3>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          We generated these logo concepts based on your brand identity. Pick
          the one that resonates most with your vision.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2" role="radiogroup" aria-label="Logo options">
        {logos.map((logo) => {
          const isSelected = selectedId === logo.id;
          return (
            <button
              key={logo.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`${logo.name} — ${logo.variant}${isSelected ? " (selected)" : ""}`}
              onClick={() => handleSelect(logo.id)}
              className={`group rounded-xl border-2 p-4 text-left transition-all ${
                isSelected
                  ? "border-[var(--primary)] shadow-[0_0_30px_var(--primary)30]"
                  : "border-white/10 hover:border-white/20 hover:bg-white/5"
              }`}
            >
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                    {logo.name}
                  </span>
                  <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/50">
                    {logo.variant}
                  </span>
                </div>
                {isSelected && (
                  <span className="rounded-full bg-[var(--primary)]/20 border border-[var(--primary)]/30 px-2 py-0.5 text-xs font-medium text-[var(--primary)]">
                    ✓ Selected
                  </span>
                )}
              </div>

              {/* Logo image — light bg */}
              <div className="flex items-center justify-center rounded-lg bg-white p-4">
                <img
                  src={logo.imageUrl}
                  alt={`${logo.name} logo concept`}
                  className="max-h-48 w-auto object-contain"
                />
              </div>

              {/* Dark background preview */}
              <div className="mt-2 flex items-center justify-center rounded-lg p-4" style={{ background: "var(--bg-card)" }}>
                <img
                  src={logo.imageUrl}
                  alt={`${logo.name} on dark background`}
                  className="max-h-32 w-auto object-contain"
                  style={{ filter: "brightness(1.1)" }}
                />
              </div>
            </button>
          );
        })}
      </div>

      <div aria-live="polite" className="sr-only">
        {selectedLogo ? `Selected logo: ${selectedLogo.name}` : ""}
      </div>

      {error && logos.length > 0 && (
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
            {saving ? "Saving..." : "Continue with this logo"}
          </button>
        </div>
      )}
    </div>
  );
}
