import assert from "node:assert/strict";
import test from "node:test";
import { formatAssetAmount, getAssetByAddress, getAssetById, parseAssetAmount, SUPPORTED_ASSETS } from "./assets.ts";

test("registry supports exactly official Arc Testnet USDC and EURC", () => {
  assert.deepEqual(SUPPORTED_ASSETS.map(({ id }) => id), ["usdc", "eurc"]);
  assert.equal(getAssetById("usdc")?.address, "0x3600000000000000000000000000000000000000");
  assert.equal(getAssetById("eurc")?.address, "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a");
  assert.equal(SUPPORTED_ASSETS.every(({ decimals }) => decimals === 6), true);
  assert.equal(getAssetById("other"), undefined);
  assert.equal(getAssetByAddress("0x0000000000000000000000000000000000000001"), undefined);
});

test("asset formatting and parsing use exact six-decimal bigint amounts", () => {
  for (const asset of SUPPORTED_ASSETS) {
    assert.equal(formatAssetAmount(1_234_567n, asset), "1.234567");
    assert.equal(parseAssetAmount("1.234567", asset), 1_234_567n);
    assert.equal(parseAssetAmount("1.2345678", asset), undefined);
  }
});
