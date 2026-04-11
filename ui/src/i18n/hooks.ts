import { useLanguage } from '../context/LanguageContext';

export function useT() {
  return useLanguage();
}
