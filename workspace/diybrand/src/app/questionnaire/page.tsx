import type { Metadata } from "next";
import { BrandWizard } from "@/components/BrandWizard";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export const metadata: Metadata = {
  title: "Brand Questionnaire — diybrand.app",
  description: "Tell us about your business and we'll create your brand identity.",
  alternates: {
    canonical: "/questionnaire",
  },
};

export default function QuestionnairePage() {
  return (
    <main id="main-content" className="relative min-h-screen overflow-hidden" style={{ background: "var(--bg-void)" }}>
      {/* Aurora background */}
      <div className="aurora-bg pointer-events-none fixed inset-0 opacity-60" />

      <div className="relative z-10 mx-auto max-w-2xl px-6 py-12 sm:py-20">
        <div className="text-center">
          <h1 className="font-[var(--font-space)] text-3xl font-extrabold tracking-tight sm:text-4xl" style={{ color: "var(--text-primary)" }}>
            Let&apos;s build your <span className="gradient-text">brand</span>
          </h1>
          <p className="mt-3" style={{ color: "var(--text-muted)" }}>
            Answer a few questions and we&apos;ll generate your complete brand identity.
          </p>
        </div>
        <div className="mt-10">
          <ErrorBoundary>
            <BrandWizard />
          </ErrorBoundary>
        </div>
      </div>
    </main>
  );
}
