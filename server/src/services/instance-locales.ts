import type { Db } from "@paperclipai/db";
import { companies, instanceLocalePacks } from "@paperclipai/db";
import { canonicalizeLocaleCode, type InstanceLocalesResponse, type InstanceLocaleSummary, type LocalizationPack } from "@paperclipai/shared";
import { asc, eq } from "drizzle-orm";
import { notFound } from "../errors.js";
import { instanceSettingsService } from "./instance-settings.js";

const BUILTIN_ENGLISH_SUMMARY: InstanceLocaleSummary = {
  locale: "en",
  label: "English",
  builtIn: true,
};

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const rec = value as Record<string, unknown>;
    return `{${Object.keys(rec).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(rec[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

interface UpsertLocaleResult {
  pack: LocalizationPack;
  changed: boolean;
}

function toLocalizationPack(row: typeof instanceLocalePacks.$inferSelect): LocalizationPack {
  return {
    schemaVersion: 1,
    locale: canonicalizeLocaleCode(row.locale),
    label: row.label ?? null,
    baseLocale: "en",
    messages: { ...(row.messagesJson ?? {}) },
  };
}

export function instanceLocalesService(db: Db) {
  const settings = instanceSettingsService(db);

  return {
    list: async (): Promise<InstanceLocalesResponse> => {
      const general = await settings.getGeneral();
      const rows = await db
        .select({
          locale: instanceLocalePacks.locale,
          label: instanceLocalePacks.label,
        })
        .from(instanceLocalePacks)
        .orderBy(asc(instanceLocalePacks.locale));
      return {
        defaultLocale: general.defaultLocale,
        locales: [
          BUILTIN_ENGLISH_SUMMARY,
          ...rows.map((row) => ({
            locale: canonicalizeLocaleCode(row.locale),
            label: row.label ?? null,
            builtIn: false,
          })),
        ],
      };
    },

    get: async (locale: string): Promise<LocalizationPack> => {
      const normalizedLocale = canonicalizeLocaleCode(locale);
      const row = await db
        .select()
        .from(instanceLocalePacks)
        .where(eq(instanceLocalePacks.locale, normalizedLocale))
        .then((rows) => rows[0] ?? null);

      if (!row) {
        throw notFound(`Locale pack not found: ${locale}`);
      }

      return toLocalizationPack(row);
    },

    upsert: async (pack: LocalizationPack): Promise<UpsertLocaleResult> => {
      const normalizedLocale = canonicalizeLocaleCode(pack.locale);
      const nextMessages = { ...pack.messages };
      const existing = await db
        .select()
        .from(instanceLocalePacks)
        .where(eq(instanceLocalePacks.locale, normalizedLocale))
        .then((rows) => rows[0] ?? null);

      if (
        existing
        && (existing.label ?? null) === (pack.label ?? null)
        && stableStringify(existing.messagesJson ?? {}) === stableStringify(nextMessages)
      ) {
        return {
          pack: toLocalizationPack(existing),
          changed: false,
        };
      }

      const now = new Date();
      const [row] = await db
        .insert(instanceLocalePacks)
        .values({
          locale: normalizedLocale,
          label: pack.label,
          messagesJson: nextMessages,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [instanceLocalePacks.locale],
          set: {
            label: pack.label,
            messagesJson: nextMessages,
            updatedAt: now,
          },
        })
        .returning();

      if (!row) {
        throw new Error("Locale pack upsert returned no rows");
      }

      return {
        pack: toLocalizationPack(row),
        changed: true,
      };
    },

    listCompanyIds: async (): Promise<string[]> =>
      db
        .select({ id: companies.id })
        .from(companies)
        .then((rows) => rows.map((row) => row.id)),
  };
}
