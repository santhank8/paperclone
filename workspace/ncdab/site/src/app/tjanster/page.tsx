import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Tjänster",
  description:
    "NCD AB erbjuder BIM/Revit-modellering, byggritningar, projektledning och drönardokumentation för bygg- och fastighetsprojekt i Sverige.",
  alternates: {
    canonical: "/tjanster",
  },
};

const services = [
  {
    id: "bim",
    title: "BIM/Revit-modellering",
    description:
      "Detaljerade 3D-modeller som ger full kontroll över projektet. Vi arbetar i Autodesk Revit och levererar BIM-modeller enligt svenska standarder.",
    href: "/tjanster/bim-modellering",
    icon: (
      <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21m-3.75 3H21" />
      </svg>
    ),
  },
  {
    id: "ritningar",
    title: "Byggritningar",
    description:
      "Teknisk dokumentation från konceptskisser till produktionsritningar. Vi säkerställer att alla ritningar uppfyller gällande krav och standarder.",
    href: "/tjanster/byggritningar",
    icon: (
      <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      </svg>
    ),
  },
  {
    id: "projektledning",
    title: "Projektledning",
    description:
      "Professionell samordning av byggprojekt. Vi håller tidsplaner, budget och kvalitet under kontroll genom hela processen.",
    href: "/tjanster/projektledning",
    icon: (
      <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15a2.25 2.25 0 0 1 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
      </svg>
    ),
  },
  {
    id: "dronar",
    title: "Drönardokumentation",
    description:
      "Flygfotografering, inspektioner och dokumentation med drönare. Effektiv övervakning av byggarbetsplatser och framsteg.",
    href: "/tjanster/dronarfotografering",
    icon: (
      <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
      </svg>
    ),
  },
];

export default function TjansterPage() {
  return (
    <>
      {/* Header */}
      <section className="bg-primary-500 text-white">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8 lg:py-20">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Våra tjänster
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-primary-100">
            Helhetslösningar för bygg- och fastighetsprojekt. Vi stöder er genom
            hela processen med teknisk expertis och engagemang.
          </p>
        </div>
      </section>

      {/* Service list */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="space-y-16">
            {services.map((service, idx) => (
              <div
                key={service.id}
                id={service.id}
                className={`flex flex-col gap-8 lg:flex-row lg:items-center ${
                  idx % 2 === 1 ? "lg:flex-row-reverse" : ""
                }`}
              >
                {/* Image placeholder */}
                <div className="lg:w-1/2">
                  <div className="aspect-[16/10] rounded-2xl bg-gradient-to-br from-primary-50 to-steel-100 flex items-center justify-center">
                    <div className="text-primary-300">{service.icon}</div>
                  </div>
                </div>

                {/* Content */}
                <div className="lg:w-1/2">
                  <h2 className="text-2xl font-bold text-steel-800 sm:text-3xl">
                    {service.title}
                  </h2>
                  <p className="mt-4 text-steel-500 leading-7">
                    {service.description}
                  </p>
                  <Link
                    href={service.href}
                    className="mt-6 inline-flex items-center text-sm font-semibold text-primary-500 hover:text-primary-600 transition-colors"
                  >
                    Läs mer om {service.title.toLowerCase()}
                    <svg
                      className="ml-2 h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
                      />
                    </svg>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-steel-50 py-16">
        <div className="mx-auto max-w-7xl px-6 text-center lg:px-8">
          <h2 className="text-2xl font-bold text-steel-800 sm:text-3xl">
            Behöver ni hjälp med ert projekt?
          </h2>
          <p className="mt-4 text-steel-500">
            Kontakta oss för en kostnadsfri konsultation.
          </p>
          <Link
            href="/kontakt"
            className="mt-8 inline-block rounded-md bg-primary-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-600 transition-colors"
          >
            Begär offert
          </Link>
        </div>
      </section>
    </>
  );
}
