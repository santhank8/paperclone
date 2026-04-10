export const UI_LANGUAGES = ["en", "zh-CN"] as const;

export type UiLanguage = (typeof UI_LANGUAGES)[number];

export const UI_LANGUAGE_STORAGE_KEY = "paperclip.uiLanguage";

export function isUiLanguage(value: unknown): value is UiLanguage {
  return typeof value === "string" && UI_LANGUAGES.includes(value as UiLanguage);
}

export function getDefaultUiLanguage(): UiLanguage {
  if (typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("zh")) {
    return "zh-CN";
  }
  return "en";
}

export function resolveUiLanguage(value: unknown): UiLanguage {
  return isUiLanguage(value) ? value : getDefaultUiLanguage();
}

export function readStoredUiLanguage(): UiLanguage {
  if (typeof window === "undefined") return getDefaultUiLanguage();
  try {
    return resolveUiLanguage(window.localStorage.getItem(UI_LANGUAGE_STORAGE_KEY));
  } catch {
    return getDefaultUiLanguage();
  }
}

export function writeStoredUiLanguage(language: UiLanguage) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Ignore storage failures in restricted environments.
  }
}

export function textFor(
  language: UiLanguage,
  copy: Record<UiLanguage, string>,
): string {
  return copy[language];
}
