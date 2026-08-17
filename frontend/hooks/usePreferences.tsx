"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { translate, type Locale, type ThemePreference, type TranslationKey } from "@/i18n";
import { defaultInterfacePreferences, MAKOTO_LOCALE_COOKIE, MAKOTO_THEME_COOKIE } from "@/lib/preferences";

type PreferenceContextValue = {
  locale: Locale;
  theme: ThemePreference;
  setLocale(locale: Locale): void;
  setTheme(theme: ThemePreference): void;
  resetPreferences(): void;
  t(key: TranslationKey, values?: Record<string, string | number>): string;
};

const PreferenceContext = createContext<PreferenceContextValue | undefined>(undefined);

export function PreferenceProvider({ children, initialLocale, initialTheme }: { children: ReactNode; initialLocale: Locale; initialTheme: ThemePreference }) {
  const [locale, updateLocale] = useState(initialLocale);
  const [theme, updateTheme] = useState(initialTheme);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dataset.theme = theme;
  }, [locale, theme]);

  const setLocale = useCallback((next: Locale) => {
    updateLocale(next);
    document.cookie = `${MAKOTO_LOCALE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }, []);

  const setTheme = useCallback((next: ThemePreference) => {
    updateTheme(next);
    document.cookie = `${MAKOTO_THEME_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }, []);

  const resetPreferences = useCallback(() => {
    const defaults = defaultInterfacePreferences();
    updateLocale(defaults.locale);
    updateTheme(defaults.theme);
    document.cookie = `${MAKOTO_LOCALE_COOKIE}=${defaults.locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
    document.cookie = `${MAKOTO_THEME_COOKIE}=${defaults.theme}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }, []);

  const t = useCallback((key: TranslationKey, values?: Record<string, string | number>) => translate(locale, key, values), [locale]);
  const value = useMemo(() => ({ locale, theme, setLocale, setTheme, resetPreferences, t }), [locale, resetPreferences, setLocale, setTheme, t, theme]);
  return <PreferenceContext.Provider value={value}>{children}</PreferenceContext.Provider>;
}

export function usePreferences() {
  const value = useContext(PreferenceContext);
  if (!value) throw new Error("usePreferences must be used inside PreferenceProvider");
  return value;
}
