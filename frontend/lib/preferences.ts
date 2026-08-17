export const MAKOTO_LOCALE_COOKIE = "makoto_locale";
export const MAKOTO_THEME_COOKIE = "makoto_theme";
export const LEGACY_LOCALE_COOKIE = "pengujar_locale";
export const LEGACY_THEME_COOKIE = "pengujar_theme";
export const DEFAULT_LOCALE = "en" as const;
export const DEFAULT_THEME = "system" as const;

export function defaultInterfacePreferences() {
  return { locale: DEFAULT_LOCALE, theme: DEFAULT_THEME };
}

export function resolvePreference<T extends string>(current: string | undefined, legacy: string | undefined, allowed: readonly T[], fallback: T): T {
  if (current && allowed.includes(current as T)) return current as T;
  if (legacy && allowed.includes(legacy as T)) return legacy as T;
  return fallback;
}
