import type {
  VirtualOrgConnectorKind,
  VirtualOrgFounderBrief,
  VirtualOrgRevenueScorecard,
} from "@paperclipai/virtual-org-types";

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
  billingPeriodMonths?: number | null;
  monthlyRecurringAmount?: number | null;
}

export interface OfficelyXeroCashReceiptRecord {
  transactionId: string;
  companyName?: string | null;
  receivedAt: Date | string;
  amount: number;
  currency: string;
  bankAccountName?: string | null;
  reference?: string | null;
  source: "stripe" | "manual" | "other";
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
  xeroCashReceipts: OfficelyXeroCashReceiptRecord[];
  stripeEvents: OfficelyStripeEventRecord[];
  posthogAccounts: OfficelyPostHogAccountRecord[];
}

export interface OfficelyRevenueMetrics {
  bookedRevenueThisWindow: number;
  bookedRevenuePreviousWindow: number;
  manualTransferRevenueThisWindow: number;
  failedPaymentsThisWindow: number;
  failedPaymentAmountThisWindow: number;
  refundsThisWindow: number;
  refundAmountThisWindow: number;
  cancellationsThisWindow: number;
  cancellationAmountThisWindow: number;
  upgradesThisWindow: number;
  upgradeAmountThisWindow: number;
  downgradesThisWindow: number;
  downgradeAmountThisWindow: number;
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

export interface OfficelyRevenueScorecard extends VirtualOrgRevenueScorecard {}

export interface OfficelyPostHogProjectPulse {
  checkedAt: string;
  eventCount: number;
  activeUserTotal: number;
  onboardingEvent: string | null;
  onboardingEventCount: number;
  importantEventCounts: Array<{ eventName: string; count: number }>;
}

export interface OfficelySlackFeedbackPulse {
  checkedAt: string;
  channelId: string | null;
  channelsReviewed: number;
  channelsWithMessages: number;
  messageCount: number;
  customerMessageCount: number;
  customerFeedbackMessages: number;
  techIssueMessages: number;
  bugMentions: number;
  featureRequestMentions: number;
  churnRiskMentions: number;
  praiseMentions: number;
  supportMentions: number;
  highlights: Array<{
    postedAt: string;
    channelName: string | null;
    channelBucket: "customer_feedback" | "tech_issues" | "other";
    authorLabel: string | null;
    text: string;
    categories: string[];
  }>;
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

function isStripeCollectedInvoice(invoice: OfficelyXeroInvoiceRecord) {
  const paymentMethod = invoice.paymentMethod?.trim().toLowerCase() ?? "";
  return paymentMethod.includes("stripe");
}

function classifyInvoiceCollectionSource(invoice: OfficelyXeroInvoiceRecord): "stripe" | "manual" | "other" {
  if (isStripeCollectedInvoice(invoice)) return "stripe";
  if (isManualTransfer(invoice)) return "manual";
  return "other";
}

function startOfRollingWindow(endAt: Date, days: number) {
  return new Date(endAt.getTime() - days * 24 * 60 * 60 * 1000);
}

function startOfMonth(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1, 0, 0, 0, 0));
}

function addMonths(value: Date, months: number) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + months, 1, 0, 0, 0, 0));
}

function endOfPreviousMonth(value: Date) {
  return new Date(startOfMonth(value).getTime() - 1);
}

function isWithinWindow(value: Date | null, startInclusive: Date, endInclusive: Date) {
  if (!value) return false;
  return value >= startInclusive && value <= endInclusive;
}

function sumEventAmount(events: OfficelyStripeEventRecord[]) {
  return events.reduce((sum, event) => sum + (event.amount ?? 0), 0);
}

function getInvoiceBookedAt(invoice: OfficelyXeroInvoiceRecord) {
  return asDate(invoice.paidDate) ?? asDate(invoice.invoiceDate);
}

function getInvoiceMonthlyRecurringAmount(invoice: OfficelyXeroInvoiceRecord) {
  if (typeof invoice.monthlyRecurringAmount === "number" && Number.isFinite(invoice.monthlyRecurringAmount) && invoice.monthlyRecurringAmount > 0) {
    return invoice.monthlyRecurringAmount;
  }

  const periodMonths =
    typeof invoice.billingPeriodMonths === "number" && Number.isFinite(invoice.billingPeriodMonths) && invoice.billingPeriodMonths > 0
      ? invoice.billingPeriodMonths
      : 1;
  return invoice.amount / periodMonths;
}

function getRevenueCustomerKey(invoice: OfficelyXeroInvoiceRecord) {
  return (
    normalizeOptionalText(invoice.contactId) ??
    normalizeDomain(invoice.primaryEmailDomain) ??
    normalizeName(invoice.companyName) ??
    invoice.invoiceId
  );
}

function isWithinRange(value: Date | null, startInclusive: Date, endExclusive: Date) {
  if (!value) return false;
  return value >= startInclusive && value < endExclusive;
}

function sumCollectionAmountsBySource<T extends { amount: number }>(
  records: T[],
  getSource: (record: T) => "stripe" | "manual" | "other",
) {
  return records.reduce(
    (totals, record) => {
      totals.total += record.amount;
      const source = getSource(record);
      if (source === "stripe") totals.stripe += record.amount;
      if (source === "manual") totals.manual += record.amount;
      if (source === "other") totals.other += record.amount;
      return totals;
    },
    { total: 0, stripe: 0, manual: 0, other: 0 },
  );
}

function pickScorecardCurrency(invoices: OfficelyXeroInvoiceRecord[]) {
  const currencies = [...new Set(
    invoices
      .filter((invoice) => isPaidInvoice(invoice.status))
      .map((invoice) => normalizeOptionalText(invoice.currency))
      .filter((value): value is string => Boolean(value)),
  )];
  if (currencies.length === 1) return currencies[0]!;
  if (currencies.length > 1) return "mixed";
  return "USD";
}

function pickCollectionCurrency<T>(records: T[], getCurrency: (record: T) => string | null) {
  const currencies = [...new Set(
    records
      .map(getCurrency)
      .map((value) => normalizeOptionalText(value))
      .filter((value): value is string => Boolean(value)),
  )];
  if (currencies.length === 1) return currencies[0]!;
  if (currencies.length > 1) return "mixed";
  return "USD";
}

function pickEventCurrency(events: OfficelyStripeEventRecord[]) {
  const currencies = [...new Set(
    events
      .map(() => "USD"),
  )];
  if (currencies.length === 1) return currencies[0]!;
  return "USD";
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
  ;
  const failedPaymentAmountThisWindow = sumEventAmount(failedPaymentsThisWindow);

  const refundsThisWindow = input.stripeEvents
    .filter((event) => event.eventType === "refund")
    .filter((event) => isWithinWindow(asDate(event.occurredAt), currentWindowStart, endAt));
  const refundAmountThisWindow = sumEventAmount(refundsThisWindow);

  const cancellationsThisWindow = input.stripeEvents
    .filter((event) => event.eventType === "cancellation")
    .filter((event) => isWithinWindow(asDate(event.occurredAt), currentWindowStart, endAt));
  const cancellationAmountThisWindow = sumEventAmount(cancellationsThisWindow);

  const upgradesThisWindow = input.stripeEvents
    .filter((event) => event.eventType === "upgrade")
    .filter((event) => isWithinWindow(asDate(event.occurredAt), currentWindowStart, endAt));
  const upgradeAmountThisWindow = sumEventAmount(upgradesThisWindow);

  const downgradesThisWindow = input.stripeEvents
    .filter((event) => event.eventType === "downgrade")
    .filter((event) => isWithinWindow(asDate(event.occurredAt), currentWindowStart, endAt));
  const downgradeAmountThisWindow = sumEventAmount(downgradesThisWindow);

  return {
    bookedRevenueThisWindow,
    bookedRevenuePreviousWindow,
    manualTransferRevenueThisWindow,
    failedPaymentsThisWindow: failedPaymentsThisWindow.length,
    failedPaymentAmountThisWindow,
    refundsThisWindow: refundsThisWindow.length,
    refundAmountThisWindow,
    cancellationsThisWindow: cancellationsThisWindow.length,
    cancellationAmountThisWindow,
    upgradesThisWindow: upgradesThisWindow.length,
    upgradeAmountThisWindow,
    downgradesThisWindow: downgradesThisWindow.length,
    downgradeAmountThisWindow,
  };
}

export function calculateOfficelyRevenueScorecard(
  input: Pick<OfficelyV1SyncPayload, "generatedAt" | "xeroInvoices" | "xeroCashReceipts" | "stripeEvents">,
): OfficelyRevenueScorecard {
  const endAt = asDate(input.generatedAt) ?? new Date();
  const currentMonthStart = startOfMonth(endAt);
  const scorecardMonthStart = addMonths(currentMonthStart, -1);
  const scorecardMonthEnd = currentMonthStart;
  const previousMonthStart = addMonths(scorecardMonthStart, -1);
  const historicalStart = addMonths(scorecardMonthStart, -6);

  const paidInvoices = input.xeroInvoices.filter((invoice) => isPaidInvoice(invoice.status));
  const byCustomer = new Map<string, { current: number; previous: number; historical: number }>();

  for (const invoice of paidInvoices) {
    const key = getRevenueCustomerKey(invoice);
    const bookedAt = getInvoiceBookedAt(invoice);
    if (!bookedAt || bookedAt < historicalStart || bookedAt >= scorecardMonthEnd) continue;
    const bucket = byCustomer.get(key) ?? { current: 0, previous: 0, historical: 0 };
    const monthlyAmount = getInvoiceMonthlyRecurringAmount(invoice);
    if (isWithinRange(bookedAt, scorecardMonthStart, scorecardMonthEnd)) {
      bucket.current += monthlyAmount;
    } else if (isWithinRange(bookedAt, previousMonthStart, scorecardMonthStart)) {
      bucket.previous += monthlyAmount;
    } else if (bookedAt < previousMonthStart) {
      bucket.historical += monthlyAmount;
    }
    byCustomer.set(key, bucket);
  }

  let currentMrr = 0;
  let previousMrr = 0;
  let newMrr = 0;
  let expansionMrr = 0;
  let reactivationMrr = 0;
  let contractionMrr = 0;
  let churnedMrr = 0;
  let newCustomers = 0;
  let reactivatedCustomers = 0;
  let expandedCustomers = 0;
  let contractedCustomers = 0;
  let lostCustomers = 0;
  let currentCustomers = 0;
  let previousCustomers = 0;

  for (const bucket of byCustomer.values()) {
    currentMrr += bucket.current;
    previousMrr += bucket.previous;

    if (bucket.current > 0) currentCustomers += 1;
    if (bucket.previous > 0) previousCustomers += 1;

    if (bucket.current > 0 && bucket.previous === 0) {
      if (bucket.historical > 0) {
        reactivationMrr += bucket.current;
        reactivatedCustomers += 1;
      } else {
        newMrr += bucket.current;
        newCustomers += 1;
      }
    }

    if (bucket.current > bucket.previous && bucket.previous > 0) {
      expansionMrr += bucket.current - bucket.previous;
      expandedCustomers += 1;
    }

    if (bucket.current > 0 && bucket.current < bucket.previous) {
      contractionMrr += bucket.previous - bucket.current;
      contractedCustomers += 1;
    }

    if (bucket.previous > 0 && bucket.current === 0) {
      churnedMrr += bucket.previous;
      lostCustomers += 1;
    }
  }

  const overallChange = currentMrr - previousMrr;
  const netNewMrr = newMrr + expansionMrr + reactivationMrr - contractionMrr - churnedMrr;
  const revenueGrowthRate = previousMrr > 0 ? overallChange / previousMrr * 100 : null;
  const revenueChurnRate = previousMrr > 0 ? (contractionMrr + churnedMrr) / previousMrr * 100 : null;
  const customerChurnRate = previousCustomers > 0 ? lostCustomers / previousCustomers * 100 : null;
  const arpa = currentCustomers > 0 ? currentMrr / currentCustomers : null;
  const estimatedLtv = arpa !== null && customerChurnRate !== null && customerChurnRate > 0
    ? arpa / (customerChurnRate / 100)
    : null;

  const metrics = calculateOfficelyRevenueMetrics(input);
  const cashReceipts = input.xeroCashReceipts ?? [];
  const cashReceiptsThisMonth = cashReceipts.filter((receipt) =>
    isWithinRange(asDate(receipt.receivedAt), scorecardMonthStart, scorecardMonthEnd),
  );
  const recentCashWindowStart = startOfRollingWindow(endAt, 30);
  const recentCashReceipts = cashReceipts.filter((receipt) =>
    isWithinWindow(asDate(receipt.receivedAt), recentCashWindowStart, endAt),
  );
  const invoiceCollectionsThisMonth = paidInvoices.filter((invoice) =>
    isWithinRange(getInvoiceBookedAt(invoice), scorecardMonthStart, scorecardMonthEnd),
  );
  const recentInvoiceCollections = paidInvoices.filter((invoice) =>
    isWithinWindow(getInvoiceBookedAt(invoice), recentCashWindowStart, endAt),
  );
  const monthCollections = cashReceiptsThisMonth.length > 0
    ? sumCollectionAmountsBySource(cashReceiptsThisMonth, (receipt) => receipt.source)
    : sumCollectionAmountsBySource(invoiceCollectionsThisMonth, classifyInvoiceCollectionSource);
  const recentCollections = recentCashReceipts.length > 0
    ? sumCollectionAmountsBySource(recentCashReceipts, (receipt) => receipt.source)
    : sumCollectionAmountsBySource(recentInvoiceCollections, classifyInvoiceCollectionSource);
  const collectionCurrency = cashReceiptsThisMonth.length > 0
    ? pickCollectionCurrency(cashReceiptsThisMonth, (receipt) => receipt.currency)
    : pickCollectionCurrency(invoiceCollectionsThisMonth, (invoice) => invoice.currency);
  const stripeRevenueEventsThisMonth = input.stripeEvents.filter((event) =>
    event.eventType === "payment_succeeded" && isWithinRange(asDate(event.occurredAt), scorecardMonthStart, scorecardMonthEnd),
  );
  const stripeRevenueFromStripe = stripeRevenueEventsThisMonth.reduce((sum, event) => sum + (event.amount ?? 0), 0);
  const stripeRevenue = stripeRevenueFromStripe > 0 ? stripeRevenueFromStripe : monthCollections.stripe;
  const manualRevenue = monthCollections.manual;
  const totalRevenue = stripeRevenue + manualRevenue;
  const liveRevenueCurrency = stripeRevenueEventsThisMonth.length > 0
    ? pickEventCurrency(stripeRevenueEventsThisMonth)
    : collectionCurrency;
  const recentCollectionCurrency = recentCashReceipts.length > 0
    ? pickCollectionCurrency(recentCashReceipts, (receipt) => receipt.currency)
    : pickCollectionCurrency(recentInvoiceCollections, (invoice) => invoice.currency);
  const collectedRevenue = monthCollections.total;
  const collectedViaStripe = monthCollections.stripe;
  const collectedManually = monthCollections.manual;
  const collectedOther = monthCollections.other;
  const recentCollectedRevenue = recentCollections.total;
  const recentCollectedViaStripe = recentCollections.stripe;
  const recentCollectedManually = recentCollections.manual;

  return {
    currency: pickScorecardCurrency(paidInvoices),
    periodStart: scorecardMonthStart.toISOString(),
    periodEnd: endOfPreviousMonth(scorecardMonthEnd).toISOString(),
    currentMrr,
    previousMrr,
    newMrr,
    expansionMrr,
    reactivationMrr,
    contractionMrr,
    churnedMrr,
    netNewMrr,
    overallChange,
    newCustomers,
    reactivatedCustomers,
    expandedCustomers,
    contractedCustomers,
    lostCustomers,
    currentCustomers,
    previousCustomers,
    revenueGrowthRate,
    revenueChurnRate,
    customerChurnRate,
    estimatedLtv,
    netPosition: netNewMrr > 0 ? "positive" : netNewMrr < 0 ? "negative" : "flat",
    liveRevenueCurrency,
    stripeRevenue,
    manualRevenue,
    totalRevenue,
    collectionCurrency,
    collectionPeriodStart: scorecardMonthStart.toISOString(),
    collectionPeriodEnd: endOfPreviousMonth(scorecardMonthEnd).toISOString(),
    collectedRevenue,
    collectedViaStripe,
    collectedManually,
    collectedOther,
    recentCollectionCurrency,
    recentCollectionPeriodStart: recentCashWindowStart.toISOString(),
    recentCollectionPeriodEnd: endAt.toISOString(),
    recentCollectedRevenue,
    recentCollectedViaStripe,
    recentCollectedManually,
    failedPayments: metrics.failedPaymentsThisWindow,
    failedPaymentAmount: metrics.failedPaymentAmountThisWindow,
    refunds: metrics.refundsThisWindow,
    refundAmount: metrics.refundAmountThisWindow,
  };
}

function clampHighlights(
  highlights: OfficelySlackFeedbackPulse["highlights"],
  limit = 3,
): OfficelySlackFeedbackPulse["highlights"] {
  return highlights.slice(0, limit).map((highlight) => ({
    ...highlight,
    text: highlight.text.length > 180 ? `${highlight.text.slice(0, 177)}...` : highlight.text,
  }));
}

function buildProductPulse(input: {
  posthogProject: OfficelyPostHogProjectPulse | null | undefined;
}): VirtualOrgFounderBrief["productPulse"] {
  const preview = input.posthogProject;
  if (!preview) {
    return {
      status: "unavailable",
      checkedAt: null,
      eventCount: 0,
      activeUserTotal: 0,
      onboardingEvent: null,
      onboardingEventCount: 0,
      importantEventCounts: [],
      summary: "Product usage preview is not available on this sync.",
    };
  }

  const importantEventTotal = preview.importantEventCounts.reduce((sum, event) => sum + event.count, 0);
  const hasImportantEvents = preview.importantEventCounts.length > 0;
  const status =
    preview.activeUserTotal === 0 || preview.eventCount === 0
      ? "risk"
      : hasImportantEvents && importantEventTotal === 0
        ? "risk"
        : preview.onboardingEvent && preview.onboardingEventCount === 0
          ? "watch"
          : hasImportantEvents && importantEventTotal < preview.activeUserTotal
            ? "watch"
            : "healthy";

  let summary = `PostHog saw ${preview.activeUserTotal} active user${preview.activeUserTotal === 1 ? "" : "s"} and ${preview.eventCount} tracked event${preview.eventCount === 1 ? "" : "s"} in the current window.`;
  if (status === "risk" && preview.activeUserTotal === 0) {
    summary = "PostHog did not show any active users in the current window. Treat this as a product health risk until you confirm the tracking is healthy.";
  } else if (status === "risk" && hasImportantEvents && importantEventTotal === 0) {
    summary = "People are showing up in PostHog, but none of the important product events fired. That usually means usage is shallow or tracking needs attention.";
  } else if (status === "watch" && preview.onboardingEvent && preview.onboardingEventCount === 0) {
    summary = `People are active, but ${preview.onboardingEvent} did not fire in the current window. Onboarding may be stalling before users reach value.`;
  } else if (status === "watch" && hasImportantEvents) {
    summary = `Important product actions fired ${importantEventTotal} time${importantEventTotal === 1 ? "" : "s"} across ${preview.activeUserTotal} active user${preview.activeUserTotal === 1 ? "" : "s"}. Usage is real, but not deep yet.`;
  }

  return {
    status,
    checkedAt: preview.checkedAt,
    eventCount: preview.eventCount,
    activeUserTotal: preview.activeUserTotal,
    onboardingEvent: preview.onboardingEvent,
    onboardingEventCount: preview.onboardingEventCount,
    importantEventCounts: preview.importantEventCounts,
    summary,
  };
}

function buildFeedbackPulse(input: {
  slackFeedback: OfficelySlackFeedbackPulse | null | undefined;
  unavailableReason?: string | null;
}): VirtualOrgFounderBrief["feedbackPulse"] {
  const preview = input.slackFeedback;
  if (!preview) {
    return {
      status: "unavailable",
      checkedAt: null,
      channelId: null,
      channelsReviewed: 0,
      channelsWithMessages: 0,
      messageCount: 0,
      customerMessageCount: 0,
      customerFeedbackMessages: 0,
      techIssueMessages: 0,
      bugMentions: 0,
      featureRequestMentions: 0,
      churnRiskMentions: 0,
      praiseMentions: 0,
      supportMentions: 0,
      summary: input.unavailableReason?.trim() || "Customer feedback pulse is not available on this sync.",
      highlights: [],
    };
  }

  const status =
    preview.churnRiskMentions > 0 || preview.bugMentions >= 3
      ? "risk"
      : preview.featureRequestMentions > 0 || preview.supportMentions > 0
        ? "watch"
        : preview.customerMessageCount > 0 && preview.praiseMentions > 0
          ? "healthy"
          : preview.customerMessageCount > 0
            ? "watch"
            : "unavailable";

  const bucketSummaryParts: string[] = [];
  if (preview.customerFeedbackMessages > 0) {
    bucketSummaryParts.push(`${preview.customerFeedbackMessages} in customer feedback`);
  }
  if (preview.techIssueMessages > 0) {
    bucketSummaryParts.push(`${preview.techIssueMessages} in tech issues`);
  }

  let summary = `Slack reviewed ${preview.channelsReviewed} channel${preview.channelsReviewed === 1 ? "" : "s"} and found ${preview.customerMessageCount} recent customer message${preview.customerMessageCount === 1 ? "" : "s"}.`;
  if (status === "risk" && preview.churnRiskMentions > 0) {
    summary = `Slack picked up ${preview.churnRiskMentions} churn-risk mention${preview.churnRiskMentions === 1 ? "" : "s"} in recent customer feedback.`;
  } else if (status === "risk" && preview.bugMentions >= 3) {
    summary = `Slack picked up ${preview.bugMentions} bug-related mention${preview.bugMentions === 1 ? "" : "s"} in recent customer feedback.`;
  } else if (status === "watch" && preview.featureRequestMentions > 0) {
    summary = `Slack picked up ${preview.featureRequestMentions} feature-request mention${preview.featureRequestMentions === 1 ? "" : "s"} in recent customer feedback.`;
  } else if (status === "healthy" && preview.praiseMentions > 0) {
    summary = `Slack picked up ${preview.praiseMentions} positive customer message${preview.praiseMentions === 1 ? "" : "s"} in the recent feedback window.`;
  } else if (status === "unavailable") {
    summary = "No recent customer feedback messages were available from Slack on this sync.";
  }
  if (bucketSummaryParts.length > 0) {
    summary = `${summary} ${bucketSummaryParts.join(" and ")}.`;
  }

  return {
    status,
    checkedAt: preview.checkedAt,
    channelId: preview.channelId,
    channelsReviewed: preview.channelsReviewed,
    channelsWithMessages: preview.channelsWithMessages,
    messageCount: preview.messageCount,
    customerMessageCount: preview.customerMessageCount,
    customerFeedbackMessages: preview.customerFeedbackMessages,
    techIssueMessages: preview.techIssueMessages,
    bugMentions: preview.bugMentions,
    featureRequestMentions: preview.featureRequestMentions,
    churnRiskMentions: preview.churnRiskMentions,
    praiseMentions: preview.praiseMentions,
    supportMentions: preview.supportMentions,
    summary,
    highlights: clampHighlights(preview.highlights),
  };
}

function buildFounderHeadline(input: {
  revenueScorecard: OfficelyRevenueScorecard;
  productPulse: VirtualOrgFounderBrief["productPulse"];
  feedbackPulse: VirtualOrgFounderBrief["feedbackPulse"];
}) {
  const { revenueScorecard, productPulse, feedbackPulse } = input;
  if (feedbackPulse.status === "risk") {
    return "Customer pain needs attention now.";
  }
  if (revenueScorecard.failedPayments > 0) {
    return "Revenue is moving, but failed payments need recovery.";
  }
  if (productPulse.status === "risk") {
    return "Revenue looks active, but product health needs attention.";
  }
  if (revenueScorecard.totalRevenue > 0) {
    return "Revenue, product usage, and customer signals are all visible.";
  }
  return "The founder brief is ready, but the signal set is still thin.";
}

export function generateOfficelyFounderBrief(input: {
  generatedAt?: Date | string | null;
  revenueScorecard: OfficelyRevenueScorecard;
  posthogProject?: OfficelyPostHogProjectPulse | null;
  slackFeedback?: OfficelySlackFeedbackPulse | null;
  slackFeedbackUnavailableReason?: string | null;
}): VirtualOrgFounderBrief {
  const generatedAt = asDate(input.generatedAt)?.toISOString() ?? new Date().toISOString();
  const productPulse = buildProductPulse({ posthogProject: input.posthogProject });
  const feedbackPulse = buildFeedbackPulse({
    slackFeedback: input.slackFeedback,
    unavailableReason: input.slackFeedbackUnavailableReason,
  });
  const actionItems: VirtualOrgFounderBrief["actionItems"] = [];

  if (input.revenueScorecard.failedPayments > 0) {
    actionItems.push({
      id: "revenue_failed_payments",
      title: "Recover failed payments",
      summary: `${input.revenueScorecard.failedPayments} payment${input.revenueScorecard.failedPayments === 1 ? "" : "s"} failed recently, putting ${input.revenueScorecard.failedPaymentAmount.toFixed(2)} at risk.`,
      recommendedAction: "Work the failed-payment accounts first. This is the fastest revenue recovery lever.",
      priority: "high",
      source: "revenue",
    });
  }

  if (feedbackPulse.churnRiskMentions > 0) {
    actionItems.push({
      id: "feedback_churn_risk",
      title: "Review churn-risk customer feedback",
      summary: `Slack picked up ${feedbackPulse.churnRiskMentions} recent message${feedbackPulse.churnRiskMentions === 1 ? "" : "s"} that look like churn or cancellation risk.`,
      recommendedAction: "Read the highlighted messages and reply to the highest-risk customers this week.",
      priority: "high",
      source: "feedback",
    });
  }

  if (productPulse.status === "risk" || productPulse.status === "watch") {
    actionItems.push({
      id: "product_usage_watch",
      title: productPulse.status === "risk" ? "Product usage needs attention" : "Product usage depth is still shallow",
      summary: productPulse.summary,
      recommendedAction: productPulse.onboardingEvent && productPulse.onboardingEventCount === 0
        ? `Check why ${productPulse.onboardingEvent} is not firing. People may be stalling before they get value.`
        : "Compare active users to the important event counts. The next product focus should be the behavior healthy accounts repeat.",
      priority: productPulse.status === "risk" ? "high" : "medium",
      source: "product",
    });
  }

  if (feedbackPulse.bugMentions > 0) {
    actionItems.push({
      id: "feedback_bug_mentions",
      title: feedbackPulse.techIssueMessages > 0 ? "Review tech issues and bug-heavy feedback" : "Review bug-heavy customer feedback",
      summary: feedbackPulse.techIssueMessages > 0
        ? `Slack picked up ${feedbackPulse.bugMentions} recent bug-related message${feedbackPulse.bugMentions === 1 ? "" : "s"}, including ${feedbackPulse.techIssueMessages} message${feedbackPulse.techIssueMessages === 1 ? "" : "s"} in tech issues channels.`
        : `Slack picked up ${feedbackPulse.bugMentions} recent bug-related message${feedbackPulse.bugMentions === 1 ? "" : "s"}.`,
      recommendedAction: "Group the bug complaints by theme and confirm whether one product issue is behind most of them.",
      priority: feedbackPulse.bugMentions >= 3 ? "high" : "medium",
      source: "feedback",
    });
  }

  if (feedbackPulse.featureRequestMentions > 0) {
    actionItems.push({
      id: "feedback_feature_requests",
      title: "Review repeated feature requests",
      summary: `Slack picked up ${feedbackPulse.featureRequestMentions} recent feature-request message${feedbackPulse.featureRequestMentions === 1 ? "" : "s"}.`,
      recommendedAction: "Look for repeated asks before you commit to building anything new.",
      priority: "medium",
      source: "feedback",
    });
  }

  const headline = buildFounderHeadline({
    revenueScorecard: input.revenueScorecard,
    productPulse,
    feedbackPulse,
  });

  const summaryParts = [
    `Total revenue for the current month view is ${input.revenueScorecard.totalRevenue.toFixed(2)}.`,
    productPulse.summary,
    feedbackPulse.summary,
  ];

  return {
    generatedAt,
    headline,
    summary: summaryParts.join(" "),
    productPulse,
    feedbackPulse,
    actionItems: actionItems.slice(0, 5),
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
    const percentChange = metrics.bookedRevenuePreviousWindow > 0
      ? Math.abs(delta) / metrics.bookedRevenuePreviousWindow * 100
      : null;
    insights.push({
      type: "officely_v1_booked_revenue",
      title: "Booked revenue moved this week",
      summary: percentChange === null
        ? `Xero shows ${metrics.bookedRevenueThisWindow.toFixed(2)} booked this week, ${direction} ${Math.abs(delta).toFixed(2)} versus the prior 7 days.`
        : `Xero shows ${metrics.bookedRevenueThisWindow.toFixed(2)} booked this week, ${direction} ${Math.abs(delta).toFixed(2)} (${percentChange.toFixed(0)}%) versus the prior 7 days.`,
      confidence: 0.92,
      sourceKinds: ["xero"],
      recommendedAction: delta >= 0
        ? "Check which invoices or customer segments drove the lift before assuming it will repeat next week."
        : "Review the biggest missing or delayed invoices first so you can tell whether this is timing noise or a real slowdown.",
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

  if (metrics.failedPaymentsThisWindow > 0) {
    insights.push({
      type: "officely_v1_billing_events",
      title: "Revenue collection risk showed up this week",
      summary: `Stripe recorded ${metrics.failedPaymentsThisWindow} failed payment${metrics.failedPaymentsThisWindow === 1 ? "" : "s"} in the last 7 days, representing ${metrics.failedPaymentAmountThisWindow.toFixed(2)} of revenue at risk.`,
      confidence: 0.91,
      sourceKinds: ["stripe"],
      recommendedAction: "Work the failed payments list first. Recovering an existing invoice is usually faster than finding new revenue.",
    });
  }

  if (metrics.refundsThisWindow > 0 || metrics.cancellationsThisWindow > 0 || metrics.downgradesThisWindow > 0) {
    insights.push({
      type: "officely_v1_revenue_pressure",
      title: "Revenue pressure showed up in billing changes",
      summary: `Stripe recorded ${metrics.refundsThisWindow} refund${metrics.refundsThisWindow === 1 ? "" : "s"}, ${metrics.cancellationsThisWindow} cancellation${metrics.cancellationsThisWindow === 1 ? "" : "s"}, and ${metrics.downgradesThisWindow} downgrade${metrics.downgradesThisWindow === 1 ? "" : "s"} in the last 7 days, representing ${(
        metrics.refundAmountThisWindow + metrics.cancellationAmountThisWindow + metrics.downgradeAmountThisWindow
      ).toFixed(2)} of contraction pressure.`,
      confidence: 0.9,
      sourceKinds: ["stripe"],
      recommendedAction: "Review the accounts behind refunds, cancellations, and downgrades together. This is your clearest short-list for churn follow-up.",
    });
  }

  if (metrics.upgradesThisWindow > 0) {
    insights.push({
      type: "officely_v1_expansion_revenue",
      title: "Expansion revenue appeared in Stripe",
      summary: `Stripe recorded ${metrics.upgradesThisWindow} upgrade${metrics.upgradesThisWindow === 1 ? "" : "s"} in the last 7 days, representing ${metrics.upgradeAmountThisWindow.toFixed(2)} of expansion momentum.`,
      confidence: 0.87,
      sourceKinds: ["stripe"],
      recommendedAction: "Look for the shared traits across upgraded accounts so you can turn that path into a repeatable playbook.",
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
