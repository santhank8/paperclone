export { default as i18n } from './config';
export { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, type SupportedLanguage } from './config';
export type { TranslationKey, Namespaces } from './types';
export { LanguageProvider, useLanguage } from '../context/LanguageContext';
export { useT } from './hooks';
