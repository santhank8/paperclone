import { pgTable, uuid, text, boolean, timestamp, index, jsonb } from "drizzle-orm/pg-core";
import { webhookConfigs } from "./webhook_configs.js";

export const webhookActionRules = pgTable(
  "webhook_action_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    webhookConfigId: uuid("webhook_config_id")
      .notNull()
      .references(() => webhookConfigs.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    action: text("action").notNull(),
    actionParams: jsonb("action_params").$type<Record<string, unknown>>().default({}),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    configIdx: index("webhook_action_rules_config_idx").on(table.webhookConfigId),
  }),
);
