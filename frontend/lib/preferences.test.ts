import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { defaultInterfacePreferences, LEGACY_LOCALE_COOKIE, LEGACY_THEME_COOKIE, MAKOTO_LOCALE_COOKIE, MAKOTO_THEME_COOKIE, resolvePreference } from "./preferences.ts";
import { en } from "../i18n/en.ts";
import { vi } from "../i18n/vi.ts";

const walletDashboard = readFileSync(new URL("../components/WalletDashboard.tsx", import.meta.url), "utf8");

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

test("Vietnamese wallet and savings labels come from the central catalog", () => {
  assert.equal(vi["walletHome.savings"], "Mục tiêu tiết kiệm");
  assert.equal(vi["walletHome.viewSavings"], "Xem khoản tiết kiệm");
  assert.equal(vi["walletHome.createJar"], "Tạo mục tiêu mới");
  assert.equal(vi["walletHome.totalSaved"], "Tổng đã tiết kiệm");
  assert.equal(vi["walletHome.activeJars"], "Đang hoạt động");
  assert.equal(vi["walletHome.completedJars"], "Đã hoàn thành");
  assert.equal(vi["walletHome.companionSupport"], "Đơn giản. Không lưu ký. Dành cho Arc.");
  assert.deepEqual(Object.keys(vi).sort(), Object.keys(en).sort());
});

test("Makoto Vault uses savings-goal language while contract identifiers stay intact", () => {
  assert.equal(en["savings.statusTitle"], "Connected to your savings");
  assert.equal(en["savings.createNew"], "Create new goal");
  assert.equal(en["dashboard.myJars"], "My savings");
  assert.equal(en["jar.number"], "Goal #{id}");
  assert.equal(en["jar.view"], "View goal");
  assert.equal(en["jar.personal"], "Savings goal");
  assert.equal(en["walletHome.penguJar"], "Makoto Vault");
  assert.doesNotMatch(Object.values(en).join("\n"), /\bPenguJar\b|\bjars?\b/i);
  assert.match(readFileSync(new URL("abi/penguJarV3.ts", import.meta.url), "utf8"), /penguJarV3Abi|JarCreated/);
});

test("WalletDashboard has no duplicated locale dictionary or forbidden English fallbacks", () => {
  assert.doesNotMatch(walletDashboard, /\bconst\s+c\s*=/);
  for (const phrase of ["Savings Jars", "View Savings", "Create a Jar", "Total saved", "Active jars", "Completed jars", "Non-custodial"]) {
    assert.doesNotMatch(walletDashboard, new RegExp(phrase, "i"));
  }
  assert.match(walletDashboard, /usePreferences\(\)[\s\S]*?\bt\("walletHome\./);
});
