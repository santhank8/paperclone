import { pgTable, uuid, text, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

// Customer identity is the stable join layer for Officely-style connector data.
export const customerProfiles = pgTable(
  "customer_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    companyName: text("company_name").notNull(),
    accountName: text("account_name"),
    workspaceId: text("workspace_id"),
    primaryEmailDomain: text("primary_email_domain"),
    planName: text("plan_name"),
    accountStatus: text("account_status"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }),
    ownerUserId: text("owner_user_id"),
    hubspotCompanyId: text("hubspot_company_id"),
    hubspotDealIds: jsonb("hubspot_deal_ids").$type<string[]>().notNull().default([]),
    stripeCustomerId: text("stripe_customer_id"),
    xeroContactId: text("xero_contact_id"),
    intercomCompanyId: text("intercom_company_id"),
    posthogGroupKey: text("posthog_group_key"),
    internalAccountId: text("internal_account_id"),
    attributesJson: jsonb("attributes_json").$type<Record<string, unknown>>().notNull().default({}),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("customer_profiles_company_idx").on(table.companyId, table.updatedAt),
    companyInternalAccountUq: uniqueIndex("customer_profiles_company_internal_account_uq").on(table.companyId, table.internalAccountId),
    companyWorkspaceUq: uniqueIndex("customer_profiles_company_workspace_uq").on(table.companyId, table.workspaceId),
    companyStripeUq: uniqueIndex("customer_profiles_company_stripe_uq").on(table.companyId, table.stripeCustomerId),
    companyXeroUq: uniqueIndex("customer_profiles_company_xero_uq").on(table.companyId, table.xeroContactId),
    companyHubspotUq: uniqueIndex("customer_profiles_company_hubspot_uq").on(table.companyId, table.hubspotCompanyId),
    companyPosthogUq: uniqueIndex("customer_profiles_company_posthog_uq").on(table.companyId, table.posthogGroupKey),
  }),
);
