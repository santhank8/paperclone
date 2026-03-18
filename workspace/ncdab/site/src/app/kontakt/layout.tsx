import type { Metadata } from "next";
import { LocalBusinessJsonLd } from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "Kontakt",
  description:
    "Kontakta NCD AB för en kostnadsfri konsultation. Vi erbjuder BIM-modellering, byggritningar, projektledning och drönardokumentation.",
  alternates: {
    canonical: "/kontakt",
  },
};

export default function KontaktLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <LocalBusinessJsonLd />
      {children}
    </>
  );
}
