import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createElement } from "react";
import en from "../locales/en";
import ko from "../locales/ko";

const LANGUAGE_STORAGE_KEY = "paperclip.language";
const SUPPORTED_LANGUAGES = ["en", "ko"] as const;
type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

type TranslationMap = typeof en.translation;

const resources: Record<SupportedLanguage, { translation: Record<string, unknown> }> = { en, ko };

function getNestedValue(obj: unknown, path: string): string {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") return path;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" ? current : path;
}

function detectLanguage(): SupportedLanguage {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored && SUPPORTED_LANGUAGES.includes(stored as SupportedLanguage)) {
      return stored as SupportedLanguage;
    }
  } catch {
    // ignore
  }
  const nav = navigator.language ?? "";
  const prefix = nav.split("-")[0]?.toLowerCase();
  if (prefix && SUPPORTED_LANGUAGES.includes(prefix as SupportedLanguage)) {
    return prefix as SupportedLanguage;
  }
  return "en";
}

interface I18nContextValue {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>(detectLanguage);

  const setLanguage = useCallback((lang: SupportedLanguage) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // ignore
    }
  }, [language]);

  const t = useCallback(
    (key: string): string => {
      const result = getNestedValue(resources[language]?.translation, key);
      if (result !== key) return result;
      return getNestedValue(resources.en.translation, key);
    },
    [language],
  );

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

  return createElement(I18nContext.Provider, { value }, children);
}

const fallbackT = (key: string): string => getNestedValue(resources.en.translation, key);
const fallbackValue: I18nContextValue = {
  language: "en",
  setLanguage: () => {},
  t: fallbackT,
};

function useTranslation(): I18nContextValue {
  const context = useContext(I18nContext);
  return context ?? fallbackValue;
}

export {
  I18nProvider,
  useTranslation,
  SUPPORTED_LANGUAGES,
  LANGUAGE_STORAGE_KEY,
  type SupportedLanguage,
};
