import assert from "node:assert/strict";
import test from "node:test";

import { getAssetById } from "./assets.ts";
import { fetchLifiQuoteWithPresetFallback, isSwapQuoteFresh, normalizeLifiQuote, oppositeAssetId } from "./swap.ts";

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

test("provider preset rejection safely retries without relaxing Arc-only restrictions", async () => {
  const calls: URL[] = [];
  const fetcher = (async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    calls.push(url);
    return url.searchParams.has("preset")
      ? Response.json({ message: "Failed to apply to quote request preset 'stablecoin'", code: 1011 }, { status: 400 })
      : Response.json({ ok: true });
  }) as typeof fetch;
  const url = new URL("https://li.quest/v1/quote?fromChain=5042002&toChain=5042002&allowBridges=none");
  const response = await fetchLifiQuoteWithPresetFallback(url, {}, fetcher);
  assert.equal(response.ok, true);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].searchParams.get("preset"), "stablecoin");
  assert.equal(calls[1].searchParams.has("preset"), false);
  assert.equal(calls[1].searchParams.get("allowBridges"), "none");
  assert.equal(calls[1].searchParams.get("fromChain"), "5042002");
  assert.equal(calls[1].searchParams.get("toChain"), "5042002");
});

test("non-preset provider errors are not retried", async () => {
  let calls = 0;
  const fetcher = (async () => { calls += 1; return Response.json({ code: 1002 }, { status: 404 }); }) as typeof fetch;
  const response = await fetchLifiQuoteWithPresetFallback(new URL("https://li.quest/v1/quote?allowBridges=none"), {}, fetcher);
  assert.equal(response.status, 404); assert.equal(calls, 1);
});

test("normalizeLifiQuote rejects unsupported pair, wrong chain, sender, token, amount, and bridge steps", () => {
  const base = quotePayload();
  const cases: Array<[string, unknown, Parameters<typeof normalizeLifiQuote>[1]]> = [
    ["unsupported pair", quotePayload(), expected({ toAssetId: "usdc" })],
    ["wrong chain", quotePayload({ action: { ...base.action, toChainId: 84532 } }), expected()],
    ["wrong sender", quotePayload({ transactionRequest: { ...base.transactionRequest, from: target } }), expected()],
    ["wrong token", quotePayload({ action: { ...base.action, toToken: { address: target } } }), expected()],
    ["changed amount", quotePayload({ action: { ...base.action, fromAmount: "2000000" } }), expected()],
    ["bridge step", quotePayload({ includedSteps: [{ action: { fromChainId: 5042002, toChainId: 84532 } }] }), expected()],
  ];
  for (const [label, payload, expectation] of cases) assert.throws(() => normalizeLifiQuote(payload, expectation), undefined, label);
});

function expected(overrides: Partial<Parameters<typeof normalizeLifiQuote>[1]> = {}): Parameters<typeof normalizeLifiQuote>[1] {
  return { fromAssetId: "usdc", toAssetId: "eurc", fromAmount: "1000000", fromAddress: owner, ...overrides };
}

function quotePayload(overrides: Record<string, unknown> = {}) {
  const usdc = getAssetById("usdc")!;
  const eurc = getAssetById("eurc")!;
  return {
    id: "quote-safe",
    tool: "dex",
    action: { fromChainId: 5042002, toChainId: 5042002, fromAmount: "1000000", fromToken: { address: usdc.address }, toToken: { address: eurc.address } },
    estimate: { fromAmount: "1000000", toAmount: "999000", toAmountMin: "994000", approvalAddress: spender },
    transactionRequest: { to: target, from: owner, data: "0x1234", value: "0x0", chainId: 5042002 },
    ...overrides,
  };
}
