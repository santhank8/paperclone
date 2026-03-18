import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Om oss",
  description:
    "Lär känna NCD AB — ett svenskt byggkonsultföretag med expertis inom BIM, ritningar, projektledning och drönardokumentation.",
  alternates: {
    canonical: "/om-oss",
  },
};

const team = [
  {
    name: "Namn Namnsson",
    role: "VD & grundare",
    bio: "Över 15 års erfarenhet inom bygg- och fastighetsbranschen.",
  },
  {
    name: "Namn Namnsson",
    role: "BIM-ansvarig",
    bio: "Certifierad Revit-specialist med fokus på samordning och kvalitet.",
  },
  {
    name: "Namn Namnsson",
    role: "Projektledare",
    bio: "Erfarenhet av komplexa byggprojekt i hela Sverige.",
  },
];

const certifications = [
  "Autodesk Revit-certifiering",
  "BIM-samordning enligt svensk standard",
  "Drönaroperatör med A1/A3-certifikat",
  "Projektledning enligt PMI/PRINCE2",
];

export default function OmOssPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-primary-500 text-white">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8 lg:py-20">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Om NCD AB
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-primary-100">
            Byggkonsulter med passion för teknik och kvalitet.
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16 items-center">
            <div>
              <h2 className="text-2xl font-bold text-steel-800 sm:text-3xl">
                Vår historia
              </h2>
              <div className="mt-6 space-y-4 text-steel-600 leading-7">
                <p>
                  NCD AB grundades med en tydlig vision: att göra avancerad
                  byggteknik tillgänglig för alla aktörer i byggbranschen. Vi såg
                  tidigt potentialen i BIM och digital dokumentation, och har
                  sedan dess byggt ett team med bred kompetens inom modellering,
                  ritningsproduktion, projektledning och drönarinspektion.
                </p>
                <p>
                  Idag är vi en pålitlig partner för arkitekter, konstruktörer,
                  entreprenörer och fastighetsägare runt om i Sverige. Vår styrka
                  ligger i att kombinera teknisk spetskompetens med ett personligt
                  och lyhört arbetssätt.
                </p>
              </div>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-primary-50 to-steel-100 aspect-[4/3] flex items-center justify-center">
              <div className="text-center p-8">
                <svg className="mx-auto h-16 w-16 text-primary-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
                </svg>
                <p className="mt-4 text-sm text-primary-400">Teambild</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="bg-steel-50 py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-bold text-steel-800 sm:text-3xl">
              Vårt uppdrag
            </h2>
            <p className="mt-6 text-lg text-steel-600 leading-8">
              Vi finns till för att ge byggbranschens aktörer de verktyg och det
              stöd de behöver för att bygga smartare, snabbare och med högre
              kvalitet. Genom att kombinera modern teknik med gedigen
              branscherfarenhet skapar vi värde i varje projekt vi deltar i.
            </p>
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-steel-800 sm:text-3xl">
            Vårt team
          </h2>
          <p className="mt-4 text-steel-500">
            Erfarna konsulter med bred kompetens inom bygg och teknik.
          </p>
          <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {team.map((member, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-steel-200 p-6"
              >
                <div className="h-16 w-16 rounded-full bg-primary-100 flex items-center justify-center">
                  <svg className="h-8 w-8 text-primary-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </svg>
                </div>
                <h3 className="mt-4 text-base font-semibold text-steel-800">
                  {member.name}
                </h3>
                <p className="text-sm text-primary-500">{member.role}</p>
                <p className="mt-2 text-sm text-steel-500">{member.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Certifications */}
      <section className="bg-steel-50 py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-steel-800 sm:text-3xl">
            Certifieringar & kompetens
          </h2>
          <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {certifications.map((cert) => (
              <li key={cert} className="flex items-start gap-3">
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
                <span className="text-steel-600">{cert}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
