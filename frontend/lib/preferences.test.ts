import assert from "node:assert/strict";
import test from "node:test";
import { defaultInterfacePreferences, LEGACY_LOCALE_COOKIE, LEGACY_THEME_COOKIE, MAKOTO_LOCALE_COOKIE, MAKOTO_THEME_COOKIE, resolvePreference } from "./preferences.ts";

test("Makoto preference names replace generic PenguJar identity", () => {
  assert.equal(MAKOTO_LOCALE_COOKIE, "makoto_locale"); assert.equal(MAKOTO_THEME_COOKIE, "makoto_theme");
  assert.equal(LEGACY_LOCALE_COOKIE, "pengujar_locale"); assert.equal(LEGACY_THEME_COOKIE, "pengujar_theme");
});

test("interface reset is limited to the existing locale and theme defaults", () => {
  assert.deepEqual(defaultInterfacePreferences(), { locale: "en", theme: "system" });
});

test("new preference wins and legacy remains a safe fallback", () => {
  assert.equal(resolvePreference("en", "vi", ["en", "vi"] as const, "en"), "en");
  assert.equal(resolvePreference(undefined, "vi", ["en", "vi"] as const, "en"), "vi");
  assert.equal(resolvePreference("bad", "dark", ["light", "dark", "system"] as const, "system"), "dark");
  assert.equal(resolvePreference(undefined, undefined, ["en", "vi"] as const, "en"), "en");
});
