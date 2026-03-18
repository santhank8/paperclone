"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const industries = [
  "Tech Startup",
  "Coffee Shop",
  "Fitness Studio",
  "Fashion Brand",
  "Photography",
  "Restaurant",
];

const palettes: Record<string, string[]> = {
  "Tech Startup": ["#6366F1", "#22D3EE", "#F8FAFC", "#0F172A"],
  "Coffee Shop": ["#92400E", "#D97706", "#FEF3C7", "#1C1917"],
  "Fitness Studio": ["#DC2626", "#1E1E1E", "#F5F5F5", "#FF6B35"],
  "Fashion Brand": ["#1a1a1a", "#C9A96E", "#F5F0EB", "#2D2D2D"],
  Photography: ["#2D5016", "#8FBC6B", "#F5E6D3", "#1A1A1A"],
  Restaurant: ["#7C2D12", "#EA580C", "#FFF7ED", "#1C1917"],
};

const fonts: Record<string, [string, string]> = {
  "Tech Startup": ["Space Grotesk", "Inter"],
  "Coffee Shop": ["DM Serif Display", "Nunito"],
  "Fitness Studio": ["Oswald", "Roboto"],
  "Fashion Brand": ["Playfair Display", "Lato"],
  Photography: ["Cormorant Garamond", "Source Sans Pro"],
  Restaurant: ["Libre Baskerville", "Open Sans"],
};

export function LiveDemo() {
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const handleGenerate = () => {
    if (name && industry) setShowPreview(true);
  };

  const pal = palettes[industry] || palettes["Tech Startup"];
  const [heading, body] = fonts[industry] || fonts["Tech Startup"];

  return (
    <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-2">
      {/* Input */}
      <div className="flex flex-col justify-center">
        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--text-muted)]">
              Business name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setShowPreview(false);
              }}
              placeholder="e.g. Bloom & Root"
              className="w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-card)] px-4 py-3 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-all focus:border-[var(--primary)] focus:shadow-[0_0_20px_#8b5cf630]"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--text-muted)]">
              Industry
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {industries.map((ind) => (
                <button
                  key={ind}
                  type="button"
                  onClick={() => {
                    setIndustry(ind);
                    setShowPreview(false);
                  }}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                    industry === ind
                      ? "border border-[var(--primary)] bg-[var(--primary)]/20 text-[var(--primary)]"
                      : "glass text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {ind}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!name || !industry}
            className="cta-glow w-full rounded-xl bg-[var(--primary)] px-6 py-3 font-semibold text-white transition-all disabled:opacity-40 disabled:shadow-none"
          >
            Generate Preview
          </button>
        </div>
      </div>

      {/* Preview */}
      <div className="flex items-center justify-center">
        <AnimatePresence mode="wait">
          {showPreview ? (
            <motion.div
              key="preview"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.5 }}
              className="glass neon-glow w-full rounded-2xl p-6"
            >
              {/* Logo area */}
              <div
                className="flex h-24 items-center justify-center rounded-xl"
                style={{ background: `${pal[0]}20` }}
              >
                <span
                  className="text-3xl font-bold"
                  style={{ color: pal[0], fontFamily: `${heading}, serif` }}
                >
                  {name}
                </span>
              </div>

              {/* Palette */}
              <div className="mt-4 flex gap-2">
                {pal.map((c) => (
                  <div key={c} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className="h-10 w-full rounded-lg"
                      style={{ backgroundColor: c }}
                    />
                    <span className="font-[var(--font-mono)] text-[10px] text-[var(--text-muted)]">
                      {c}
                    </span>
                  </div>
                ))}
              </div>

              {/* Typography */}
              <div className="mt-4 space-y-1">
                <p className="text-sm text-[var(--text-muted)]">
                  Heading:{" "}
                  <span className="font-semibold text-[var(--text-primary)]">
                    {heading}
                  </span>
                </p>
                <p className="text-sm text-[var(--text-muted)]">
                  Body:{" "}
                  <span className="font-semibold text-[var(--text-primary)]">
                    {body}
                  </span>
                </p>
              </div>

              {/* CTA */}
              <div className="mt-5 text-center">
                <a
                  href="/questionnaire"
                  className="inline-block rounded-lg bg-[var(--primary)] px-5 py-2 text-sm font-semibold text-white transition-all hover:brightness-110"
                >
                  Get full brand kit &rarr;
                </a>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="glass flex h-80 w-full items-center justify-center rounded-2xl"
            >
              <p className="text-center text-[var(--text-muted)]">
                Enter your business name & pick an
                <br />
                industry to see a preview
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
