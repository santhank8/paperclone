import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import zhTW from "./locales/zh-TW.json";
import ja from "./locales/ja.json";
import ko from "./locales/ko.json";

const savedLang = localStorage.getItem("paperclip-language") || navigator.language;

function resolveLanguage(lang: string): string {
  if (lang.startsWith("zh")) return "zh-TW";
  if (lang.startsWith("ja")) return "ja";
  if (lang.startsWith("ko")) return "ko";
  return "en";
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    "zh-TW": { translation: zhTW },
    ja: { translation: ja },
    ko: { translation: ko },
  },
  lng: resolveLanguage(savedLang),
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

export function setLanguage(lang: string): void {
  i18n.changeLanguage(lang);
  localStorage.setItem("paperclip-language", lang);
  document.documentElement.lang = lang;
}

export function getCurrentLanguage(): string {
  return i18n.language;
}

export const supportedLanguages = [
  { code: "en", label: "English" },
  { code: "zh-TW", label: "繁體中文" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
] as const;

export default i18n;
