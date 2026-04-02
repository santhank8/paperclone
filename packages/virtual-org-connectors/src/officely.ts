import type { VirtualOrgConnectorKind } from "@paperclipai/virtual-org-types";

// Officely V1 focuses on one thing: reliably matching customers before making claims.
export interface OfficelyCustomerProfileSeed {
  id?: string;
  companyName: string;
  accountName?: string | null;
  workspaceId?: string | null;
  primaryEmailDomain?: string | null;
  planName?: string | null;
  accountStatus?: string | null;
  firstSeenAt?: Date | string | null;
  ownerUserId?: string | null;
  hubspotCompanyId?: string | null;
  hubspotDealIds?: string[];
  stripeCustomerId?: string | null;
  xeroContactId?: string | null;
  intercomCompanyId?: string | null;
  posthogGroupKey?: string | null;
  internalAccountId?: string | null;
  attributesJson?: Record<string, unknown>;
}

export interface OfficelyInternalAccountRecord {
  internalAccountId: string;
  companyName: string;
  accountName?: string | null;
  workspaceId?: string | null;
  primaryEmailDomain?: string | null;
  planName?: string | null;
  accountStatus?: string | null;
  firstSeenAt?: Date | string | null;
  ownerUserId?: string | null;
  hubspotCompanyId?: string | null;
  hubspotDealIds?: string[];
  stripeCustomerId?: string | null;
  xeroContactId?: string | null;
  intercomCompanyId?: string | null;
  posthogGroupKey?: string | null;
  userCount?: number | null;
  mrr?: number | null;
  churnRisk?: string | null;
  onboardingState?: string | null;
}

export interface OfficelyXeroInvoiceRecord {
  invoiceId: string;
  contactId: string;
  companyName?: string | null;
  primaryEmailDomain?: string | null;
  invoiceDate?: Date | string | null;
  dueDate?: Date | string | null;
  paidDate?: Date | string | null;
  amount: number;
  currency: string;
  status: string;
  paymentMethod?: string | null;
  manualPayment?: boolean | null;
}

export interface OfficelyStripeEventRecord {
  eventId: string;
  customerId: string;
  companyName?: string | null;
  primaryEmailDomain?: string | null;
  eventType: "payment_succeeded" | "payment_failed" | "upgrade" | "downgrade" | "refund" | "cancellation";
  occurredAt: Date | string;
  amount?: number | null;
  planName?: string | null;
}

export interface OfficelyPostHogAccountRecord {
  groupKey: string;
  companyName?: string | null;
  primaryEmailDomain?: string | null;
  planName?: string | null;
  activeUsers: number;
  keyFeatureCount?: number | null;
  onboardingCompletedAt?: Date | string | null;
  retainedInWeekTwo?: boolean | null;
  lastSeenAt?: Date | string | null;
}

export interface OfficelyV1SyncPayload {
  generatedAt?: Date | string | null;
  internalAccounts: OfficelyInternalAccountRecord[];
  xeroInvoices: OfficelyXeroInvoiceRecord[];
  stripeEvents: OfficelyStripeEventRecord[];
  posthogAccounts: OfficelyPostHogAccountRecord[];
}

export interface OfficelyRevenueMetrics {
  bookedRevenueThisWindow: number;
  bookedRevenuePreviousWindow: number;
  manualTransferRevenueThisWindow: number;
  failedPaymentsThisWindow: number;
  upgradesThisWindow: number;
  downgradesThisWindow: number;
}

export interface OfficelyInsightDraft {
  type: string;
  title: string;
  summary: string;
  confidence: number;
  sourceKinds: VirtualOrgConnectorKind[];
  recommendedAction: string | null;
}

export interface OfficelyBuiltProfile extends OfficelyCustomerProfileSeed {
  attributesJson: Record<string, unknown>;
  firstSeenAt: Date | null;
}

function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeName(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeDomain(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replace(/^@/, "");
  return normalized.length > 0 ? normalized : null;
}

function isPaidInvoice(status: string) {
  const normalized = status.trim().toLowerCase();
  return normalized === "paid" || normalized === "authorised" || normalized === "authorized";
}

function isManualTransfer(invoice: OfficelyXeroInvoiceRecord) {
  if (invoice.manualPayment === true) return true;
  const paymentMethod = invoice.paymentMethod?.trim().toLowerCase() ?? "";
  return paymentMethod.includes("manual") || paymentMethod.includes("bank transfer");
}

function startOfRollingWindow(endAt: Date, days: number) {
  return new Date(endAt.getTime() - days * 24 * 60 * 60 * 1000);
}

function isWithinWindow(value: Date | null, startInclusive: Date, endInclusive: Date) {
  if (!value) return false;
  return value >= startInclusive && value <= endInclusive;
}

function addProfileMapEntry(map: Map<string, Set<number>>, key: string | null, index: number) {
  if (!key) return;
  const existing = map.get(key) ?? new Set<number>();
  existing.add(index);
  map.set(key, existing);
}

function uniqueIndexMatch(map: Map<string, Set<number>>, key: string | null): number | null {
  if (!key) return null;
  const matches = map.get(key);
  if (!matches || matches.size !== 1) return null;
  return [...matches][0] ?? null;
}

function buildMatchIndexes(profiles: OfficelyBuiltProfile[]) {
  const internalAccountIds = new Map<string, Set<number>>();
  const workspaceIds = new Map<string, Set<number>>();
  const stripeCustomerIds = new Map<string, Set<number>>();
  const xeroContactIds = new Map<string, Set<number>>();
  const hubspotCompanyIds = new Map<string, Set<number>>();
  const posthogGroupKeys = new Map<string, Set<number>>();
  const primaryEmailDomains = new Map<string, Set<number>>();
  const normalizedCompanyNames = new Map<string, Set<number>>();

  profiles.forEach((profile, index) => {
    addProfileMapEntry(internalAccountIds, normalizeOptionalText(profile.internalAccountId), index);
    addProfileMapEntry(workspaceIds, normalizeOptionalText(profile.workspaceId), index);
    addProfileMapEntry(stripeCustomerIds, normalizeOptionalText(profile.stripeCustomerId), index);
    addProfileMapEntry(xeroContactIds, normalizeOptionalText(profile.xeroContactId), index);
    addProfileMapEntry(hubspotCompanyIds, normalizeOptionalText(profile.hubspotCompanyId), index);
    addProfileMapEntry(posthogGroupKeys, normalizeOptionalText(profile.posthogGroupKey), index);
    addProfileMapEntry(primaryEmailDomains, normalizeDomain(profile.primaryEmailDomain), index);
    addProfileMapEntry(normalizedCompanyNames, normalizeName(profile.companyName), index);
  });

  return {
    internalAccountIds,
    workspaceIds,
    stripeCustomerIds,
    xeroContactIds,
    hubspotCompanyIds,
    posthogGroupKeys,
    primaryEmailDomains,
    normalizedCompanyNames,
  };
}

function findExistingProfileIndex(
  profiles: OfficelyBuiltProfile[],
  candidate: Partial<OfficelyCustomerProfileSeed>,
): number | null {
  const indexes = buildMatchIndexes(profiles);

  return (
    uniqueIndexMatch(indexes.internalAccountIds, normalizeOptionalText(candidate.internalAccountId)) ??
    uniqueIndexMatch(indexes.workspaceIds, normalizeOptionalText(candidate.workspaceId)) ??
    uniqueIndexMatch(indexes.stripeCustomerIds, normalizeOptionalText(candidate.stripeCustomerId)) ??
    uniqueIndexMatch(indexes.xeroContactIds, normalizeOptionalText(candidate.xeroContactId)) ??
    uniqueIndexMatch(indexes.hubspotCompanyIds, normalizeOptionalText(candidate.hubspotCompanyId)) ??
    uniqueIndexMatch(indexes.posthogGroupKeys, normalizeOptionalText(candidate.posthogGroupKey)) ??
    uniqueIndexMatch(indexes.primaryEmailDomains, normalizeDomain(candidate.primaryEmailDomain)) ??
    uniqueIndexMatch(indexes.normalizedCompanyNames, normalizeName(candidate.companyName))
  );
}

function mergeDates(current: Date | null, incoming: Date | string | null | undefined) {
  const incomingDate = asDate(incoming);
  if (!current) return incomingDate;
  if (!incomingDate) return current;
  return incomingDate < current ? incomingDate : current;
}

function mergeDefined<T>(current: T | null | undefined, incoming: T | null | undefined): T | null | undefined {
  return incoming ?? current;
}

function getNestedRecord(parent: Record<string, unknown>, key: string) {
  const existing = parent[key];
  if (typeof existing === "object" && existing !== null && !Array.isArray(existing)) {
    return { ...(existing as Record<string, unknown>) };
  }
  return {};
}

function upsertProfile(
  profiles: OfficelyBuiltProfile[],
  candidate: Partial<OfficelyCustomerProfileSeed>,
  merge: (profile: OfficelyBuiltProfile) => OfficelyBuiltProfile,
) {
  const matchIndex = findExistingProfileIndex(profiles, candidate);
  if (matchIndex === null) {
    const newProfile = merge({
      companyName: candidate.companyName ?? "Unknown customer",
      accountName: null,
      workspaceId: null,
      primaryEmailDomain: null,
      planName: null,
      accountStatus: null,
      firstSeenAt: null,
      ownerUserId: null,
      hubspotCompanyId: null,
      hubspotDealIds: [],
      stripeCustomerId: null,
      xeroContactId: null,
      intercomCompanyId: null,
      posthogGroupKey: null,
      internalAccountId: null,
      attributesJson: {},
    });
    profiles.push(newProfile);
    return newProfile;
  }

  const merged = merge(profiles[matchIndex]!);
  profiles.splice(matchIndex, 1, merged);
  return merged;
}

export function buildOfficelyCustomerProfiles(input: {
  existingProfiles?: OfficelyCustomerProfileSeed[];
  payload: OfficelyV1SyncPayload;
}): OfficelyBuiltProfile[] {
  const profiles: OfficelyBuiltProfile[] = (input.existingProfiles ?? []).map((profile) => ({
    ...profile,
    firstSeenAt: asDate(profile.firstSeenAt),
    hubspotDealIds: [...(profile.hubspotDealIds ?? [])],
    attributesJson: { ...(profile.attributesJson ?? {}) },
  }));

  for (const account of input.payload.internalAccounts) {
    upsertProfile(
      profiles,
      {
        companyName: account.companyName,
        internalAccountId: account.internalAccountId,
        workspaceId: account.workspaceId ?? null,
        stripeCustomerId: account.stripeCustomerId ?? null,
        xeroContactId: account.xeroContactId ?? null,
        hubspotCompanyId: account.hubspotCompanyId ?? null,
        primaryEmailDomain: account.primaryEmailDomain ?? null,
      },
      (profile) => {
        const attributesJson = { ...profile.attributesJson };
        attributesJson.internal = {
          ...getNestedRecord(attributesJson, "internal"),
          userCount: account.userCount ?? null,
          mrr: account.mrr ?? null,
          churnRisk: account.churnRisk ?? null,
          onboardingState: account.onboardingState ?? null,
        };

        return {
          ...profile,
          companyName: account.companyName,
          accountName: mergeDefined(profile.accountName, account.accountName ?? null) ?? null,
          workspaceId: normalizeOptionalText(account.workspaceId),
          primaryEmailDomain: normalizeDomain(account.primaryEmailDomain),
          planName: account.planName ?? null,
          accountStatus: account.accountStatus ?? null,
          firstSeenAt: mergeDates(profile.firstSeenAt, account.firstSeenAt),
          ownerUserId: account.ownerUserId ?? null,
          hubspotCompanyId: normalizeOptionalText(account.hubspotCompanyId),
          hubspotDealIds: [...(account.hubspotDealIds ?? profile.hubspotDealIds ?? [])],
          stripeCustomerId: normalizeOptionalText(account.stripeCustomerId),
          xeroContactId: normalizeOptionalText(account.xeroContactId),
          intercomCompanyId: normalizeOptionalText(account.intercomCompanyId),
          posthogGroupKey: normalizeOptionalText(account.posthogGroupKey),
          internalAccountId: normalizeOptionalText(account.internalAccountId),
          attributesJson,
        };
      },
    );
  }

  for (const invoice of input.payload.xeroInvoices) {
    upsertProfile(
      profiles,
      {
        ...(invoice.companyName ? { companyName: invoice.companyName } : {}),
        xeroContactId: invoice.contactId,
        primaryEmailDomain: invoice.primaryEmailDomain ?? null,
      },
      (profile) => {
        const attributesJson = { ...profile.attributesJson };
        const xeroMetrics = getNestedRecord(attributesJson, "xero");
        xeroMetrics.bookedRevenue = Number(xeroMetrics.bookedRevenue ?? 0) + invoice.amount;
        xeroMetrics.manualRevenue = Number(xeroMetrics.manualRevenue ?? 0) + (isManualTransfer(invoice) ? invoice.amount : 0);
        xeroMetrics.lastInvoiceStatus = invoice.status;
        xeroMetrics.lastInvoiceDate = (asDate(invoice.paidDate) ?? asDate(invoice.invoiceDate))?.toISOString() ?? null;
        attributesJson.xero = xeroMetrics;

        return {
          ...profile,
          companyName: profile.companyName || invoice.companyName || "Unknown customer",
          primaryEmailDomain: normalizeDomain(mergeDefined(profile.primaryEmailDomain, invoice.primaryEmailDomain ?? null) ?? null),
          xeroContactId: normalizeOptionalText(invoice.contactId),
          attributesJson,
        };
      },
    );
  }

  for (const event of input.payload.stripeEvents) {
    upsertProfile(
      profiles,
      {
        ...(event.companyName ? { companyName: event.companyName } : {}),
        stripeCustomerId: event.customerId,
        primaryEmailDomain: event.primaryEmailDomain ?? null,
      },
      (profile) => {
        const attributesJson = { ...profile.attributesJson };
        const stripeMetrics = getNestedRecord(attributesJson, "stripe");
        stripeMetrics.failedPayments = Number(stripeMetrics.failedPayments ?? 0) + (event.eventType === "payment_failed" ? 1 : 0);
        stripeMetrics.upgrades = Number(stripeMetrics.upgrades ?? 0) + (event.eventType === "upgrade" ? 1 : 0);
        stripeMetrics.downgrades = Number(stripeMetrics.downgrades ?? 0) + (event.eventType === "downgrade" ? 1 : 0);
        stripeMetrics.lastEventType = event.eventType;
        stripeMetrics.lastEventAt = asDate(event.occurredAt)?.toISOString() ?? null;
        attributesJson.stripe = stripeMetrics;

        return {
          ...profile,
          companyName: profile.companyName || event.companyName || "Unknown customer",
          primaryEmailDomain: normalizeDomain(mergeDefined(profile.primaryEmailDomain, event.primaryEmailDomain ?? null) ?? null),
          planName: mergeDefined(profile.planName, event.planName ?? null) ?? null,
          stripeCustomerId: normalizeOptionalText(event.customerId),
          attributesJson,
        };
      },
    );
  }

  for (const usage of input.payload.posthogAccounts) {
    upsertProfile(
      profiles,
      {
        ...(usage.companyName ? { companyName: usage.companyName } : {}),
        posthogGroupKey: usage.groupKey,
        primaryEmailDomain: usage.primaryEmailDomain ?? null,
      },
      (profile) => {
        const attributesJson = { ...profile.attributesJson };
        attributesJson.posthog = {
          ...getNestedRecord(attributesJson, "posthog"),
          activeUsers: usage.activeUsers,
          keyFeatureCount: usage.keyFeatureCount ?? null,
          onboardingCompletedAt: asDate(usage.onboardingCompletedAt)?.toISOString() ?? null,
          retainedInWeekTwo: usage.retainedInWeekTwo ?? null,
          lastSeenAt: asDate(usage.lastSeenAt)?.toISOString() ?? null,
        };

        return {
          ...profile,
          companyName: profile.companyName || usage.companyName || "Unknown customer",
          primaryEmailDomain: normalizeDomain(mergeDefined(profile.primaryEmailDomain, usage.primaryEmailDomain ?? null) ?? null),
          planName: mergeDefined(profile.planName, usage.planName ?? null) ?? null,
          posthogGroupKey: normalizeOptionalText(usage.groupKey),
          attributesJson,
        };
      },
    );
  }

  return profiles;
}

export function calculateOfficelyRevenueMetrics(input: Pick<OfficelyV1SyncPayload, "generatedAt" | "xeroInvoices" | "stripeEvents">): OfficelyRevenueMetrics {
  const endAt = asDate(input.generatedAt) ?? new Date();
  const currentWindowStart = startOfRollingWindow(endAt, 7);
  const previousWindowStart = startOfRollingWindow(endAt, 14);

  const bookedRevenueThisWindow = input.xeroInvoices
    .filter((invoice) => isPaidInvoice(invoice.status))
    .filter((invoice) => isWithinWindow(asDate(invoice.paidDate) ?? asDate(invoice.invoiceDate), currentWindowStart, endAt))
    .reduce((sum, invoice) => sum + invoice.amount, 0);

  const bookedRevenuePreviousWindow = input.xeroInvoices
    .filter((invoice) => isPaidInvoice(invoice.status))
    .filter((invoice) => {
      const bookedAt = asDate(invoice.paidDate) ?? asDate(invoice.invoiceDate);
      return Boolean(bookedAt && bookedAt >= previousWindowStart && bookedAt < currentWindowStart);
    })
    .reduce((sum, invoice) => sum + invoice.amount, 0);

  const manualTransferRevenueThisWindow = input.xeroInvoices
    .filter((invoice) => isPaidInvoice(invoice.status))
    .filter((invoice) => isManualTransfer(invoice))
    .filter((invoice) => isWithinWindow(asDate(invoice.paidDate) ?? asDate(invoice.invoiceDate), currentWindowStart, endAt))
    .reduce((sum, invoice) => sum + invoice.amount, 0);

  const failedPaymentsThisWindow = input.stripeEvents
    .filter((event) => event.eventType === "payment_failed")
    .filter((event) => isWithinWindow(asDate(event.occurredAt), currentWindowStart, endAt))
    .length;

  const upgradesThisWindow = input.stripeEvents
    .filter((event) => event.eventType === "upgrade")
    .filter((event) => isWithinWindow(asDate(event.occurredAt), currentWindowStart, endAt))
    .length;

  const downgradesThisWindow = input.stripeEvents
    .filter((event) => event.eventType === "downgrade")
    .filter((event) => isWithinWindow(asDate(event.occurredAt), currentWindowStart, endAt))
    .length;

  return {
    bookedRevenueThisWindow,
    bookedRevenuePreviousWindow,
    manualTransferRevenueThisWindow,
    failedPaymentsThisWindow,
    upgradesThisWindow,
    downgradesThisWindow,
  };
}

export function generateOfficelyInsightDrafts(input: {
  payload: OfficelyV1SyncPayload;
  customerProfiles: OfficelyBuiltProfile[];
}): OfficelyInsightDraft[] {
  const metrics = calculateOfficelyRevenueMetrics(input.payload);
  const insights: OfficelyInsightDraft[] = [];

  if (metrics.bookedRevenueThisWindow > 0 || metrics.bookedRevenuePreviousWindow > 0) {
    const delta = metrics.bookedRevenueThisWindow - metrics.bookedRevenuePreviousWindow;
    const direction = delta >= 0 ? "up" : "down";
    insights.push({
      type: "officely_v1_booked_revenue",
      title: "Booked revenue moved this week",
      summary: `Xero shows ${metrics.bookedRevenueThisWindow.toFixed(2)} booked this week, ${direction} ${Math.abs(delta).toFixed(2)} versus the prior 7 days.`,
      confidence: 0.92,
      sourceKinds: ["xero"],
      recommendedAction: "Review invoice-level changes before treating this as a durable growth trend.",
    });
  }

  if (metrics.manualTransferRevenueThisWindow > 0) {
    insights.push({
      type: "officely_v1_manual_revenue",
      title: "Manual transfer revenue needs eyes on it",
      summary: `Xero tagged ${metrics.manualTransferRevenueThisWindow.toFixed(2)} as manual-transfer revenue this week.`,
      confidence: 0.88,
      sourceKinds: ["xero"],
      recommendedAction: "Check whether these manual collections are expected or a sign that automated billing is leaking.",
    });
  }

  if (metrics.failedPaymentsThisWindow > 0 || metrics.upgradesThisWindow > 0 || metrics.downgradesThisWindow > 0) {
    insights.push({
      type: "officely_v1_billing_events",
      title: "Stripe billing events changed this week",
      summary: `Stripe recorded ${metrics.failedPaymentsThisWindow} failed payments, ${metrics.upgradesThisWindow} upgrades, and ${metrics.downgradesThisWindow} downgrades in the last 7 days.`,
      confidence: 0.9,
      sourceKinds: ["stripe"],
      recommendedAction: metrics.failedPaymentsThisWindow > 0
        ? "Follow up on failed payments first, then check whether the downgrade pattern points to one segment or plan."
        : "Review the upgrade and downgrade mix by plan before changing pricing or packaging.",
    });
  }

  const riskyProfiles = input.customerProfiles.filter((profile) => {
    const posthog = getNestedRecord(profile.attributesJson, "posthog");
    const activeUsers = Number(posthog.activeUsers ?? 0);
    const onboardingCompletedAt = asDate(typeof posthog.onboardingCompletedAt === "string" ? posthog.onboardingCompletedAt : null);
    return Boolean(onboardingCompletedAt) && activeUsers === 0;
  });

  if (riskyProfiles.length > 0) {
    const examples = riskyProfiles.slice(0, 3).map((profile) => profile.companyName).join(", ");
    insights.push({
      type: "officely_v1_usage_risk",
      title: "Some onboarded accounts have gone quiet",
      summary: `${riskyProfiles.length} account${riskyProfiles.length === 1 ? "" : "s"} completed onboarding but show no active users in PostHog. Example${riskyProfiles.length === 1 ? "" : "s"}: ${examples}.`,
      confidence: 0.84,
      sourceKinds: ["internal_database", "posthog"],
      recommendedAction: "Start with the quietest accounts and check whether onboarding completed without a meaningful first workflow.",
    });
  }

  return insights;
}
