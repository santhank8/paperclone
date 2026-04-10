import type { ReactNode } from "react";
import { createContext, useContext } from "react";
import { readStoredUiLanguage, type UiLanguage } from "@/lib/ui-language";

export interface GeneralSettingsContextValue {
  keyboardShortcutsEnabled: boolean;
  uiLanguage: UiLanguage;
  setUiLanguage: (language: UiLanguage) => void;
}

const GeneralSettingsContext = createContext<GeneralSettingsContextValue>({
  keyboardShortcutsEnabled: false,
  uiLanguage: readStoredUiLanguage(),
  setUiLanguage: () => {},
});

export function GeneralSettingsProvider({
  value,
  children,
}: {
  value: GeneralSettingsContextValue;
  children: ReactNode;
}) {
  return (
    <GeneralSettingsContext.Provider value={value}>
      {children}
    </GeneralSettingsContext.Provider>
  );
}

export function useGeneralSettings() {
  return useContext(GeneralSettingsContext);
}
