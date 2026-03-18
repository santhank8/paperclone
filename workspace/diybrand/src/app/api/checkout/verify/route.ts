import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.json(
      { error: "Missing session_id" },
      { status: 400 }
    );
  }

  // Check if we already have the order recorded (via webhook)
  const [existing] = await db
    .select()
    .from(orders)
    .where(eq(orders.stripeSessionId, sessionId))
    .limit(1);

  if (existing) {
    return NextResponse.json({
      paid: true,
      tier: existing.tier,
      questionnaireId: existing.questionnaireId,
    });
  }

  // Webhook may not have fired yet — verify directly with Stripe
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);

    if (session.payment_status === "paid" && session.metadata) {
      const { questionnaireId, tier } = session.metadata;
      if (questionnaireId && tier && session.customer_details?.email) {
        // Record the order since webhook hasn't processed it yet
        await db
          .insert(orders)
          .values({
            email: session.customer_details.email,
            stripeSessionId: session.id,
            tier,
            questionnaireId,
            paidAt: new Date(),
          })
          .onConflictDoNothing();

        return NextResponse.json({
          paid: true,
          tier,
          questionnaireId,
        });
      }
    }

    return NextResponse.json({ paid: false });
  } catch {
    return NextResponse.json({ paid: false });
  }
}
