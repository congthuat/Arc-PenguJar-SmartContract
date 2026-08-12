import type { en } from "./en";

export type Locale = "en" | "vi";
export type ThemePreference = "system" | "light" | "dark";
export type TranslationKey = keyof typeof en;
export type Translations = { [K in TranslationKey]: string };
