import type { Metadata } from "next";
import { ProjectGallery } from "./ProjectGallery";
import { projects } from "@/lib/projects";

export const metadata: Metadata = {
  title: "Projekt — Referensprojekt",
  description:
    "Se våra genomförda projekt inom BIM-modellering, byggritningar, projektledning och drönardokumentation. NCD AB levererar kvalitet i varje uppdrag.",
  alternates: {
    canonical: "/projekt",
  },
};

export default function ProjektPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-primary-500 text-white">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8 lg:py-24">
          <div className="max-w-2xl">
            <p className="text-sm font-medium tracking-widest uppercase text-primary-200">
              Referensprojekt
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
              Våra projekt
            </h1>
            <p className="mt-4 text-lg text-primary-100">
              Ett urval av genomförda uppdrag som visar bredden i vår kompetens
              — från BIM-modellering och byggritningar till projektledning och
              drönarinspektioner.
            </p>
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section className="py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <ProjectGallery projects={projects} />
        </div>
      </section>
    </>
  );
}
