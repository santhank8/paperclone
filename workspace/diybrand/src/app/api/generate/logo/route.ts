import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { brandQuestionnaire, brandPalette, brandLogos } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { generateLogos } from "@/lib/logo";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { questionnaireId } = body;

    if (!questionnaireId) {
      return NextResponse.json(
        { error: "questionnaireId is required" },
        { status: 400 }
      );
    }

    // Load questionnaire
    const [questionnaire] = await db
      .select()
      .from(brandQuestionnaire)
      .where(eq(brandQuestionnaire.id, questionnaireId))
      .limit(1);

    if (!questionnaire) {
      return NextResponse.json(
        { error: "Questionnaire not found" },
        { status: 404 }
      );
    }

    // Load selected palette
    const [palette] = await db
      .select()
      .from(brandPalette)
      .where(
        and(
          eq(brandPalette.questionnaireId, questionnaireId),
          eq(brandPalette.selected, true)
        )
      )
      .limit(1);

    const colors = palette?.colors ?? [
      { role: "primary", hex: "#6d28d9" },
      { role: "secondary", hex: "#4f46e5" },
      { role: "accent", hex: "#f59e0b" },
    ];

    const businessName = questionnaire.businessName ?? "Brand";
    const industry = questionnaire.industry ?? "Other";
    const personality = (questionnaire.brandPersonality as string[]) ?? [];

    // Generate logos via Gemini
    const concepts = await generateLogos(businessName, industry, personality, colors);

    // Remove previously generated logos for this questionnaire
    await db
      .delete(brandLogos)
      .where(eq(brandLogos.questionnaireId, questionnaireId));

    // Persist new logos
    const rows = await db
      .insert(brandLogos)
      .values(
        concepts.map((c) => ({
          questionnaireId,
          name: c.name,
          variant: c.variant,
          imageData: c.imageData,
          prompt: c.prompt,
          selected: false,
        }))
      )
      .returning();

    return NextResponse.json({
      logos: rows.map((r) => ({
        id: r.id,
        name: r.name,
        variant: r.variant,
        imageData: r.imageData,
      })),
    });
  } catch (err) {
    console.error("Logo generation error:", err);
    const message =
      err instanceof Error ? err.message : "Something went wrong";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
