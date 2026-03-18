import { WaitlistForm } from "@/components/WaitlistForm";

const steps = [
  {
    number: "1",
    title: "Answer a few questions",
    description: "Tell us about your business, audience, and vibe in under 2 minutes.",
  },
  {
    number: "2",
    title: "AI generates your brand",
    description: "Get a logo, color palette, typography, and brand guidelines — instantly.",
  },
  {
    number: "3",
    title: "Download your kit",
    description: "Export everything you need: logo files, style guide, and social templates.",
  },
];

const features = [
  {
    title: "Logo & identity",
    description: "A unique logo with variations for every context — dark, light, icon, full.",
  },
  {
    title: "Color palette",
    description: "A harmonious palette with primary, secondary, and accent colors ready for web and print.",
  },
  {
    title: "Typography",
    description: "Curated font pairings that match your brand personality.",
  },
  {
    title: "Brand guidelines",
    description: "A shareable style guide so your brand stays consistent everywhere.",
  },
  {
    title: "Social templates",
    description: "Ready-to-use templates for Instagram, Twitter, LinkedIn, and more.",
  },
  {
    title: "Export everything",
    description: "Download SVG, PNG, PDF — all the formats you need, no designer required.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-gray-900">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center px-6 pt-24 pb-20 text-center sm:pt-32 sm:pb-28">
        <p className="mb-4 inline-block rounded-full bg-violet-100 px-4 py-1.5 text-sm font-medium text-violet-700">
          Coming soon
        </p>
        <h1 className="max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl md:text-6xl">
          Build your brand in minutes,{" "}
          <span className="text-violet-600">not months</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-gray-600 sm:text-xl">
          Answer a short questionnaire and let AI create your complete brand
          identity — logo, colors, fonts, and guidelines — ready to use.
        </p>
        <div className="mt-10 flex w-full justify-center">
          <WaitlistForm />
        </div>
        <p className="mt-4 text-sm text-gray-400">
          Free during early access. No credit card required.
        </p>
      </section>

      {/* How it works */}
      <section className="bg-gray-50 px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">How it works</h2>
          <p className="mt-4 text-lg text-gray-600">
            Three simple steps from idea to brand kit.
          </p>
        </div>
        <div className="mx-auto mt-14 grid max-w-4xl gap-10 sm:grid-cols-3">
          {steps.map((step) => (
            <div key={step.number} className="flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-violet-600 text-xl font-bold text-white">
                {step.number}
              </div>
              <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-gray-600">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">
            Everything you need to launch
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            A complete brand kit, generated in seconds.
          </p>
        </div>
        <div className="mx-auto mt-14 grid max-w-5xl gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-gray-200 p-6 transition-shadow hover:shadow-md"
            >
              <h3 className="text-lg font-semibold">{feature.title}</h3>
              <p className="mt-2 text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bg-violet-600 px-6 py-20 text-center text-white sm:py-28">
        <h2 className="text-3xl font-bold sm:text-4xl">
          Ready to build your brand?
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-lg text-violet-100">
          Join the waitlist and be the first to create your brand identity with
          AI — no design skills needed.
        </p>
        <div className="mt-10 flex justify-center">
          <WaitlistForm />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 px-6 py-8 text-center text-sm text-gray-500">
        &copy; {new Date().getFullYear()} diybrand.app. All rights reserved.
      </footer>
    </main>
  );
}
