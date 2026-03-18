import type { Metadata } from "next";
import QuoteRequestForm from "./QuoteRequestForm";

export const metadata: Metadata = {
  title: "Begär offert",
  description:
    "Begär en kostnadsfri offert för BIM-modellering, byggritningar, projektledning eller drönardokumentation från NCD AB.",
  alternates: {
    canonical: "/offertforfragan",
  },
};

export default function OffertPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-primary-500 text-white">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8 lg:py-20">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Begär offert
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-primary-100">
            Fyll i formuläret nedan så återkommer vi med en skräddarsydd offert
            för ert projekt — helt kostnadsfritt.
          </p>
        </div>
      </section>

      {/* Form */}
      <section className="py-16 lg:py-20">
        <div className="mx-auto max-w-2xl px-6 lg:px-8">
          <QuoteRequestForm />
        </div>
      </section>
    </>
  );
}
