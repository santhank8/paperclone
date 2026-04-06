import type { VirtualOrgRevenueScorecard } from "@paperclipai/virtual-org-types";

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asNullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function normalizeNetPosition(value: unknown, netNewMrr: number): VirtualOrgRevenueScorecard["netPosition"] {
  if (value === "positive" || value === "flat" || value === "negative") return value;
  if (netNewMrr > 0) return "positive";
  if (netNewMrr < 0) return "negative";
  return "flat";
}

export function normalizeRevenueScorecard(
  value: Partial<VirtualOrgRevenueScorecard> | null | undefined,
): VirtualOrgRevenueScorecard | null {
  if (!value) return null;

  const netNewMrr = asNumber(value.netNewMrr);

  return {
    currency: asString(value.currency, "USD"),
    periodStart: asString(value.periodStart),
    periodEnd: asString(value.periodEnd),
    currentMrr: asNumber(value.currentMrr),
    previousMrr: asNumber(value.previousMrr),
    newMrr: asNumber(value.newMrr),
    expansionMrr: asNumber(value.expansionMrr),
    reactivationMrr: asNumber(value.reactivationMrr),
    contractionMrr: asNumber(value.contractionMrr),
    churnedMrr: asNumber(value.churnedMrr),
    netNewMrr,
    overallChange: asNumber(value.overallChange),
    newCustomers: asNumber(value.newCustomers),
    reactivatedCustomers: asNumber(value.reactivatedCustomers),
    expandedCustomers: asNumber(value.expandedCustomers),
    contractedCustomers: asNumber(value.contractedCustomers),
    lostCustomers: asNumber(value.lostCustomers),
    currentCustomers: asNumber(value.currentCustomers),
    previousCustomers: asNumber(value.previousCustomers),
    revenueGrowthRate: asNullableNumber(value.revenueGrowthRate),
    revenueChurnRate: asNullableNumber(value.revenueChurnRate),
    customerChurnRate: asNullableNumber(value.customerChurnRate),
    estimatedLtv: asNullableNumber(value.estimatedLtv),
    netPosition: normalizeNetPosition(value.netPosition, netNewMrr),
    liveRevenueCurrency: asString(value.liveRevenueCurrency, asString(value.currency, "USD")),
    stripeRevenue: asNumber(value.stripeRevenue),
    manualRevenue: asNumber(value.manualRevenue),
    totalRevenue: asNumber(value.totalRevenue),
    collectionCurrency: asString(value.collectionCurrency, asString(value.currency, "USD")),
    collectionPeriodStart: asString(value.collectionPeriodStart, asString(value.periodStart)),
    collectionPeriodEnd: asString(value.collectionPeriodEnd, asString(value.periodEnd)),
    collectedRevenue: asNumber(value.collectedRevenue),
    collectedViaStripe: asNumber(value.collectedViaStripe),
    collectedManually: asNumber(value.collectedManually),
    collectedOther: asNumber(value.collectedOther),
    recentCollectionCurrency: asString(value.recentCollectionCurrency, asString(value.currency, "USD")),
    recentCollectionPeriodStart: asString(value.recentCollectionPeriodStart),
    recentCollectionPeriodEnd: asString(value.recentCollectionPeriodEnd),
    recentCollectedRevenue: asNumber(value.recentCollectedRevenue),
    recentCollectedViaStripe: asNumber(value.recentCollectedViaStripe),
    recentCollectedManually: asNumber(value.recentCollectedManually),
    failedPayments: asNumber(value.failedPayments),
    failedPaymentAmount: asNumber(value.failedPaymentAmount),
    refunds: asNumber(value.refunds),
    refundAmount: asNumber(value.refundAmount),
  };
}
