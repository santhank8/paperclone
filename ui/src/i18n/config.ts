import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import ptBR from "./locales/pt-BR.json";

export const LANGUAGE_STORAGE_KEY = "paperclip.language";
export type SupportedLanguage = "en" | "pt-BR";
export const SUPPORTED_LANGUAGES: { value: SupportedLanguage; label: string }[] = [
  { value: "en", label: "English" },
  { value: "pt-BR", label: "Português (Brasil)" },
];

export function detectLanguage(
  storage?: { getItem(key: string): string | null },
  nav?: { language: string },
): SupportedLanguage {
  try {
    const s = storage ?? (typeof localStorage !== "undefined" ? localStorage : undefined);
    const stored = s?.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === "en" || stored === "pt-BR") return stored;
  } catch {
    // Ignore localStorage errors.
  }
  const n = nav ?? (typeof navigator !== "undefined" ? navigator : undefined);
  if (n?.language.startsWith("pt")) return "pt-BR";
  return "en";
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    "pt-BR": { translation: ptBR },
  },
  lng: detectLanguage(),
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

export { i18n };
