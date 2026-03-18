import { GoogleGenerativeAI } from "@google/generative-ai";

export type LogoConcept = {
  name: string;
  variant: "wordmark" | "icon";
  prompt: string;
  imageData: string; // base64 data URI (image/png)
};

const STYLE_MAP: Record<string, string> = {
  Bold: "bold geometric shapes, strong lines",
  Playful: "playful rounded forms, whimsical elements",
  Elegant: "refined thin lines, serif letterforms, luxurious feel",
  Minimal: "ultra-minimal, clean negative space, simple geometry",
  Warm: "soft curves, warm inviting shapes",
  Trustworthy: "stable balanced composition, shield or circle motif",
  Innovative: "futuristic abstract forms, dynamic angles",
  Edgy: "sharp angular shapes, unconventional layout",
  Friendly: "rounded soft shapes, approachable feel",
  Luxurious: "gold accents implied, ornate details, premium feel",
  Rustic: "hand-drawn texture, organic natural elements",
  Modern: "clean sans-serif letterforms, contemporary geometry",
  Classic: "timeless serif typography, traditional crest elements",
  Energetic: "dynamic motion lines, vibrant composition",
  Calm: "gentle flowing lines, zen-inspired simplicity",
  Professional: "corporate clean lines, structured grid layout",
  Quirky: "unexpected asymmetry, creative letterforms",
  Sophisticated: "refined proportions, understated elegance",
  Organic: "leaf and nature motifs, flowing natural curves",
  Techy: "circuit-inspired patterns, digital pixel elements",
};

const INDUSTRY_STYLE: Record<string, string> = {
  Technology: "tech-forward, digital, circuit or node imagery",
  "E-commerce": "shopping bag or cart motif, modern retail",
  "Food & Beverage": "appetizing, fork/spoon/leaf motifs, fresh feel",
  "Health & Wellness": "heart, leaf, or human figure, calming",
  Education: "book, lightbulb, or graduation motif, scholarly",
  Finance: "shield, graph, or pillar motif, trustworthy and stable",
  "Creative & Design": "paintbrush, pencil, or abstract art motif",
  "Real Estate": "house, building, or key motif, solid",
  "Fashion & Apparel": "hanger, needle, or elegant typography",
  "Travel & Hospitality": "globe, compass, or plane motif, adventurous",
  Entertainment: "star, play button, or spotlight motif",
  Consulting: "handshake, lightbulb, or arrow motif, professional",
  "Non-profit": "hands, heart, or globe motif, compassionate",
  Other: "abstract geometric mark",
};

function buildPrompt(
  businessName: string,
  industry: string,
  personality: string[],
  colors: { role: string; hex: string }[],
  variant: "wordmark" | "icon",
  styleSuffix: string
): string {
  const personalityStyles = personality
    .map((adj) => STYLE_MAP[adj] || adj.toLowerCase())
    .join(", ");

  const industryHint = INDUSTRY_STYLE[industry] || INDUSTRY_STYLE["Other"];

  const primaryColor = colors.find((c) => c.role === "primary")?.hex || "#6d28d9";
  const secondaryColor = colors.find((c) => c.role === "secondary")?.hex || "#4f46e5";
  const accentColor = colors.find((c) => c.role === "accent")?.hex || "#f59e0b";

  const base =
    variant === "wordmark"
      ? `Professional logo design for "${businessName}", a ${industry.toLowerCase()} brand. The logo should feature the brand name as stylized text/wordmark. `
      : `Professional icon/symbol logo mark for "${businessName}", a ${industry.toLowerCase()} brand. The logo should be a standalone graphic symbol without text. `;

  return (
    base +
    `Style: ${personalityStyles}. ` +
    `Industry feel: ${industryHint}. ` +
    `Color palette: primary ${primaryColor}, secondary ${secondaryColor}, accent ${accentColor}. ` +
    `${styleSuffix}. ` +
    `The logo should be on a clean white background, vector-style, high contrast, suitable for both print and digital use. ` +
    `No mockups, no text other than the brand name (if wordmark), no busy backgrounds.`
  );
}

const CONCEPT_VARIANTS: { name: string; variant: "wordmark" | "icon"; styleSuffix: string }[] = [
  {
    name: "Modern Wordmark",
    variant: "wordmark",
    styleSuffix: "Modern clean typography, geometric letter styling",
  },
  {
    name: "Classic Wordmark",
    variant: "wordmark",
    styleSuffix: "Timeless elegant typography, refined letter spacing",
  },
  {
    name: "Brand Icon",
    variant: "icon",
    styleSuffix: "Memorable iconic symbol, works at small sizes, single distinctive shape",
  },
  {
    name: "Abstract Mark",
    variant: "icon",
    styleSuffix: "Abstract geometric mark, unique and ownable shape, minimal detail",
  },
];

export async function generateLogos(
  businessName: string,
  industry: string,
  personality: string[],
  colors: { role: string; hex: string }[]
): Promise<LogoConcept[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-exp",
    generationConfig: {
      // @ts-expect-error -- responseModalities is supported but not yet in SDK types
      responseModalities: ["TEXT", "IMAGE"],
    },
  });

  const results: LogoConcept[] = [];

  // Generate logos sequentially to respect rate limits
  for (const concept of CONCEPT_VARIANTS) {
    const prompt = buildPrompt(
      businessName,
      industry,
      personality,
      colors,
      concept.variant,
      concept.styleSuffix
    );

    try {
      const result = await model.generateContent(prompt);
      const response = result.response;

      // Extract image from response parts
      const parts = response.candidates?.[0]?.content?.parts;
      if (!parts) continue;

      for (const part of parts) {
        if (part.inlineData?.mimeType?.startsWith("image/")) {
          results.push({
            name: concept.name,
            variant: concept.variant,
            prompt,
            imageData: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
          });
          break; // One image per concept
        }
      }
    } catch (err) {
      console.error(`Logo generation failed for "${concept.name}":`, err);
      // Continue with remaining concepts
    }
  }

  if (results.length === 0) {
    throw new Error("Failed to generate any logo concepts. Please try again.");
  }

  return results;
}
