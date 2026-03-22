import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { canonicalizeLocaleCode, type InstanceLocaleSummary, type LocalizationPack } from "@paperclipai/shared";
import { localesApi } from "@/api/locales";
import { queryKeys } from "@/lib/queryKeys";
import { formatMessage } from "./format";
import { enMessages } from "./resources/en";
import type { I18nKey, LocalePreference, MessageDictionary } from "./types";

const LOCALE_PREFERENCE_STORAGE_KEY = "paperclip.localePreference";
const LOCALE_CACHE_PREFIX = "paperclip.localeCache.";

const BUILTIN_LOCALES: InstanceLocaleSummary[] = [
  { locale: "en", label: "English", builtIn: true },
];

const FALLBACK_LOCALES_RESPONSE = {
  defaultLocale: "en",
  locales: BUILTIN_LOCALES,
};

interface I18nContextValue {
  defaultLocale: string;
  localePreference: LocalePreference;
  resolvedLocale: string;
  locales: InstanceLocaleSummary[];
  isReady: boolean;
  t: (key: I18nKey, params?: Record<string, string | number | boolean | null | undefined>) => string;
  setLocalePreference: (preference: LocalePreference) => void;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

function isSpecialPreference(value: string): value is "instance" | "browser" {
  return value === "instance" || value === "browser";
}

function readLocalePreference(): LocalePreference {
  if (typeof window === "undefined") return "instance";
  try {
    const stored = window.localStorage.getItem(LOCALE_PREFERENCE_STORAGE_KEY)?.trim();
    if (!stored) return "instance";
    if (isSpecialPreference(stored)) return stored;
    return canonicalizeLocaleCode(stored);
  } catch {
    return "instance";
  }
}

function readCachedPack(locale: string): LocalizationPack | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${LOCALE_CACHE_PREFIX}${locale}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalizationPack;
    if (parsed && parsed.locale === locale && typeof parsed.messages === "object" && parsed.messages) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function writeCachedPack(pack: LocalizationPack) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${LOCALE_CACHE_PREFIX}${pack.locale}`, JSON.stringify(pack));
  } catch {
    // Ignore storage failures in restricted environments.
  }
}

function resolveBrowserLocale(availableLocales: Set<string>): string | null {
  if (typeof navigator === "undefined") return null;
  const candidates = navigator.languages.length > 0 ? navigator.languages : [navigator.language];
  for (const candidate of candidates) {
    const canonical = canonicalizeLocaleCode(candidate);
    if (availableLocales.has(canonical)) return canonical;
    const languageOnly = canonical.split("-")[0];
    if (languageOnly && availableLocales.has(languageOnly)) return languageOnly;
  }
  return null;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [localePreference, setLocalePreferenceState] = useState<LocalePreference>(() => readLocalePreference());

  const localesQuery = useQuery({
    queryKey: queryKeys.instance.locales,
    queryFn: () => localesApi.list(),
    retry: false,
    staleTime: 30_000,
  });

  const localesResponse = localesQuery.data ?? FALLBACK_LOCALES_RESPONSE;
  const locales = useMemo(() => {
    const map = new Map<string, InstanceLocaleSummary>();
    for (const locale of BUILTIN_LOCALES) map.set(locale.locale, locale);
    for (const locale of localesResponse.locales) map.set(locale.locale, locale);
    return [...map.values()].sort((left, right) => left.locale.localeCompare(right.locale));
  }, [localesResponse.locales]);
  const availableLocaleSet = useMemo(() => new Set(locales.map((locale) => locale.locale)), [locales]);

  const explicitPreference = !isSpecialPreference(localePreference) ? localePreference : null;
  const cachedExplicitPack = explicitPreference ? readCachedPack(explicitPreference) : null;
  const normalizedPreference: LocalePreference = useMemo(() => {
    if (localePreference === "instance" || localePreference === "browser") return localePreference;
    return availableLocaleSet.has(localePreference) || cachedExplicitPack ? localePreference : "instance";
  }, [availableLocaleSet, cachedExplicitPack, localePreference]);

  const desiredLocale = useMemo(() => {
    if (normalizedPreference === "browser") {
      return resolveBrowserLocale(availableLocaleSet) ?? localesResponse.defaultLocale ?? "en";
    }
    if (normalizedPreference === "instance") {
      return localesResponse.defaultLocale ?? "en";
    }
    return normalizedPreference;
  }, [availableLocaleSet, localesResponse.defaultLocale, normalizedPreference]);

  const cachedPack = useMemo(() => {
    if (desiredLocale === "en") return null;
    return readCachedPack(desiredLocale);
  }, [desiredLocale]);

  const localePackQuery = useQuery({
    queryKey: queryKeys.instance.localePack(desiredLocale),
    queryFn: () => localesApi.get(desiredLocale),
    enabled: desiredLocale !== "en",
    retry: false,
    staleTime: 30_000,
    initialData: cachedPack ?? undefined,
  });

  useEffect(() => {
    if (localePackQuery.data && localePackQuery.data.locale !== "en") {
      writeCachedPack(localePackQuery.data);
    }
  }, [localePackQuery.data]);

  const resolvedLocale = desiredLocale === "en"
    ? "en"
    : localePackQuery.data
      ? desiredLocale
      : "en";

  const messages: MessageDictionary = useMemo(() => {
    const overlay = resolvedLocale === "en" ? null : localePackQuery.data?.messages ?? null;
    return overlay ? { ...enMessages, ...overlay } : { ...enMessages };
  }, [localePackQuery.data?.messages, resolvedLocale]);

  const isReady = desiredLocale === "en" || Boolean(localePackQuery.data) || !localePackQuery.isPending;

  const setLocalePreference = useCallback((preference: LocalePreference) => {
    const normalized = isSpecialPreference(preference) ? preference : canonicalizeLocaleCode(preference);
    setLocalePreferenceState(normalized);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(LOCALE_PREFERENCE_STORAGE_KEY, normalizedPreference);
    } catch {
      // Ignore storage failures in restricted environments.
    }
  }, [normalizedPreference]);

  const t = useCallback<I18nContextValue["t"]>((key, params) => {
    const template = messages[key] ?? enMessages[key];
    return formatMessage(template, params);
  }, [messages]);

  const value = useMemo<I18nContextValue>(() => ({
    defaultLocale: localesResponse.defaultLocale ?? "en",
    localePreference: normalizedPreference,
    resolvedLocale,
    locales,
    isReady,
    t,
    setLocalePreference,
  }), [isReady, locales, localesResponse.defaultLocale, normalizedPreference, resolvedLocale, setLocalePreference, t]);

  if (!isReady) {
    return <div className="fixed inset-0 flex items-center justify-center text-sm text-muted-foreground">{t("common.loading")}</div>;
  }

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}
