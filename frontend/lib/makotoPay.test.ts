import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createDemoOrderId, demoUsdcForVnd, isValidVietnamDemoPhone, maskVietnamPhone, normalizeVietnamPhone, TOP_UP_DENOMINATIONS } from "./makotoPay.ts";

const header = readFileSync(new URL("../components/AppHeader.tsx", import.meta.url), "utf8");
const catalog = readFileSync(new URL("../components/MakotoPay.tsx", import.meta.url), "utf8");
const topup = readFileSync(new URL("../components/MobileTopUpDemo.tsx", import.meta.url), "utf8");
const dialog = readFileSync(new URL("../components/ServiceComingSoonDialog.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../components/MakotoPay.module.css", import.meta.url), "utf8");
const en = readFileSync(new URL("../i18n/en.ts", import.meta.url), "utf8");
const vi = readFileSync(new URL("../i18n/vi.ts", import.meta.url), "utf8");

test("Pay navigation exists and remains active on nested Pay routes", () => {
  assert.match(header, /href:\s*"\/pay"[^\n]*en:\s*"Pay"[^\n]*vi:\s*"Thanh toán"/);
  assert.match(header, /item\.href === "\/pay" && pathname\.startsWith\("\/pay\/"\)/);
});

test("catalog distinguishes the Mobile Top-up demo from planned services", () => {
  assert.match(catalog, /const demo = id === "mobile"/);
  assert.match(catalog, /pay\.demoAvailable/);
  assert.match(catalog, /pay\.comingSoon/);
  assert.match(catalog, /ServiceComingSoonDialog/);
});

test("coming-soon dialog is honest and closes accessibly", () => {
  assert.match(dialog, /role="dialog" aria-modal="true"/);
  assert.match(dialog, /event\.key === "Escape"/);
  assert.match(dialog, /event\.key !== "Tab"/);
  assert.match(dialog, /document\.body\.style\.overflow = "hidden"/);
  assert.match(catalog, /openerRef\.current\?\.focus/);
  assert.match(en, /No provider integration is active/);
  assert.doesNotMatch(en, /official partner|supported provider|integrated with|instant top-up/i);
});

test("Vietnam-oriented phone validation normalizes spaces and masks review data", () => {
  assert.equal(normalizeVietnamPhone("0912 345 678"), "0912345678");
  assert.equal(isValidVietnamDemoPhone("0912 345 678"), true);
  assert.equal(isValidVietnamDemoPhone("912345678"), false);
  assert.equal(isValidVietnamDemoPhone("09123456789"), false);
  assert.equal(maskVietnamPhone("0912 345 678"), "0912 ••• 678");
});

test("preset denominations use the deterministic demo FX rate", () => {
  assert.deepEqual([...TOP_UP_DENOMINATIONS], [20_000, 50_000, 100_000, 200_000, 500_000]);
  assert.equal(demoUsdcForVnd(20_000), "0.80");
  assert.equal(demoUsdcForVnd(50_000), "2.00");
  assert.equal(demoUsdcForVnd(100_000), "4.00");
  assert.equal(demoUsdcForVnd(200_000), "8.00");
  assert.equal(demoUsdcForVnd(500_000), "20.00");
});

test("review and completion remain explicitly simulation-only", () => {
  assert.match(topup, /pay\.topup\.fxDisclosure/);
  assert.match(topup, /pay\.topup\.simulated/);
  assert.match(topup, /pay\.topup\.noTransaction/);
  assert.match(topup, /pay\.topup\.blockchainTransaction/);
  assert.match(topup, /pay\.topup\.notSubmitted/);
  assert.doesNotMatch(topup, /writeContract|transfer\(|ArcScan|transaction hash/i);
});

test("completion creates only an in-memory demo order ID and retry resets flow", () => {
  const id = createDemoOrderId((values) => { values[0] = 0x1234; values[1] = 0xabcd; return values; });
  assert.equal(id, "MKT-DEMO-000012340000ABCD");
  assert.match(topup, /setOrderId\(createDemoOrderId\(\)\)/);
  assert.match(topup, /function reset\(\).*setCarrier\(undefined\).*setPhone\(""\).*setAmount\(undefined\).*setOrderId\(""\).*setStep\("entry"\)/s);
  assert.doesNotMatch(topup, /localStorage|sessionStorage|fetch\(|console\./);
});

test("Makoto Pay copy exists in English and Vietnamese with exact key parity", () => {
  const keys = (source: string) => [...source.matchAll(/^\s{2}"([^"]+)":/gm)].map((match) => match[1]);
  const enKeys = keys(en); const viKeys = keys(vi);
  assert.deepEqual(enKeys, viKeys);
  assert.ok(enKeys.includes("pay.heroTitle"));
  assert.ok(enKeys.includes("pay.topup.completed"));
});

test("Pay layouts include desktop, tablet, narrow phone, focus, and reduced-motion rules", () => {
  assert.match(styles, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(styles, /@media\(max-width:1120px\)/);
  assert.match(styles, /@media\(max-width:760px\)/);
  assert.match(styles, /@media\(max-width:430px\)/);
  assert.match(styles, /@media\(max-width:340px\)/);
  assert.match(styles, /focus-visible/);
  assert.match(styles, /prefers-reduced-motion/);
});
