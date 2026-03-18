import type { Metadata } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space",
  weight: ["700"],
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "diybrand.app — Your brand. Built by AI. In minutes.",
  description:
    "Answer a short questionnaire and let AI create your complete brand identity — logo, colors, fonts, and guidelines — ready to use. No design skills needed.",
  openGraph: {
    title: "diybrand.app — Your brand. Built by AI. In minutes.",
    description:
      "Answer a short questionnaire and let AI create your complete brand identity — logo, colors, fonts, and guidelines — ready to use.",
    url: "https://diybrand.app",
    siteName: "diybrand.app",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "diybrand.app — Your brand. Built by AI. In minutes.",
    description:
      "Answer a short questionnaire and let AI create your complete brand identity — logo, colors, fonts, and guidelines — ready to use.",
  },
  metadataBase: new URL("https://diybrand.app"),
  alternates: {
    canonical: "/",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      name: "diybrand.app",
      url: "https://diybrand.app",
      description:
        "Answer a short questionnaire and let AI create your complete brand identity — logo, colors, fonts, and guidelines — ready to use.",
    },
    {
      "@type": "Organization",
      name: "diybrand.app",
      url: "https://diybrand.app",
      description:
        "AI-powered brand identity generator. Build your brand in minutes, not months.",
    },
    {
      "@type": "SoftwareApplication",
      name: "diybrand.app",
      applicationCategory: "DesignApplication",
      operatingSystem: "Web",
      description:
        "AI-powered brand kit generator — logo, colors, fonts, and guidelines.",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        description: "Free during early access",
      },
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={inter.className}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[var(--primary)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
