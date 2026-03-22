export interface LocalizationPack {
  schemaVersion: 1;
  locale: string;
  label: string | null;
  baseLocale: "en";
  messages: Record<string, string>;
}

export interface InstanceLocaleSummary {
  locale: string;
  label: string | null;
  builtIn: boolean;
}

export interface InstanceLocalesResponse {
  defaultLocale: string;
  locales: InstanceLocaleSummary[];
}
