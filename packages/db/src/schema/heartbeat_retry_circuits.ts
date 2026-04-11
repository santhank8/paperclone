import { index, integer, pgTable, text, timestamp, uuid, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const heartbeatRetryCircuits = pgTable(
  "heartbeat_retry_circuits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    adapterType: text("adapter_type").notNull(),
    state: text("state").notNull().default("closed"),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    openUntil: timestamp("open_until", { withTimezone: true }),
    nextProbeAt: timestamp("next_probe_at", { withTimezone: true }),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull().defaultNow(),
    windowTotal: integer("window_total").notNull().default(0),
    windowFailures: integer("window_failures").notNull().default(0),
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),
    cooldownSeconds: integer("cooldown_seconds").notNull().default(600),
    lastFailureCode: text("last_failure_code"),
    lastFailureAt: timestamp("last_failure_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyAdapterTypeUniqueIdx: uniqueIndex("heartbeat_retry_circuits_company_adapter_type_unique_idx").on(
      table.companyId,
      table.adapterType,
    ),
    companyStateIdx: index("heartbeat_retry_circuits_company_state_idx").on(table.companyId, table.state),
  }),
);
