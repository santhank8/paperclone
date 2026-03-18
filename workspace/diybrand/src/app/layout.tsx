import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "diybrand.app — Build your brand in minutes, not months",
  description:
    "Answer a short questionnaire and let AI create your complete brand identity — logo, colors, fonts, and guidelines — ready to use. No design skills needed.",
  openGraph: {
    title: "diybrand.app — Build your brand in minutes, not months",
    description:
      "Answer a short questionnaire and let AI create your complete brand identity — logo, colors, fonts, and guidelines — ready to use.",
    url: "https://diybrand.app",
    siteName: "diybrand.app",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "diybrand.app — Build your brand in minutes, not months",
    description:
      "Answer a short questionnaire and let AI create your complete brand identity — logo, colors, fonts, and guidelines — ready to use.",
  },
  metadataBase: new URL("https://diybrand.app"),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
