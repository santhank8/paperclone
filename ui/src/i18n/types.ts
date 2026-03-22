import type { enMessages } from "./resources/en";

export type MessageDictionary = Record<string, string>;
export type I18nKey = keyof typeof enMessages;
export type LocalePreference = "instance" | "browser" | string;
