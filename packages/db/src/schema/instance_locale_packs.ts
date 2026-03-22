import { pgTable, uuid, text, timestamp, jsonb, uniqueIndex } from "drizzle-orm/pg-core";

export const instanceLocalePacks = pgTable(
  "instance_locale_packs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    locale: text("locale").notNull(),
    label: text("label"),
    messagesJson: jsonb("messages_json").$type<Record<string, string>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    localeIdx: uniqueIndex("instance_locale_packs_locale_idx").on(table.locale),
  }),
);
