import assert from "node:assert/strict";
import test from "node:test";
import { getAssetById, parseAssetAmount } from "./assets.ts";
import { parseCreateJar } from "./createJar.ts";
import { normalizeDecimalInput } from "./decimalInput.ts";

const future = "2030-01-01T00:00";
const usdc = getAssetById("usdc")!;

test("localized decimal normalization accepts dot or comma without treating comma as grouping", () => {
  assert.equal(normalizeDecimalInput("0.001"), "0.001");
  assert.equal(normalizeDecimalInput("0,001"), "0.001");
  assert.equal(normalizeDecimalInput("1,5"), "1.5");
  assert.equal(normalizeDecimalInput("1.5"), "1.5");
  assert.equal(normalizeDecimalInput("100"), "100");
  assert.equal(normalizeDecimalInput("1,000"), "1.000");
});

test("localized decimal normalization rejects malformed, negative, and excess precision", () => {
  for (const value of ["-1", "abc", "1.2.3", "1,2,3", "1.0000001", "1,0000001", "1.", ",1"]) {
    assert.equal(normalizeDecimalInput(value), undefined, value);
  }
  assert.equal(normalizeDecimalInput("0.000001"), "0.000001");
});

test("Create Jar dot and comma targets produce identical positive bigint amounts", () => {
  const dot = parseCreateJar({ name: "QA", target: "0.001", unlockLocal: future }, 0);
  const comma = parseCreateJar({ name: "QA", target: "0,001", unlockLocal: future }, 0);
  assert.equal(dot.targetAmount, 1_000n);
  assert.equal(comma.targetAmount, dot.targetAmount);
  assert.equal(parseCreateJar({ name: "QA", target: "0.000001", unlockLocal: future }, 0).targetAmount, 1n);
  assert.throws(() => parseCreateJar({ name: "QA", target: "0.0000001", unlockLocal: future }, 0));
  assert.throws(() => parseCreateJar({ name: "QA", target: "0", unlockLocal: future }, 0));
});

test("Receive asset parsing treats dot and comma decimals identically and rejects malformed values", () => {
  assert.equal(parseAssetAmount("0.01", usdc), 10_000n);
  assert.equal(parseAssetAmount("0,01", usdc), 10_000n);
  for (const value of ["1.2.3", "1,2,3", "-1", "abc", "0"]) assert.equal(parseAssetAmount(value, usdc), undefined, value);
});
