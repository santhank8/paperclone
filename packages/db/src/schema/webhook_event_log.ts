import { pgTable, uuid, text, timestamp, index, jsonb, integer } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { webhookConfigs } from "./webhook_configs.js";

export const webhookEventLog = pgTable(
  "webhook_event_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    webhookConfigId: uuid("webhook_config_id").references(() => webhookConfigs.id, {
      onDelete: "set null",
    }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    provider: text("provider").notNull(),
    eventType: text("event_type").notNull(),
    deliveryId: text("delivery_id"),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    headers: jsonb("headers").$type<Record<string, unknown>>(),
    status: text("status").notNull().default("received"),
    errorMessage: text("error_message"),
    matchedIssues: jsonb("matched_issues").$type<Record<string, unknown>[]>(),
    processingMs: integer("processing_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("webhook_event_log_company_idx").on(table.companyId),
    configIdx: index("webhook_event_log_config_idx").on(table.webhookConfigId),
    createdAtIdx: index("webhook_event_log_created_at_idx").on(table.createdAt),
  }),
);
