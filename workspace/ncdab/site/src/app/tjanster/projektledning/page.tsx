import type { Metadata } from "next";
import ServicePageLayout from "@/components/ServicePageLayout";
import { ServiceJsonLd } from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "Projektledning — Projektledning bygg",
  description:
    "Professionell projektledning för byggprojekt i Sverige. NCD AB samordnar tidsplaner, budget och kvalitet genom hela processen.",
  alternates: {
    canonical: "/tjanster/projektledning",
  },
};

export default function ProjektledningPage() {
  return (
    <>
    <ServiceJsonLd
      name="Projektledning"
      description="Professionell projektledning för byggprojekt i Sverige. NCD AB samordnar tidsplaner, budget och kvalitet genom hela processen."
      url="https://ncdab.se/tjanster/projektledning"
    />
    <ServicePageLayout
      title="Projektledning"
      subtitle="Professionell samordning som håller ert projekt på rätt spår — i tid, inom budget och med rätt kvalitet."
      description="Vi erbjuder projektledning för bygg- och fastighetsprojekt i alla storlekar. Vår roll är att vara navet som samordnar alla parter, hanterar risker och säkerställer att projektet levereras enligt plan. Med tydlig kommunikation och strukturerade processer skapar vi förutsättningar för ett lyckat projekt."
      benefits={[
        "Tydlig projektstruktur med milstolpar och ansvarsfördelning",
        "Proaktiv riskhantering för att undvika förseningar och fördyringar",
        "Löpande budgetuppföljning och ekonomisk kontroll",
        "Samordning av alla projektdeltagare och underentreprenörer",
        "Regelbunden rapportering och transparens genom hela projektet",
        "Erfarenhet av svenska byggregelverk och branschpraxis",
      ]}
      process={[
        {
          title: "Uppstart",
          description:
            "Vi etablerar projektorganisation, mål, tidsplan och kommunikationsrutiner.",
        },
        {
          title: "Planering",
          description:
            "Detaljerad planering med riskanalys, resursallokering och budgetering.",
        },
        {
          title: "Genomförande",
          description:
            "Löpande samordning, byggmöten, kvalitetskontroller och avvikelsehantering.",
        },
        {
          title: "Avslut",
          description:
            "Slutbesiktning, dokumentationsöverlämnande och erfarenhetsåterföring.",
        },
      ]}
    />
    </>
  );
}
