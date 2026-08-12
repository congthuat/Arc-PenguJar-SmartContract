import { en } from "./en";
import { vi } from "./vi";
import type { Locale, TranslationKey } from "./types";

export { type Locale, type ThemePreference, type TranslationKey } from "./types";

const dictionaries = { en, vi } as const;

export function translate(locale: Locale, key: TranslationKey, values?: Record<string, string | number>) {
  let message: string = dictionaries[locale][key];
  for (const [name, value] of Object.entries(values ?? {})) message = message.replaceAll(`{${name}}`, String(value));
  return message;
}
