import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const globals = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const wallet = readFileSync(new URL("../components/MakotoWallet.module.css", import.meta.url), "utf8");
const balanceHook = readFileSync(new URL("../hooks/useWalletBalances.ts", import.meta.url), "utf8");
const dashboard = readFileSync(new URL("../components/WalletDashboard.tsx", import.meta.url), "utf8");
const walletControl = readFileSync(new URL("../components/WalletControl.tsx", import.meta.url), "utf8");
const languageMenu = readFileSync(new URL("../components/LanguageMenu.tsx", import.meta.url), "utf8");

test("responsive CSS fixes overflow sources instead of masking the page", () => {
  assert.doesNotMatch(globals, /html\s*,\s*body\s*\{[^}]*overflow-x\s*:\s*(?:hidden|clip)/i);
  assert.match(wallet, /grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(wallet, /\.assetContract\s*\{[^}]*display:\s*flex/s);
  assert.match(wallet, /\.activityStatus\s*\{[^}]*display:\s*inline-flex/s);
});

test("wallet balances avoid the obsolete native query and aggressive background refresh", () => {
  assert.doesNotMatch(balanceHook, /useBalance|\bnative\b/);
  assert.doesNotMatch(dashboard, /balances\.native/);
  assert.doesNotMatch(walletControl, /balances\.native/);
  assert.match(balanceHook, /staleTime:\s*30_000/);
  assert.match(balanceHook, /refetchOnWindowFocus:\s*false/);
  assert.match(balanceHook, /refetchInterval:\s*false/);
});

test("mobile controls and modals account for touch and safe areas", () => {
  assert.match(globals, /env\(safe-area-inset-top\)/);
  assert.match(globals, /env\(safe-area-inset-bottom\)/);
  assert.match(wallet, /\.languageTrigger\s*\{[^}]*min-height:\s*40px[^}]*display:\s*inline-flex/s);
  assert.match(wallet, /\.settingsChoices label\s*\{[^}]*min-height:\s*48px/s);
  assert.match(globals, /\.connected-popover\.account-menu\s*\{[^}]*bottom:\s*0[^}]*width:\s*100%[^}]*max-height:\s*calc\(100dvh[^}]*overflow-y:\s*auto/s);
  assert.match(globals, /\.account-sheet-backdrop\s*\{[^}]*position:\s*fixed[^}]*inset:\s*0/s);
});

test("language switcher is a keyboard-accessible custom menu", () => {
  assert.doesNotMatch(languageMenu, /<select|<option/);
  assert.match(languageMenu, /aria-haspopup="menu"/);
  assert.match(languageMenu, /aria-expanded=\{open\}/);
  assert.match(languageMenu, /role="menu"/);
  assert.match(languageMenu, /role="menuitemradio"/);
  assert.match(languageMenu, /event\.key === "Escape"/);
  assert.match(languageMenu, /languageCheck/);
  assert.match(languageMenu, /selected \? "✓"/);
});

test("mobile wallet account sheet escapes transformed header ancestors", () => {
  assert.match(walletControl, /import\s*\{\s*createPortal\s*\}\s*from\s*["']react-dom["']/);
  assert.match(walletControl, /accountOpen\s*&&\s*isMobileAccountSheet[\s\S]*?createPortal\([\s\S]*?account-sheet-backdrop[\s\S]*?document\.body\)/);
  assert.match(walletControl, /role="dialog"\s+aria-modal=\{isMobileAccountSheet\s*\?\s*"true"\s*:\s*undefined\}/);
  assert.match(walletControl, /previousBodyOverflow\s*=\s*document\.body\.style\.overflow[\s\S]*?document\.body\.style\.overflow\s*=\s*"hidden"[\s\S]*?document\.body\.style\.overflow\s*=\s*previousBodyOverflow/);
  assert.match(wallet, /@media\s*\(max-width:\s*760px\)[\s\S]*?\.walletControlWrap:hover,\s*\.walletControlWrap:focus-within\s*\{\s*transform:\s*none/);
  assert.match(globals, /\.connected-popover\.account-menu\s*\{[^}]*position:\s*fixed[^}]*bottom:\s*0[^}]*padding:[^}]*env\(safe-area-inset-bottom\)/s);
});

test("connected account panel preserves account context and preferences", () => {
  assert.match(walletControl, /connection\.connector\?\.name/);
  assert.match(walletControl, /PreferenceFields|preference-fields|wallet\.preferences|about-menu|about\.title/);
  assert.match(walletControl, /wallet\.account[\s\S]*wallet\.copy[\s\S]*wallet\.arcscan[\s\S]*wallet\.network[\s\S]*wallet\.usdcBalance[\s\S]*wallet\.disconnect/);
  assert.match(globals, /\.disconnect-button\{[^}]*border:\s*1px solid #efc8c3[^}]*color:\s*#a44338[^}]*background:\s*#fff6f4/);
  assert.match(globals, /html\[data-theme="dark"\] \.disconnect-button\{[^}]*color:\s*#ffb0a6[^}]*background:\s*#2a1b20/);
});

test("dashboard previews five activities and derives savings summary", () => {
  assert.match(dashboard, /activities\.slice\(0,\s*5\)/);
  assert.match(dashboard, /summarizeSavingsJars\(jars\)/);
  assert.match(dashboard, /savingsSummary/);
  assert.doesNotMatch(dashboard, /activity\.loadMore\(\)/);
  assert.match(wallet, /\.savingsSummary\s*\{[^}]*grid-template-columns:\s*repeat\(3/s);
});
