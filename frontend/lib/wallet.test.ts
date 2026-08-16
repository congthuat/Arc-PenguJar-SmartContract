import assert from "node:assert/strict";
import test from "node:test";
import { arcScanTransactionUrl, normalizeRecipient, parseUsdcAmount, validateUsdcSend } from "./wallet.ts";

test("normalizes a valid EVM recipient and rejects malformed input", () => {
  assert.equal(normalizeRecipient(" 0x000000000000000000000000000000000000dEaD "), "0x000000000000000000000000000000000000dEaD");
  assert.equal(normalizeRecipient("not-an-address"), undefined);
});

test("parses USDC with six decimals and rejects zero or excess precision", () => {
  assert.equal(parseUsdcAmount("1.234567"), 1_234_567n);
  assert.equal(parseUsdcAmount("0"), undefined);
  assert.equal(parseUsdcAmount("1.0000001"), undefined);
});

test("send validation prevents spending more USDC than the wallet balance", () => {
  assert.deepEqual(validateUsdcSend("0x000000000000000000000000000000000000dEaD", "2", 1_000_000n), { error: "balance" });
});

test("builds an ArcScan transaction URL", () => {
  const hash = `0x${"12".repeat(32)}`;
  assert.equal(arcScanTransactionUrl(hash), `https://testnet.arcscan.app/tx/${hash}`);
});
