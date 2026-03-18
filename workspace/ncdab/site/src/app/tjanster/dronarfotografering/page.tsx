import type { Metadata } from "next";
import ServicePageLayout from "@/components/ServicePageLayout";

export const metadata: Metadata = {
  title: "Drönardokumentation",
  description:
    "Drönardokumentation och flygfotografering för byggprojekt. NCD AB erbjuder flygbilder, inspektioner och framstegsdokumentation.",
};

export default function DronarfotograferingPage() {
  return (
    <ServicePageLayout
      title="Drönardokumentation"
      subtitle="Flygfotografering och inspektioner som ger överblick och detaljkontroll av era byggprojekt."
      description="Med professionell drönarteknik dokumenterar vi byggarbetsplatser, fasader och tak snabbt och säkert. Drönarfotografering ger en unik överblick som kompletterar traditionell dokumentation. Vi levererar högupplösta bilder, video och ortofoto som kan användas för framstegsdokumentation, inspektion av svårtillgängliga ytor och marknadsföring."
      benefits={[
        "Snabb och säker dokumentation av stora områden",
        "Högupplösta bilder och video i 4K",
        "Inspektion av tak, fasader och svårtillgängliga ytor utan ställning",
        "Regelbunden framstegsdokumentation under hela projektet",
        "Ortofoto och kartunderlag för planering och analys",
        "Material för marknadsföring och kundpresentationer",
      ]}
      process={[
        {
          title: "Planering",
          description:
            "Vi planerar flygningen utifrån ert behov, platsens förutsättningar och luftrumsregler.",
        },
        {
          title: "Flygning",
          description:
            "Certifierade piloter genomför flygningen med professionell utrustning.",
        },
        {
          title: "Bearbetning",
          description:
            "Bilder och video bearbetas, sorteras och kvalitetssäkras.",
        },
        {
          title: "Leverans",
          description:
            "Färdigt material levereras digitalt i överenskomna format och upplösning.",
        },
      ]}
    />
  );
}
