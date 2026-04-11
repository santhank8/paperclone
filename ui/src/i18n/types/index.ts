import type { SupportedLanguage } from '../config';

export type { SupportedLanguage };

export interface TranslationKey {
  [key: string]: string | TranslationKey;
}

export interface Namespaces {
  common: typeof import('../locales/zh/translation.json')['common'];
  dashboard: typeof import('../locales/zh/translation.json')['dashboard'];
  sidebar: typeof import('../locales/zh/translation.json')['sidebar'];
  inbox: typeof import('../locales/zh/translation.json')['inbox'];
  issues: typeof import('../locales/zh/translation.json')['issues'];
  agents: typeof import('../locales/zh/translation.json')['agents'];
  goals: typeof import('../locales/zh/translation.json')['goals'];
  routines: typeof import('../locales/zh/translation.json')['routines'];
  costs: typeof import('../locales/zh/translation.json')['costs'];
  org: typeof import('../locales/zh/translation.json')['org'];
  settings: typeof import('../locales/zh/translation.json')['settings'];
}
