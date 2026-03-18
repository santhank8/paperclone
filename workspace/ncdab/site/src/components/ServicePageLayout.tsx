import Link from "next/link";

interface ProcessStep {
  title: string;
  description: string;
}

interface ServicePageLayoutProps {
  title: string;
  subtitle: string;
  description: string;
  benefits: string[];
  process: ProcessStep[];
}

export default function ServicePageLayout({
  title,
  subtitle,
  description,
  benefits,
  process,
}: ServicePageLayoutProps) {
  return (
    <>
      {/* Hero */}
      <section className="bg-primary-500 text-white">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8 lg:py-20">
          <nav className="mb-6 text-sm text-primary-200">
            <Link href="/tjanster" className="hover:text-white transition-colors">
              Tjänster
            </Link>
            <span className="mx-2">/</span>
            <span className="text-white">{title}</span>
          </nav>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            {title}
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-primary-100">{subtitle}</p>
        </div>
      </section>

      {/* Description */}
      <section className="py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <p className="text-lg text-steel-600 leading-8">{description}</p>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="bg-steel-50 py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-steel-800 sm:text-3xl">
            Fördelar
          </h2>
          <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {benefits.map((benefit) => (
              <li key={benefit} className="flex items-start gap-3">
                <svg
                  className="mt-1 h-5 w-5 shrink-0 text-primary-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m4.5 12.75 6 6 9-13.5"
                  />
                </svg>
                <span className="text-steel-600">{benefit}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Process */}
      <section className="py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-steel-800 sm:text-3xl">
            Så arbetar vi
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {process.map((step, idx) => (
              <div key={step.title} className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-500 text-white font-bold text-sm">
                  {idx + 1}
                </div>
                <h3 className="mt-4 text-base font-semibold text-steel-800">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm text-steel-500 leading-6">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary-500 py-16">
        <div className="mx-auto max-w-7xl px-6 text-center lg:px-8">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Intresserad av {title.toLowerCase()}?
          </h2>
          <p className="mt-4 text-primary-100">
            Kontakta oss för att diskutera ert projekt.
          </p>
          <Link
            href="/kontakt"
            className="mt-8 inline-block rounded-md bg-accent-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-accent-600 transition-colors"
          >
            Begär offert
          </Link>
        </div>
      </section>
    </>
  );
}
