import { z } from "zod";

export function canonicalizeLocaleCode(value: string): string {
  try {
    return Intl.getCanonicalLocales(value)[0] ?? value;
  } catch {
    return value;
  }
}

export function isValidLocaleCode(value: string) {
  try {
    return Intl.getCanonicalLocales(value).length > 0;
  } catch {
    return false;
  }
}

export const localeCodeSchema = z
  .string()
  .min(1)
  .refine(isValidLocaleCode, "Invalid locale code");

export const localizationMessagesSchema = z.record(z.string().min(1), z.string());

export const localizationPackSchema = z.object({
  schemaVersion: z.literal(1),
  locale: localeCodeSchema,
  label: z.string().min(1).nullable().default(null),
  baseLocale: z.literal("en").default("en"),
  messages: localizationMessagesSchema,
}).strict();

export const instanceLocaleSummarySchema = z.object({
  locale: localeCodeSchema,
  label: z.string().min(1).nullable().default(null),
  builtIn: z.boolean(),
}).strict();

export const instanceLocalesResponseSchema = z.object({
  defaultLocale: localeCodeSchema,
  locales: z.array(instanceLocaleSummarySchema),
}).strict();

export type LocalizationPackInput = z.infer<typeof localizationPackSchema>;
export type InstanceLocaleSummaryInput = z.infer<typeof instanceLocaleSummarySchema>;
export type InstanceLocalesResponseInput = z.infer<typeof instanceLocalesResponseSchema>;
