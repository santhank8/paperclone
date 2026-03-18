import type { Metadata } from "next";
import ServicePageLayout from "@/components/ServicePageLayout";
import { ServiceJsonLd } from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "Byggritningar — Byggritningar konsult",
  description:
    "Professionella byggritningar och teknisk dokumentation. NCD AB levererar allt från konceptskisser till produktionsritningar för byggprojekt i Sverige.",
  alternates: {
    canonical: "/tjanster/byggritningar",
  },
};

export default function ByggritningarPage() {
  return (
    <>
    <ServiceJsonLd
      name="Byggritningar"
      description="Professionella byggritningar och teknisk dokumentation. NCD AB levererar allt från konceptskisser till produktionsritningar för byggprojekt i Sverige."
      url="https://ncdab.se/tjanster/byggritningar"
    />
    <ServicePageLayout
      title="Byggritningar"
      subtitle="Teknisk dokumentation som uppfyller alla krav — från konceptskisser till produktionsritningar."
      description="Vi producerar kompletta ritningsunderlag för bygg- och fastighetsprojekt. Oavsett om det handlar om nyproduktion, ombyggnad eller tillbyggnad levererar vi tydliga och korrekta ritningar som följer gällande standarder. Våra ritningar är framtagna för att underlätta bygglovsprocessen, upphandling och själva produktionen."
      benefits={[
        "Kompletta ritningsunderlag för alla projektfaser",
        "Ritningar anpassade för bygglov och myndighetskrav",
        "Tydlig och konsekvent dokumentation som minskar frågor på plats",
        "Samordnade handlingar mellan alla discipliner",
        "Snabb leverans utan att kompromissa med kvalitet",
        "Digitala och tryckfärdiga format efter behov",
      ]}
      process={[
        {
          title: "Underlag",
          description:
            "Vi tar emot era befintliga underlag och klargör projektets behov och omfattning.",
        },
        {
          title: "Framtagning",
          description:
            "Vi tar fram ritningar med korrekt skala, måttsättning och standardiserade symboler.",
        },
        {
          title: "Granskning",
          description:
            "Intern kvalitetskontroll och avstämning med er för att säkerställa riktigheten.",
        },
        {
          title: "Leverans",
          description:
            "Färdiga ritningar levereras i PDF, DWG eller andra önskade format.",
        },
      ]}
    />
    </>
  );
}
