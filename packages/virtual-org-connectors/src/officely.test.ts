import { describe, expect, it } from "vitest";
import {
  buildOfficelyCustomerProfiles,
  calculateOfficelyRevenueMetrics,
  generateOfficelyInsightDrafts,
  type OfficelyV1SyncPayload,
} from "./officely.js";

describe("buildOfficelyCustomerProfiles", () => {
  it("matches the same customer across internal, Xero, Stripe, and PostHog records", () => {
    const profiles = buildOfficelyCustomerProfiles({
      payload: {
        internalAccounts: [
          {
            internalAccountId: "acct_1",
            companyName: "Acme Ltd",
            accountName: "Acme",
            workspaceId: "ws_1",
            primaryEmailDomain: "acme.com",
            planName: "Scale",
            accountStatus: "active",
            stripeCustomerId: "cus_1",
            xeroContactId: "xero_1",
            posthogGroupKey: "grp_1",
            firstSeenAt: "2026-03-01T00:00:00.000Z",
          },
        ],
        xeroInvoices: [
          {
            invoiceId: "inv_1",
            contactId: "xero_1",
            amount: 1200,
            currency: "USD",
            status: "paid",
            paidDate: "2026-04-01T00:00:00.000Z",
          },
        ],
        stripeEvents: [
          {
            eventId: "evt_1",
            customerId: "cus_1",
            eventType: "upgrade",
            occurredAt: "2026-04-01T00:00:00.000Z",
          },
        ],
        posthogAccounts: [
          {
            groupKey: "grp_1",
            activeUsers: 7,
            keyFeatureCount: 14,
            onboardingCompletedAt: "2026-03-02T00:00:00.000Z",
          },
        ],
      },
    });

    expect(profiles).toHaveLength(1);
    expect(profiles[0]).toMatchObject({
      internalAccountId: "acct_1",
      workspaceId: "ws_1",
      stripeCustomerId: "cus_1",
      xeroContactId: "xero_1",
      posthogGroupKey: "grp_1",
      companyName: "Acme Ltd",
      planName: "Scale",
    });
  });

  it("refuses ambiguous domain-only matches and keeps customers separate", () => {
    const profiles = buildOfficelyCustomerProfiles({
      existingProfiles: [
        {
          id: "profile_a",
          companyName: "Alpha",
          primaryEmailDomain: "shared.com",
        },
        {
          id: "profile_b",
          companyName: "Beta",
          primaryEmailDomain: "shared.com",
        },
      ],
      payload: {
        internalAccounts: [],
        xeroInvoices: [
          {
            invoiceId: "inv_1",
            contactId: "xero_1",
            primaryEmailDomain: "shared.com",
            companyName: "Shared Name",
            amount: 500,
            currency: "USD",
            status: "paid",
            paidDate: "2026-04-01T00:00:00.000Z",
          },
        ],
        stripeEvents: [],
        posthogAccounts: [],
      },
    });

    expect(profiles).toHaveLength(3);
    expect(profiles.find((profile) => profile.xeroContactId === "xero_1")?.companyName).toBe("Shared Name");
  });

  it("normalizes blank external ids to null before storage-facing output", () => {
    const profiles = buildOfficelyCustomerProfiles({
      payload: {
        internalAccounts: [
          {
            internalAccountId: "acct_1",
            companyName: "Acme Ltd",
            workspaceId: "   ",
            primaryEmailDomain: "ACME.COM",
            stripeCustomerId: "",
            xeroContactId: "  ",
            posthogGroupKey: "grp_1",
          },
        ],
        xeroInvoices: [],
        stripeEvents: [],
        posthogAccounts: [],
      },
    });

    expect(profiles[0]).toMatchObject({
      workspaceId: null,
      primaryEmailDomain: "acme.com",
      stripeCustomerId: null,
      xeroContactId: null,
    });
  });
});

describe("calculateOfficelyRevenueMetrics", () => {
  it("uses Xero for booked revenue and Stripe only for automated billing events", () => {
    const metrics = calculateOfficelyRevenueMetrics({
      generatedAt: "2026-04-02T00:00:00.000Z",
      xeroInvoices: [
        {
          invoiceId: "inv_1",
          contactId: "xero_1",
          amount: 1500,
          currency: "USD",
          status: "paid",
          paidDate: "2026-04-01T00:00:00.000Z",
          paymentMethod: "manual bank transfer",
        },
      ],
      stripeEvents: [
        {
          eventId: "evt_1",
          customerId: "cus_1",
          eventType: "payment_succeeded",
          occurredAt: "2026-04-01T00:00:00.000Z",
          amount: 1500,
        },
        {
          eventId: "evt_2",
          customerId: "cus_1",
          eventType: "payment_failed",
          occurredAt: "2026-04-01T06:00:00.000Z",
        },
      ],
    });

    expect(metrics.bookedRevenueThisWindow).toBe(1500);
    expect(metrics.manualTransferRevenueThisWindow).toBe(1500);
    expect(metrics.failedPaymentsThisWindow).toBe(1);
  });
});

describe("generateOfficelyInsightDrafts", () => {
  it("builds insight cards for revenue, billing events, and usage risk", () => {
    const payload: OfficelyV1SyncPayload = {
      generatedAt: "2026-04-02T00:00:00.000Z",
      internalAccounts: [
        {
          internalAccountId: "acct_1",
          companyName: "Acme Ltd",
          primaryEmailDomain: "acme.com",
          posthogGroupKey: "grp_1",
        },
      ],
      xeroInvoices: [
        {
          invoiceId: "inv_1",
          contactId: "xero_1",
          companyName: "Acme Ltd",
          amount: 900,
          currency: "USD",
          status: "paid",
          paidDate: "2026-04-01T00:00:00.000Z",
        },
      ],
      stripeEvents: [
        {
          eventId: "evt_1",
          customerId: "cus_1",
          companyName: "Acme Ltd",
          eventType: "payment_failed",
          occurredAt: "2026-04-01T00:00:00.000Z",
        },
      ],
      posthogAccounts: [
        {
          groupKey: "grp_1",
          companyName: "Acme Ltd",
          activeUsers: 0,
          onboardingCompletedAt: "2026-03-15T00:00:00.000Z",
        },
      ],
    };

    const customerProfiles = buildOfficelyCustomerProfiles({ payload });
    const insights = generateOfficelyInsightDrafts({ payload, customerProfiles });

    expect(insights.map((insight) => insight.type)).toEqual(expect.arrayContaining([
      "officely_v1_booked_revenue",
      "officely_v1_billing_events",
      "officely_v1_usage_risk",
    ]));
  });
});
