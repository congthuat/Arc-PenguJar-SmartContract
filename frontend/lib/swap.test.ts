import assert from "node:assert/strict";
import test from "node:test";

import { getAssetById } from "./assets.ts";
import { isSwapQuoteFresh, normalizeLifiQuote, oppositeAssetId } from "./swap.ts";

const owner = "0x1111111111111111111111111111111111111111" as const;
const spender = "0x2222222222222222222222222222222222222222" as const;
const target = "0x3333333333333333333333333333333333333333" as const;

test("oppositeAssetId keeps the Arc stablecoin pair explicit", () => {
  assert.equal(oppositeAssetId("usdc"), "eurc");
  assert.equal(oppositeAssetId("eurc"), "usdc");
});

test("swap quote freshness expires stale execution data", () => {
  assert.equal(isSwapQuoteFresh(1_000, 46_001), false);
  assert.equal(isSwapQuoteFresh(1_000, 45_999), true);
});

test("normalizeLifiQuote accepts an Arc-only exact-input quote", () => {
  const usdc = getAssetById("usdc")!;
  const eurc = getAssetById("eurc")!;
  const quote = normalizeLifiQuote({
    id: "quote-1",
    tool: "dex",
    toolDetails: { name: "Arc DEX" },
    action: {
      fromChainId: 5042002,
      toChainId: 5042002,
      fromAmount: "1000000",
      fromToken: { address: usdc.address },
      toToken: { address: eurc.address },
    },
    estimate: {
      fromAmount: "1000000",
      toAmount: "999000",
      toAmountMin: "994000",
      approvalAddress: spender,
      executionDuration: 8,
    },
    transactionRequest: {
      to: target,
      from: owner,
      data: "0x1234",
      value: "0x0",
      chainId: 5042002,
    },
  }, { fromAssetId: "usdc", toAssetId: "eurc", fromAmount: "1000000", fromAddress: owner });

  assert.equal(quote.toAmount, "999000");
  assert.equal(quote.approvalAddress, spender);
});

test("normalizeLifiQuote rejects a transaction that asks for native value", () => {
  const usdc = getAssetById("usdc")!;
  const eurc = getAssetById("eurc")!;
  assert.throws(() => normalizeLifiQuote({
    id: "quote-2",
    tool: "dex",
    action: {
      fromChainId: 5042002,
      toChainId: 5042002,
      fromAmount: "1000000",
      fromToken: { address: usdc.address },
      toToken: { address: eurc.address },
    },
    estimate: {
      fromAmount: "1000000",
      toAmount: "999000",
      toAmountMin: "994000",
      approvalAddress: spender,
    },
    transactionRequest: {
      to: target,
      from: owner,
      data: "0x1234",
      value: "0x1",
      chainId: 5042002,
    },
  }, { fromAssetId: "usdc", toAssetId: "eurc", fromAmount: "1000000", fromAddress: owner }));
});
