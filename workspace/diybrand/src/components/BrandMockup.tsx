"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const mockSteps = [
  { label: "Analyzing business...", color: "#8b5cf6" },
  { label: "Generating palette...", color: "#f72585" },
  { label: "Designing logo...", color: "#00f5ff" },
  { label: "Building kit...", color: "#a8ff3e" },
  { label: "Brand ready!", color: "#8b5cf6" },
];

const palette = ["#6366F1", "#22D3EE", "#F8FAFC", "#0F172A", "#E2E8F0"];

export function BrandMockup() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((s) => (s + 1) % mockSteps.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 1.2, duration: 0.8 }}
      className="glass neon-glow relative w-full max-w-md rounded-2xl p-6"
    >
      {/* Terminal header */}
      <div className="mb-4 flex items-center gap-2">
        <div className="h-3 w-3 rounded-full bg-red-500/60" />
        <div className="h-3 w-3 rounded-full bg-yellow-500/60" />
        <div className="h-3 w-3 rounded-full bg-green-500/60" />
        <span className="ml-2 font-[var(--font-mono)] text-xs text-[var(--text-muted)]">
          diybrand.app
        </span>
      </div>

      {/* Step indicator */}
      <div className="mb-4 space-y-2">
        {mockSteps.map((s, i) => (
          <motion.div
            key={s.label}
            className="flex items-center gap-3 font-[var(--font-mono)] text-sm"
            initial={{ opacity: 0.3 }}
            animate={{ opacity: i <= step ? 1 : 0.3 }}
            transition={{ duration: 0.4 }}
          >
            <motion.div
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: i <= step ? s.color : "#333" }}
              animate={
                i === step
                  ? { scale: [1, 1.4, 1], opacity: [1, 0.7, 1] }
                  : {}
              }
              transition={{ repeat: Infinity, duration: 1.2 }}
            />
            <span style={{ color: i <= step ? s.color : "#555" }}>
              {i < step ? "Done" : i === step ? s.label : "Waiting..."}
            </span>
          </motion.div>
        ))}
      </div>

      {/* Palette preview */}
      <motion.div
        className="mt-4 flex gap-2 overflow-hidden rounded-lg"
        animate={{ opacity: step >= 1 ? 1 : 0 }}
        transition={{ duration: 0.5 }}
      >
        {palette.map((c, i) => (
          <motion.div
            key={c}
            className="h-8 flex-1 rounded"
            style={{ backgroundColor: c }}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: step >= 1 ? 1 : 0 }}
            transition={{ delay: i * 0.1, duration: 0.4 }}
          />
        ))}
      </motion.div>

      {/* Logo preview */}
      <motion.div
        className="mt-4 flex h-16 items-center justify-center rounded-lg"
        style={{ background: "rgba(99,102,241,0.1)" }}
        animate={{ opacity: step >= 2 ? 1 : 0 }}
        transition={{ duration: 0.5 }}
      >
        <span className="font-[var(--font-space)] text-2xl font-bold text-[#6366F1]">
          Vektora
        </span>
      </motion.div>
    </motion.div>
  );
}
