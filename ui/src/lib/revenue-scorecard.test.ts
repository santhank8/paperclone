import { describe, expect, it } from "vitest";
import { normalizeRevenueScorecard } from "./revenue-scorecard";

describe("normalizeRevenueScorecard", () => {
  it("fills in missing numeric fields so older snapshots do not crash the workspace", () => {
    expect(normalizeRevenueScorecard({
      currency: "mixed",
      periodStart: "2026-03-01T00:00:00.000Z",
      periodEnd: "2026-03-31T23:59:59.999Z",
      currentMrr: 2830,
      previousMrr: 460,
      newMrr: 2325,
      expansionMrr: 45,
      netNewMrr: 2370,
      overallChange: 2370,
      failedPayments: 13,
      failedPaymentAmount: 1713.07,
      refunds: 0,
      refundAmount: 0,
    })).toMatchObject({
      currency: "mixed",
      currentMrr: 2830,
      previousMrr: 460,
      netNewMrr: 2370,
      collectedRevenue: 0,
      collectedViaStripe: 0,
      collectedManually: 0,
      collectedOther: 0,
      failedPayments: 13,
      failedPaymentAmount: 1713.07,
      refunds: 0,
      refundAmount: 0,
      netPosition: "positive",
    });
  });

  it("returns null when there is no scorecard", () => {
    expect(normalizeRevenueScorecard(null)).toBeNull();
  });
});
