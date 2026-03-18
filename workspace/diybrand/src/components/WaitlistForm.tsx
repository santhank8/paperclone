"use client";

import { useState, type FormEvent } from "react";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Something went wrong");
      }

      setStatus("success");
      setEmail("");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-xl border border-[var(--accent-lime)]/30 bg-[var(--accent-lime)]/10 px-6 py-4 text-center text-sm text-[var(--accent-lime)]">
        You&apos;re on the list! We&apos;ll be in touch soon.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-md flex-col gap-3 sm:flex-row">
      <input
        type="email"
        required
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="flex-1 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-card)] px-4 py-3 text-base text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-all focus:border-[var(--primary)] focus:shadow-[0_0_20px_#8b5cf630]"
      />
      <button
        type="submit"
        disabled={status === "loading"}
        className="rounded-xl bg-[var(--bg-card)] border border-[var(--glass-border)] px-6 py-3 text-base font-semibold text-[var(--text-primary)] transition-all hover:border-[var(--primary)] hover:shadow-[0_0_20px_#8b5cf630] disabled:opacity-60"
      >
        {status === "loading" ? "Joining..." : "Join waitlist"}
      </button>
      {status === "error" && (
        <p className="text-sm text-[var(--accent-pink)]">{errorMsg}</p>
      )}
    </form>
  );
}
