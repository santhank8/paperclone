import { describe, expect, it } from "vitest";
import {
  buildOfficelyCustomerProfiles,
  generateOfficelyFounderBrief,
  calculateOfficelyRevenueMetrics,
  calculateOfficelyRevenueScorecard,
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
        xeroCashReceipts: [],
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
        xeroCashReceipts: [],
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
        xeroCashReceipts: [],
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
          amount: 1500,
        },
        {
          eventId: "evt_3",
          customerId: "cus_1",
          eventType: "refund",
          occurredAt: "2026-04-01T08:00:00.000Z",
          amount: 200,
        },
        {
          eventId: "evt_4",
          customerId: "cus_1",
          eventType: "upgrade",
          occurredAt: "2026-04-01T10:00:00.000Z",
          amount: 300,
        },
        {
          eventId: "evt_5",
          customerId: "cus_1",
          eventType: "cancellation",
          occurredAt: "2026-04-01T12:00:00.000Z",
          amount: 400,
        },
      ],
    });

    expect(metrics.bookedRevenueThisWindow).toBe(1500);
    expect(metrics.manualTransferRevenueThisWindow).toBe(1500);
    expect(metrics.failedPaymentsThisWindow).toBe(1);
    expect(metrics.failedPaymentAmountThisWindow).toBe(1500);
    expect(metrics.refundsThisWindow).toBe(1);
    expect(metrics.refundAmountThisWindow).toBe(200);
    expect(metrics.upgradesThisWindow).toBe(1);
    expect(metrics.upgradeAmountThisWindow).toBe(300);
    expect(metrics.cancellationsThisWindow).toBe(1);
    expect(metrics.cancellationAmountThisWindow).toBe(400);
  });
});

describe("calculateOfficelyRevenueScorecard", () => {
  it("builds the monthly revenue bridge from Xero invoice history and Stripe billing pressure", () => {
    const scorecard = calculateOfficelyRevenueScorecard({
      generatedAt: "2026-04-20T00:00:00.000Z",
      xeroInvoices: [
        {
          invoiceId: "inv_prev_expand",
          contactId: "contact_expand",
          companyName: "Expand Co",
          amount: 100,
          currency: "USD",
          status: "paid",
          paidDate: "2026-02-10T00:00:00.000Z",
        },
        {
          invoiceId: "inv_curr_expand",
          contactId: "contact_expand",
          companyName: "Expand Co",
          amount: 160,
          currency: "USD",
          status: "paid",
          paidDate: "2026-03-10T00:00:00.000Z",
        },
        {
          invoiceId: "inv_prev_contract",
          contactId: "contact_contract",
          companyName: "Contract Co",
          amount: 90,
          currency: "USD",
          status: "paid",
          paidDate: "2026-02-11T00:00:00.000Z",
        },
        {
          invoiceId: "inv_curr_contract",
          contactId: "contact_contract",
          companyName: "Contract Co",
          amount: 40,
          currency: "USD",
          status: "paid",
          paidDate: "2026-03-11T00:00:00.000Z",
        },
        {
          invoiceId: "inv_prev_churn",
          contactId: "contact_churn",
          companyName: "Churn Co",
          amount: 80,
          currency: "USD",
          status: "paid",
          paidDate: "2026-02-12T00:00:00.000Z",
        },
        {
          invoiceId: "inv_curr_new",
          contactId: "contact_new",
          companyName: "New Co",
          amount: 70,
          currency: "USD",
          status: "paid",
          paidDate: "2026-03-12T00:00:00.000Z",
        },
        {
          invoiceId: "inv_old_reactivate",
          contactId: "contact_reactivate",
          companyName: "Back Again Co",
          amount: 60,
          currency: "USD",
          status: "paid",
          paidDate: "2026-01-12T00:00:00.000Z",
        },
        {
          invoiceId: "inv_curr_reactivate",
          contactId: "contact_reactivate",
          companyName: "Back Again Co",
          amount: 90,
          currency: "USD",
          status: "paid",
          paidDate: "2026-03-12T00:00:00.000Z",
        },
      ],
      xeroCashReceipts: [
        {
          transactionId: "cash_stripe_1",
          companyName: "Expand Co",
          receivedAt: "2026-03-14T00:00:00.000Z",
          amount: 160,
          currency: "USD",
          bankAccountName: "Stripe USD",
          source: "stripe",
        },
        {
          transactionId: "cash_manual_1",
          companyName: "Manual Co",
          receivedAt: "2026-03-15T00:00:00.000Z",
          amount: 25,
          currency: "USD",
          bankAccountName: "Operating Bank",
          source: "manual",
        },
      ],
      stripeEvents: [
        {
          eventId: "evt_paid",
          customerId: "cus_paid",
          eventType: "payment_succeeded",
          occurredAt: "2026-03-20T00:00:00.000Z",
          amount: 310,
        },
        {
          eventId: "evt_fail",
          customerId: "cus_1",
          eventType: "payment_failed",
          occurredAt: "2026-04-15T00:00:00.000Z",
          amount: 45,
        },
        {
          eventId: "evt_refund",
          customerId: "cus_2",
          eventType: "refund",
          occurredAt: "2026-04-16T00:00:00.000Z",
          amount: 20,
        },
      ],
    });

    expect(scorecard).toMatchObject({
      currency: "USD",
      periodStart: "2026-03-01T00:00:00.000Z",
      currentMrr: 360,
      previousMrr: 270,
      newMrr: 70,
      expansionMrr: 60,
      reactivationMrr: 90,
      contractionMrr: 50,
      churnedMrr: 80,
      netNewMrr: 90,
      overallChange: 90,
      newCustomers: 1,
      reactivatedCustomers: 1,
      expandedCustomers: 1,
      contractedCustomers: 1,
      lostCustomers: 1,
      currentCustomers: 4,
      previousCustomers: 3,
      liveRevenueCurrency: "USD",
      stripeRevenue: 310,
      manualRevenue: 25,
      totalRevenue: 335,
      collectionCurrency: "USD",
      collectionPeriodStart: "2026-03-01T00:00:00.000Z",
      collectionPeriodEnd: "2026-03-31T23:59:59.999Z",
      collectedRevenue: 185,
      collectedViaStripe: 160,
      collectedManually: 25,
      collectedOther: 0,
      recentCollectionCurrency: "USD",
      recentCollectionPeriodStart: "2026-03-21T00:00:00.000Z",
      recentCollectionPeriodEnd: "2026-04-20T00:00:00.000Z",
      recentCollectedRevenue: 0,
      recentCollectedViaStripe: 0,
      recentCollectedManually: 0,
      failedPayments: 1,
      failedPaymentAmount: 45,
      refunds: 1,
      refundAmount: 20,
      netPosition: "positive",
    });
    expect(scorecard.revenueGrowthRate).toBeCloseTo(33.333, 2);
    expect(scorecard.revenueChurnRate).toBeCloseTo(48.148, 2);
    expect(scorecard.customerChurnRate).toBeCloseTo(33.333, 2);
    expect(scorecard.estimatedLtv).toBeCloseTo(270, 2);
  });

  it("divides annual Xero invoices by 12 before counting them as MRR", () => {
    const scorecard = calculateOfficelyRevenueScorecard({
      generatedAt: "2026-04-20T00:00:00.000Z",
      xeroInvoices: [
        {
          invoiceId: "inv_annual_prev",
          contactId: "contact_annual",
          companyName: "Annual Co",
          amount: 1200,
          currency: "USD",
          status: "paid",
          paidDate: "2026-02-10T00:00:00.000Z",
          billingPeriodMonths: 12,
          monthlyRecurringAmount: 100,
        },
        {
          invoiceId: "inv_annual_curr",
          contactId: "contact_annual",
          companyName: "Annual Co",
          amount: 1200,
          currency: "USD",
          status: "paid",
          paidDate: "2026-03-10T00:00:00.000Z",
          billingPeriodMonths: 12,
          monthlyRecurringAmount: 100,
        },
      ],
      xeroCashReceipts: [],
      stripeEvents: [],
    });

    expect(scorecard.currentMrr).toBe(100);
    expect(scorecard.previousMrr).toBe(100);
    expect(scorecard.overallChange).toBe(0);
  });

  it("falls back to paid Xero invoice payments when recent bank-feed cash receipts are missing", () => {
    const scorecard = calculateOfficelyRevenueScorecard({
      generatedAt: "2026-05-01T00:00:00.000Z",
      xeroInvoices: [
        {
          invoiceId: "inv_recent_stripe",
          contactId: "contact_recent_stripe",
          companyName: "Recent Stripe Co",
          amount: 220,
          currency: "USD",
          status: "paid",
          paidDate: "2026-04-01T00:00:00.000Z",
          paymentMethod: "Stripe Sales / stripe payout",
        },
        {
          invoiceId: "inv_recent_manual",
          contactId: "contact_recent_manual",
          companyName: "Recent Manual Co",
          amount: 80,
          currency: "USD",
          status: "paid",
          paidDate: "2026-04-02T00:00:00.000Z",
          paymentMethod: "Operating Bank / manual bank transfer",
        },
      ],
      xeroCashReceipts: [],
      stripeEvents: [],
    });

    expect(scorecard.recentCollectedRevenue).toBe(300);
    expect(scorecard.recentCollectedViaStripe).toBe(220);
    expect(scorecard.recentCollectedManually).toBe(80);
    expect(scorecard.stripeRevenue).toBe(220);
    expect(scorecard.manualRevenue).toBe(80);
    expect(scorecard.totalRevenue).toBe(300);
    expect(scorecard.collectionCurrency).toBe("USD");
    expect(scorecard.collectionPeriodStart).toBe("2026-04-01T00:00:00.000Z");
    expect(scorecard.collectionPeriodEnd).toBe("2026-04-30T23:59:59.999Z");
    expect(scorecard.recentCollectionCurrency).toBe("USD");
    expect(scorecard.recentCollectionPeriodStart).toBe("2026-04-01T00:00:00.000Z");
    expect(scorecard.recentCollectionPeriodEnd).toBe("2026-05-01T00:00:00.000Z");
  });
});

describe("generateOfficelyFounderBrief", () => {
  it("builds a founder action list from revenue, product usage, and customer feedback", () => {
    const revenueScorecard = calculateOfficelyRevenueScorecard({
      generatedAt: "2026-04-20T00:00:00.000Z",
      xeroInvoices: [
        {
          invoiceId: "inv_prev",
          contactId: "contact_prev",
          companyName: "Prev Co",
          amount: 200,
          currency: "USD",
          status: "paid",
          paidDate: "2026-02-10T00:00:00.000Z",
          paymentMethod: "manual bank transfer",
        },
        {
          invoiceId: "inv_curr",
          contactId: "contact_curr",
          companyName: "Curr Co",
          amount: 260,
          currency: "USD",
          status: "paid",
          paidDate: "2026-03-10T00:00:00.000Z",
          paymentMethod: "manual bank transfer",
        },
      ],
      xeroCashReceipts: [],
      stripeEvents: [
        {
          eventId: "evt_paid",
          customerId: "cus_paid",
          eventType: "payment_succeeded",
          occurredAt: "2026-03-20T00:00:00.000Z",
          amount: 300,
        },
        {
          eventId: "evt_fail",
          customerId: "cus_failed",
          eventType: "payment_failed",
          occurredAt: "2026-04-15T00:00:00.000Z",
          amount: 120,
        },
      ],
    });

    const founderBrief = generateOfficelyFounderBrief({
      generatedAt: "2026-04-20T00:00:00.000Z",
      revenueScorecard,
      posthogProject: {
        checkedAt: "2026-04-20T00:00:00.000Z",
        eventCount: 120,
        activeUserTotal: 25,
        onboardingEvent: "onboarding_completed",
        onboardingEventCount: 0,
        importantEventCounts: [
          { eventName: "workflow_completed", count: 8 },
          { eventName: "room_booked", count: 5 },
        ],
      },
      slackFeedback: {
        checkedAt: "2026-04-20T00:00:00.000Z",
        channelId: "C123",
        channelsReviewed: 4,
        channelsWithMessages: 2,
        messageCount: 20,
        customerMessageCount: 12,
        customerFeedbackMessages: 7,
        techIssueMessages: 5,
        bugMentions: 3,
        featureRequestMentions: 2,
        churnRiskMentions: 1,
        praiseMentions: 1,
        supportMentions: 2,
        highlights: [
          {
            postedAt: "2026-04-19T00:00:00.000Z",
            channelName: "customer-feedback",
            channelBucket: "customer_feedback",
            authorLabel: "U123",
            text: "We might cancel if this booking bug keeps happening.",
            categories: ["bug", "churn_risk"],
          },
        ],
      },
    });

    expect(founderBrief.headline).toBe("Customer pain needs attention now.");
    expect(founderBrief.productPulse.status).toBe("watch");
    expect(founderBrief.feedbackPulse.status).toBe("risk");
    expect(founderBrief.feedbackPulse.customerFeedbackMessages).toBe(7);
    expect(founderBrief.feedbackPulse.techIssueMessages).toBe(5);
    expect(founderBrief.actionItems.map((item) => item.id)).toEqual([
      "revenue_failed_payments",
      "feedback_churn_risk",
      "product_usage_watch",
      "feedback_bug_mentions",
      "feedback_feature_requests",
    ]);
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
      xeroCashReceipts: [],
      stripeEvents: [
        {
          eventId: "evt_1",
          customerId: "cus_1",
          companyName: "Acme Ltd",
          eventType: "payment_failed",
          occurredAt: "2026-04-01T00:00:00.000Z",
          amount: 900,
        },
        {
          eventId: "evt_2",
          customerId: "cus_1",
          companyName: "Acme Ltd",
          eventType: "refund",
          occurredAt: "2026-04-01T02:00:00.000Z",
          amount: 200,
        },
        {
          eventId: "evt_3",
          customerId: "cus_1",
          companyName: "Acme Ltd",
          eventType: "upgrade",
          occurredAt: "2026-04-01T04:00:00.000Z",
          amount: 300,
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
      "officely_v1_revenue_pressure",
      "officely_v1_expansion_revenue",
      "officely_v1_usage_risk",
    ]));
  });
});
