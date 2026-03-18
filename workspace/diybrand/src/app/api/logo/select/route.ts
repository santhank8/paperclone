import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { brandLogos } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const { logoId, questionnaireId } = await request.json();

    if (!logoId || !questionnaireId) {
      return NextResponse.json(
        { error: "logoId and questionnaireId are required" },
        { status: 400 }
      );
    }

    // Deselect all logos for this questionnaire
    await db
      .update(brandLogos)
      .set({ selected: false })
      .where(eq(brandLogos.questionnaireId, questionnaireId));

    // Select the chosen one
    const [row] = await db
      .update(brandLogos)
      .set({ selected: true })
      .where(
        and(
          eq(brandLogos.id, logoId),
          eq(brandLogos.questionnaireId, questionnaireId)
        )
      )
      .returning();

    if (!row) {
      return NextResponse.json({ error: "Logo not found" }, { status: 404 });
    }

    return NextResponse.json(row);
  } catch {
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
