export function OrganizationJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "NCD AB",
    url: "https://ncdab.se",
    description:
      "Svenskt byggkonsultföretag som erbjuder BIM/Revit-modellering, byggritningar, projektledning och drönardokumentation.",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Exempelgatan 1",
      addressLocality: "Stockholm",
      postalCode: "123 45",
      addressCountry: "SE",
    },
    telephone: "+46701234567",
    email: "info@ncdab.se",
    areaServed: {
      "@type": "Country",
      name: "Sweden",
    },
    knowsAbout: [
      "BIM-modellering",
      "Revit",
      "Byggritningar",
      "Projektledning",
      "Drönardokumentation",
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function LocalBusinessJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "NCD AB",
    url: "https://ncdab.se",
    description:
      "Svenskt byggkonsultföretag som erbjuder BIM/Revit-modellering, byggritningar, projektledning och drönardokumentation.",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Exempelgatan 1",
      addressLocality: "Stockholm",
      postalCode: "123 45",
      addressCountry: "SE",
    },
    telephone: "+46701234567",
    email: "info@ncdab.se",
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: "08:00",
      closes: "17:00",
    },
    priceRange: "$$",
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function ServiceJsonLd({
  name,
  description,
  url,
}: {
  name: string;
  description: string;
  url: string;
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Service",
    name,
    description,
    url,
    provider: {
      "@type": "Organization",
      name: "NCD AB",
      url: "https://ncdab.se",
    },
    areaServed: {
      "@type": "Country",
      name: "Sweden",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
