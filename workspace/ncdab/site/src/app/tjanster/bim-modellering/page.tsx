import type { Metadata } from "next";
import ServicePageLayout from "@/components/ServicePageLayout";

export const metadata: Metadata = {
  title: "BIM/Revit-modellering",
  description:
    "Professionell BIM-modellering i Autodesk Revit. NCD AB skapar detaljerade 3D-modeller för arkitekter, konstruktörer och entreprenörer.",
};

export default function BimModelleringPage() {
  return (
    <ServicePageLayout
      title="BIM/Revit-modellering"
      subtitle="Detaljerade 3D-modeller som ger full kontroll och bättre beslutsunderlag genom hela projektet."
      description="Vi skapar högkvalitativa BIM-modeller i Autodesk Revit som ger samtliga projektdeltagare en gemensam, detaljerad bild av byggnaden. Våra modeller följer svenska BIM-standarder och kan användas för allt från visualisering och kollisionskontroll till mängdavtagning och produktionsplanering. Genom att arbeta med BIM från tidig fas minskar risken för fel, förseningar och oväntade kostnader."
      benefits={[
        "Detaljerade 3D-modeller enligt svenska BIM-standarder",
        "Kollisionskontroll som identifierar problem innan bygget startar",
        "Mängdavtagning direkt från modellen för exakt kostnadsberäkning",
        "Sömlös samordning mellan arkitekt, konstruktör och installatör",
        "Visualiseringar som underlättar kommunikation med beställare",
        "Lägre risk för ändringar och fördyringar under produktionen",
      ]}
      process={[
        {
          title: "Behovsanalys",
          description:
            "Vi kartlägger era krav, projektets omfattning och vilken BIM-nivå som behövs.",
        },
        {
          title: "Modellering",
          description:
            "Vi bygger modellen i Revit med rätt detaljeringsgrad och strukturerad data.",
        },
        {
          title: "Kvalitetssäkring",
          description:
            "Kollisionskontroll, regelverkscheck och intern granskning innan leverans.",
        },
        {
          title: "Leverans & support",
          description:
            "Färdig modell levereras i överenskomna format med dokumentation och support.",
        },
      ]}
    />
  );
}
