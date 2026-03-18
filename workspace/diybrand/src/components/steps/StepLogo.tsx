"use client";

import { useState, useEffect, useCallback } from "react";

type LogoOption = {
  id: string;
  name: string;
  variant: string;
  imageData: string;
};

type Props = {
  questionnaireId: string;
  onComplete: () => void;
};

export function StepLogo({ questionnaireId, onComplete }: Props) {
  const [logos, setLogos] = useState<LogoOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function generate() {
      try {
        const res = await fetch("/api/generate/logo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionnaireId }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to generate logos");
        }
        const data = await res.json();
        setLogos(data.logos);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Could not generate logos. Please try again."
        );
      } finally {
        setLoading(false);
      }
    }
    generate();
  }, [questionnaireId]);

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
      <div className="flex flex-col items-center justify-center py-16">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
        <p className="mt-4 text-sm text-gray-500">
          Generating your logo concepts...
        </p>
        <p className="mt-2 text-xs text-gray-400">
          This may take a minute while our AI creates unique designs for your
          brand.
        </p>
      </div>
    );
  }

  if (error && logos.length === 0) {
    return (
      <div className="rounded-lg bg-red-50 p-6 text-center">
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">
          Choose your logo
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          We generated these logo concepts based on your brand identity. Pick
          the one that resonates most with your vision.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {logos.map((logo) => {
          const isSelected = selectedId === logo.id;
          return (
            <button
              key={logo.id}
              type="button"
              onClick={() => handleSelect(logo.id)}
              className={`group rounded-xl border-2 p-4 text-left transition-all ${
                isSelected
                  ? "border-violet-600 ring-2 ring-violet-200"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-gray-900">
                    {logo.name}
                  </span>
                  <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                    {logo.variant}
                  </span>
                </div>
                {isSelected && (
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
                    Selected
                  </span>
                )}
              </div>

              {/* Logo image */}
              <div className="flex items-center justify-center rounded-lg bg-white p-4">
                <img
                  src={logo.imageData}
                  alt={`${logo.name} logo concept`}
                  className="max-h-48 w-auto object-contain"
                />
              </div>

              {/* Dark background preview */}
              <div className="mt-2 flex items-center justify-center rounded-lg bg-gray-900 p-4">
                <img
                  src={logo.imageData}
                  alt={`${logo.name} on dark background`}
                  className="max-h-32 w-auto object-contain"
                  style={{ filter: "brightness(1.1)" }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {selectedId && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onComplete}
            disabled={saving}
            className="rounded-lg bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Continue with this logo"}
          </button>
        </div>
      )}
    </div>
  );
}
