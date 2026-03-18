import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { OrganizationJsonLd } from "@/components/JsonLd";

export const metadata: Metadata = {
  metadataBase: new URL("https://ncdab.se"),
  title: {
    default: "NCD AB — Byggkonsulter | BIM, Ritningar & Projektledning",
    template: "%s | NCD AB",
  },
  description:
    "NCD AB är ett svenskt byggkonsultföretag som erbjuder BIM/Revit-modellering, byggritningar, projektledning och drönardokumentation.",
  keywords: [
    "byggkonsult",
    "BIM",
    "Revit",
    "byggritningar",
    "projektledning",
    "drönardokumentation",
    "BIM-modellering Sverige",
    "byggritningar konsult",
    "projektledning bygg",
    "drönarfotografering bygg",
    "Sverige",
  ],
  openGraph: {
    type: "website",
    locale: "sv_SE",
    url: "https://ncdab.se",
    siteName: "NCD AB",
    title: "NCD AB — Byggkonsulter",
    description:
      "Svenskt byggkonsultföretag med expertis inom BIM, ritningar, projektledning och drönardokumentation.",
  },
  twitter: {
    card: "summary_large_image",
    title: "NCD AB — Byggkonsulter",
    description:
      "Svenskt byggkonsultföretag med expertis inom BIM, ritningar, projektledning och drönardokumentation.",
  },
  alternates: {
    canonical: "/",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sv">
      <body className="font-sans antialiased bg-white text-steel-800">
        <OrganizationJsonLd />
        <div className="flex min-h-screen flex-col">
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
