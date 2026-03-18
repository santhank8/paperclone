import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { projects, serviceColors } from "@/lib/projects";

export function generateStaticParams() {
  return projects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = projects.find((p) => p.slug === slug);
  if (!project) return {};
  return {
    title: project.title,
    description: project.shortDescription,
    alternates: {
      canonical: `/projekt/${slug}`,
    },
    openGraph: {
      title: project.title,
      description: project.shortDescription,
      type: "article",
    },
  };
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = projects.find((p) => p.slug === slug);
  if (!project) notFound();

  return (
    <>
      {/* Header */}
      <section className="bg-primary-500 text-white">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8 lg:py-24">
          <Link
            href="/projekt"
            className="inline-flex items-center text-sm text-primary-200 hover:text-white transition-colors mb-6"
          >
            <svg
              className="mr-1.5 h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
              />
            </svg>
            Alla projekt
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <span
              className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${serviceColors[project.serviceType]}`}
            >
              {project.serviceLabel}
            </span>
            <span className="text-sm text-primary-200">{project.year}</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            {project.title}
          </h1>
          <p className="mt-4 text-lg text-primary-100 max-w-3xl">
            {project.shortDescription}
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-3">
            {/* Main content */}
            <div className="lg:col-span-2">
              {/* Placeholder project image */}
              <div className="aspect-[16/9] rounded-xl bg-gradient-to-br from-primary-100 to-steel-100 flex items-center justify-center mb-10">
                <div className="text-center p-8">
                  <svg
                    className="mx-auto h-16 w-16 text-primary-300"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z"
                    />
                  </svg>
                  <p className="mt-4 text-sm text-primary-400">Projektfoto</p>
                </div>
              </div>

              <h2 className="text-2xl font-bold text-steel-800 mb-4">
                Om projektet
              </h2>
              <p className="text-steel-600 leading-7">{project.description}</p>

              {/* Highlights */}
              <h3 className="text-xl font-semibold text-steel-800 mt-10 mb-4">
                Höjdpunkter
              </h3>
              <ul className="space-y-3">
                {project.highlights.map((highlight) => (
                  <li key={highlight} className="flex items-start gap-3">
                    <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-500">
                      <svg
                        className="h-3 w-3 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={3}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m4.5 12.75 6 6 9-13.5"
                        />
                      </svg>
                    </span>
                    <span className="text-steel-600">{highlight}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Sidebar */}
            <aside>
              <div className="rounded-xl border border-steel-200 p-6 sticky top-24">
                <h3 className="text-sm font-semibold text-steel-800 uppercase tracking-wider mb-4">
                  Projektfakta
                </h3>
                <dl className="space-y-4">
                  <div>
                    <dt className="text-xs text-steel-400 uppercase tracking-wider">
                      Kund
                    </dt>
                    <dd className="mt-1 text-sm font-medium text-steel-700">
                      {project.client}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-steel-400 uppercase tracking-wider">
                      Plats
                    </dt>
                    <dd className="mt-1 text-sm font-medium text-steel-700">
                      {project.location}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-steel-400 uppercase tracking-wider">
                      Tjänst
                    </dt>
                    <dd className="mt-1 text-sm font-medium text-steel-700">
                      {project.scope}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-steel-400 uppercase tracking-wider">
                      Längd
                    </dt>
                    <dd className="mt-1 text-sm font-medium text-steel-700">
                      {project.duration}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-steel-400 uppercase tracking-wider">
                      År
                    </dt>
                    <dd className="mt-1 text-sm font-medium text-steel-700">
                      {project.year}
                    </dd>
                  </div>
                </dl>

                <div className="mt-8 pt-6 border-t border-steel-200">
                  <Link
                    href="/kontakt"
                    className="block w-full rounded-md bg-primary-500 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm hover:bg-primary-600 transition-colors"
                  >
                    Diskutera ert projekt
                  </Link>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* Other projects */}
      <section className="bg-steel-50 py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-steel-800 mb-8">
            Fler projekt
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {projects
              .filter((p) => p.slug !== project.slug)
              .slice(0, 3)
              .map((p) => (
                <Link
                  key={p.slug}
                  href={`/projekt/${p.slug}`}
                  className="group rounded-xl border border-steel-200 bg-white overflow-hidden hover:shadow-lg hover:border-primary-200 transition-all"
                >
                  <div className="aspect-[16/9] bg-gradient-to-br from-primary-100 to-steel-100 flex items-center justify-center">
                    <svg
                      className="h-10 w-10 text-primary-300 group-hover:text-primary-400 transition-colors"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z"
                      />
                    </svg>
                  </div>
                  <div className="p-5">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${serviceColors[p.serviceType]}`}
                    >
                      {p.serviceLabel}
                    </span>
                    <h3 className="mt-2 text-base font-semibold text-steel-800 group-hover:text-primary-500 transition-colors">
                      {p.title}
                    </h3>
                  </div>
                </Link>
              ))}
          </div>
        </div>
      </section>
    </>
  );
}
