"use client";

import { motion } from "framer-motion";

const words = ["Your", "brand.", "Built", "by", "AI.", "In", "minutes."];

export function HeroHeadline() {
  return (
    <h1 className="max-w-4xl font-[var(--font-space)] text-5xl font-bold leading-tight tracking-tight sm:text-6xl md:text-7xl">
      {words.map((word, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 + i * 0.12, duration: 0.5, ease: "easeOut" }}
          className="mr-[0.3em] inline-block"
        >
          {word === "AI." ? (
            <span className="gradient-text">{word}</span>
          ) : (
            word
          )}
        </motion.span>
      ))}
    </h1>
  );
}
