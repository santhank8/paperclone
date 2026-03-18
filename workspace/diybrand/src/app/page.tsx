import Link from "next/link";
import { HeroHeadline } from "@/components/HeroHeadline";
import { BrandMockup } from "@/components/BrandMockup";
import { ParticleField } from "@/components/ParticleField";
import { CursorSpotlight } from "@/components/CursorSpotlight";
import { LiveDemo } from "@/components/LiveDemo";
import { ScrollReveal } from "@/components/ScrollReveal";
import { WaitlistForm } from "@/components/WaitlistForm";

/* ── Data ── */

const steps = [
  {
    number: "01",
    title: "Describe your vision",
    description:
      "Tell us about your business, audience, and vibe in a quick questionnaire.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
      </svg>
    ),
  },
  {
    number: "02",
    title: "AI generates your brand",
    description:
      "Get a logo, color palette, typography, and brand guidelines — instantly.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
      </svg>
    ),
  },
  {
    number: "03",
    title: "Download your kit",
    description:
      "Export everything you need: logo files, style guide, and social templates.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
      </svg>
    ),
  },
];

const features = [
  {
    title: "AI Logo Generator",
    description:
      "A unique logo with variations for every context — dark, light, icon, full lockup.",
    highlight: true,
    color: "var(--primary)",
  },
  {
    title: "Color Palette",
    description:
      "A harmonious palette with primary, secondary, and accent colors for web and print.",
    highlight: false,
    color: "var(--accent-pink)",
  },
  {
    title: "Typography",
    description: "Curated font pairings that match your brand personality perfectly.",
    highlight: false,
    color: "var(--accent-cyan)",
  },
  {
    title: "Brand Guidelines",
    description:
      "A shareable style guide so your brand stays consistent everywhere.",
    highlight: false,
    color: "var(--accent-lime)",
  },
  {
    title: "Social Templates",
    description:
      "Ready-to-use templates for Instagram, Twitter, LinkedIn, and more.",
    highlight: false,
    color: "var(--primary)",
  },
  {
    title: "Export Everything",
    description:
      "Download SVG, PNG, PDF — all the formats you need, no designer required.",
    highlight: false,
    color: "var(--accent-pink)",
  },
];

const testimonials = [
  {
    quote:
      "I spent weeks going back and forth with a designer. diybrand gave me a brand kit I actually loved in 10 minutes.",
    name: "Sarah M.",
    role: "Freelance Photographer",
  },
  {
    quote:
      "The color palette alone was worth it. Everything feels cohesive now — my website, my socials, my business cards.",
    name: "James K.",
    role: "Personal Trainer",
  },
  {
    quote:
      "I was skeptical about AI-generated branding, but the quality blew me away. My clients think I hired an agency.",
    name: "Priya D.",
    role: "Etsy Shop Owner",
  },
  {
    quote:
      "Launched my side project in a weekend. The brand kit made everything look legit from day one.",
    name: "Alex T.",
    role: "Indie Hacker",
  },
  {
    quote:
      "Best $49 I ever spent. The social templates alone saved me hours every week.",
    name: "Maria L.",
    role: "Bakery Owner",
  },
  {
    quote:
      "As a developer, design isn't my strength. diybrand bridged that gap instantly.",
    name: "Chen W.",
    role: "SaaS Founder",
  },
];

const pricingTiers = [
  {
    name: "Basic",
    price: "$19",
    features: [
      "Logo files (PNG)",
      "Color palette (CSS, JSON, HTML)",
      "Typography guide",
    ],
  },
  {
    name: "Premium",
    price: "$49",
    popular: true,
    features: [
      "Everything in Basic",
      "SVG logo + variations",
      "Social media templates",
      "Business card mockup",
      "Brand guidelines PDF",
    ],
  },
];

const tickerBrands = [
  "Bloom & Root",
  "Vektora",
  "Maple & Co",
  "NovaPulse",
  "Zenith Labs",
  "Pixel & Grain",
  "Solaris",
  "Drift Studio",
  "Oakhaven",
  "Lucent",
];

/* ── Page ── */

export default function Home() {
  return (
    <main id="main-content" className="relative min-h-screen overflow-hidden">
      <ParticleField />
      <CursorSpotlight />

      {/* ─── Hero ─── */}
      <section className="aurora-bg relative z-10 flex min-h-screen flex-col items-center justify-center px-6 pt-20 pb-12 lg:flex-row lg:gap-16 lg:px-16">
        <div className="max-w-2xl text-center lg:text-left">
          <p className="mb-6 inline-block rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] px-4 py-1.5 font-[var(--font-mono)] text-sm text-[var(--accent-cyan)]">
            Free during early access
          </p>
          <HeroHeadline />
          <p className="mt-6 max-w-xl text-lg text-[var(--text-muted)] sm:text-xl">
            Answer a short questionnaire and let AI create your complete brand
            identity — logo, colors, fonts, and guidelines — ready to use.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row lg:justify-start">
            <Link
              href="/questionnaire"
              className="cta-glow inline-flex items-center rounded-xl bg-[var(--primary)] px-8 py-4 text-base font-semibold text-white transition-all"
            >
              Build My Brand
              <svg
                className="ml-2 h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                />
              </svg>
            </Link>
            <span className="text-sm text-[var(--text-muted)]">
              No credit card required
            </span>
          </div>
          <div className="mt-6 flex w-full justify-center lg:justify-start">
            <WaitlistForm />
          </div>
        </div>
        <div className="mt-12 lg:mt-0">
          <BrandMockup />
        </div>
      </section>

      {/* ─── Logo Ticker ─── */}
      <section className="relative z-10 border-y border-[var(--glass-border)] bg-[var(--bg-surface)] py-4 overflow-hidden">
        <div className="flex items-center gap-6">
          <div className="ticker-track flex shrink-0 items-center gap-6">
            {[...tickerBrands, ...tickerBrands].map((brand, i) => (
              <span
                key={`${brand}-${i}`}
                className="whitespace-nowrap font-[var(--font-space)] text-sm font-bold text-[var(--text-muted)]/40"
              >
                {brand}
              </span>
            ))}
          </div>
          <div className="ticker-track flex shrink-0 items-center gap-6" aria-hidden>
            {[...tickerBrands, ...tickerBrands].map((brand, i) => (
              <span
                key={`${brand}-dup-${i}`}
                className="whitespace-nowrap font-[var(--font-space)] text-sm font-bold text-[var(--text-muted)]/40"
              >
                {brand}
              </span>
            ))}
          </div>
        </div>
        <div className="absolute right-6 top-1/2 -translate-y-1/2">
          <span className="font-[var(--font-mono)] text-xs text-[var(--accent-cyan)]">
            2,847+ brands created
          </span>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section className="relative z-10 px-6 py-24 sm:py-32">
        <ScrollReveal className="mx-auto max-w-4xl text-center">
          <h2 className="font-[var(--font-space)] text-3xl font-bold sm:text-4xl">
            How it works
          </h2>
          <p className="mt-4 text-lg text-[var(--text-muted)]">
            Three simple steps from idea to brand kit.
          </p>
        </ScrollReveal>
        <div className="mx-auto mt-16 grid max-w-5xl gap-6 sm:grid-cols-3">
          {steps.map((step, i) => (
            <ScrollReveal key={step.number} delay={i * 0.15}>
              <div className="glass neon-glow group relative flex flex-col items-center rounded-2xl p-8 text-center transition-all">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--primary)]/20 text-[var(--primary)] transition-colors group-hover:bg-[var(--primary)]/30">
                  {step.icon}
                </div>
                <span className="mt-4 font-[var(--font-mono)] text-xs text-[var(--accent-cyan)]">
                  Step {step.number}
                </span>
                <h3 className="mt-2 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-[var(--text-muted)]">
                  {step.description}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* ─── Features (Bento Grid) ─── */}
      <section className="relative z-10 bg-[var(--bg-surface)] px-6 py-24 sm:py-32">
        <ScrollReveal className="mx-auto max-w-4xl text-center">
          <h2 className="font-[var(--font-space)] text-3xl font-bold sm:text-4xl">
            Everything you need to launch
          </h2>
          <p className="mt-4 text-lg text-[var(--text-muted)]">
            A complete brand kit, generated in seconds.
          </p>
        </ScrollReveal>
        <div className="mx-auto mt-16 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <ScrollReveal
              key={feature.title}
              delay={i * 0.08}
              className={feature.highlight ? "sm:col-span-2" : ""}
            >
              <div
                className={`glass neon-glow group h-full rounded-2xl p-6 transition-all ${
                  feature.highlight ? "border-[var(--primary)]/30" : ""
                }`}
              >
                <div
                  className="mb-3 h-1 w-10 rounded-full"
                  style={{ backgroundColor: feature.color }}
                />
                <h3 className="text-lg font-semibold">
                  {feature.title}
                  {feature.highlight && (
                    <span className="ml-2 rounded-md bg-[var(--primary)]/20 px-2 py-0.5 font-[var(--font-mono)] text-xs text-[var(--primary)]">
                      Popular
                    </span>
                  )}
                </h3>
                <p className="mt-2 text-sm text-[var(--text-muted)]">
                  {feature.description}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* ─── Live Demo ─── */}
      <section className="relative z-10 px-6 py-24 sm:py-32">
        <ScrollReveal className="mx-auto max-w-4xl text-center">
          <h2 className="font-[var(--font-space)] text-3xl font-bold sm:text-4xl">
            Try it <span className="gradient-text">right now</span>
          </h2>
          <p className="mt-4 text-lg text-[var(--text-muted)]">
            Type your business name, pick an industry, and watch the magic happen.
          </p>
        </ScrollReveal>
        <div className="mt-16">
          <LiveDemo />
        </div>
      </section>

      {/* ─── Pricing ─── */}
      <section className="relative z-10 bg-[var(--bg-surface)] px-6 py-24 sm:py-32">
        <ScrollReveal className="mx-auto max-w-4xl text-center">
          <h2 className="font-[var(--font-space)] text-3xl font-bold sm:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-lg text-[var(--text-muted)]">
            One-time purchase. No subscriptions. No hidden fees.
          </p>
        </ScrollReveal>
        <div className="mx-auto mt-16 grid max-w-2xl gap-6 sm:grid-cols-2">
          {pricingTiers.map((tier, i) => (
            <ScrollReveal key={tier.name} delay={i * 0.15}>
              <div
                className={`glass neon-glow relative rounded-2xl p-8 transition-all ${
                  tier.popular
                    ? "border border-[var(--primary)]/50 shadow-[0_0_40px_#8b5cf620]"
                    : ""
                }`}
              >
                {tier.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--primary)] px-4 py-1 text-xs font-semibold text-white shadow-[0_0_20px_#8b5cf650]">
                    Most Popular
                  </span>
                )}
                <h3 className="text-lg font-bold">{tier.name}</h3>
                <p className="mt-3 text-4xl font-bold">
                  {tier.price}
                  <span className="text-sm font-normal text-[var(--text-muted)]">
                    {" "}
                    one-time
                  </span>
                </p>
                <ul className="mt-6 space-y-3">
                  {tier.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm text-[var(--text-muted)]"
                    >
                      <svg
                        className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-lime)]"
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
                <Link
                  href="/questionnaire"
                  className={`mt-6 block w-full rounded-xl py-3 text-center text-sm font-semibold transition-all ${
                    tier.popular
                      ? "cta-glow bg-[var(--primary)] text-white"
                      : "glass text-[var(--text-primary)] hover:bg-white/10"
                  }`}
                >
                  Get started
                </Link>
              </div>
            </ScrollReveal>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-[var(--text-muted)]">
          You only pay after reviewing your generated brand kit.
        </p>
      </section>

      {/* ─── Testimonials ─── */}
      <section className="relative z-10 overflow-hidden px-6 py-24 sm:py-32">
        <ScrollReveal className="mx-auto max-w-4xl text-center">
          <h2 className="font-[var(--font-space)] text-3xl font-bold sm:text-4xl">
            Loved by small business owners
          </h2>
          <p className="mt-4 text-lg text-[var(--text-muted)]">
            Join thousands of founders who built their brand with diybrand.app.
          </p>
        </ScrollReveal>
        <div className="mt-16 overflow-hidden">
          <div className="testimonial-scroll flex gap-6">
            {[...testimonials, ...testimonials].map((t, i) => (
              <div
                key={`${t.name}-${i}`}
                className="glass neon-glow w-80 shrink-0 rounded-2xl p-6"
              >
                {/* Star rating */}
                <div className="star-neon flex gap-0.5" aria-label="5 out of 5 stars">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <svg
                      key={j}
                      className="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <blockquote className="mt-4 text-sm text-[var(--text-muted)]">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <div className="mt-4 border-t border-[var(--glass-border)] pt-4">
                  <p className="font-semibold text-[var(--text-primary)]">
                    {t.name}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="aurora-bg relative z-10 px-6 py-24 text-center sm:py-32">
        <ScrollReveal>
          <h2 className="font-[var(--font-space)] text-3xl font-bold sm:text-5xl">
            Ready to build your brand?
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-lg text-[var(--text-muted)]">
            Start the questionnaire and get your complete brand kit in minutes —
            no design skills needed.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/questionnaire"
              className="cta-glow inline-flex items-center rounded-xl bg-[var(--primary)] px-8 py-4 text-base font-semibold text-white transition-all"
            >
              Build My Brand
              <svg
                className="ml-2 h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                />
              </svg>
            </Link>
            <span className="text-sm text-[var(--text-muted)]">or</span>
            <WaitlistForm />
          </div>
        </ScrollReveal>
      </section>

      {/* ─── Footer ─── */}
      <footer className="relative z-10 border-t border-[var(--glass-border)] px-6 py-8 text-center text-sm text-[var(--text-muted)]">
        &copy; {new Date().getFullYear()} diybrand.app. All rights reserved.
      </footer>
    </main>
  );
}
