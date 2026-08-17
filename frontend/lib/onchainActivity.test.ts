import assert from "node:assert/strict";
import test from "node:test";
import type { Address } from "viem";

import { getAssetById } from "./assets.ts";
import { CCTP_TOKEN_MINTER_V2 } from "./cctp.ts";
import { XYLO_POOL, XYLO_ROUTER } from "./swap.ts";
import { decodeArcScanCursor, deserializeWalletActivityPage, encodeArcScanCursor, parseArcScanActivity, serializeWalletActivityPage } from "./onchainActivity.ts";

const wallet = "0x1111111111111111111111111111111111111111" as Address;
const other = "0x2222222222222222222222222222222222222222";
const usdc = getAssetById("usdc")!;
const eurc = getAssetById("eurc")!;

function transfer(overrides: Record<string, unknown> = {}) {
  return {
    block_number: 100,
    from: { hash: other },
    log_index: 3,
    timestamp: "2026-08-17T04:16:21.000Z",
    to: { hash: wallet },
    token: { address_hash: usdc.address },
    total: { value: "18000000" },
    transaction_hash: `0x${"a".repeat(64)}`,
    ...overrides,
  };
}

test("external USDC incoming transfer becomes Receive", () => {
  const [item] = parseArcScanActivity({ items: [transfer()] }, wallet).activities;
  assert.equal(item.direction, "receive"); assert.equal(item.amount, 18_000_000n); assert.equal(item.counterparty, other);
});

test("external EURC outgoing transfer becomes Send", () => {
  const [item] = parseArcScanActivity({ items: [transfer({ from: { hash: wallet }, to: { hash: other }, token: { address_hash: eurc.address } })] }, wallet).activities;
  assert.equal(item.direction, "send"); assert.equal(item.assetId, "eurc");
});

test("CCTP V2 burn is deterministically classified as Bridge", () => {
  const [item] = parseArcScanActivity({ items: [transfer({ from: { hash: wallet }, to: { hash: CCTP_TOKEN_MINTER_V2 }, method: "depositForBurnWithHook" })] }, wallet).activities;
  assert.equal(item.kind, "bridge"); assert.equal(item.direction, "send"); assert.equal(item.amount, 18_000_000n);
});

test("ordinary sends to the CCTP minter are not guessed as Bridge", () => {
  const [item] = parseArcScanActivity({ items: [transfer({ from: { hash: wallet }, to: { hash: CCTP_TOKEN_MINTER_V2 }, method: "transfer" })] }, wallet).activities;
  assert.equal(item.kind, "transfer");
});

test("unsupported token and zero transfer are ignored", () => {
  const unsupported = transfer({ token: { address_hash: "0x3333333333333333333333333333333333333333" } });
  const zero = transfer({ total: { value: "0" } });
  assert.deepEqual(parseArcScanActivity({ items: [unsupported, zero] }, wallet).activities, []);
});

test("malformed explorer records are ignored safely", () => {
  assert.deepEqual(parseArcScanActivity({ items: [transfer({ transaction_hash: "bad" }), null, {}] }, wallet).activities, []);
  assert.throws(() => parseArcScanActivity({ nope: [] }, wallet));
});

test("duplicate transfer uses hash plus log index plus token identity", () => {
  assert.equal(parseArcScanActivity({ items: [transfer(), transfer()] }, wallet).activities.length, 1);
});

test("same transaction retains multiple supported-token Transfer logs", () => {
  const second = transfer({ log_index: 4, token: { address_hash: eurc.address }, total: { value: "10" } });
  assert.equal(parseArcScanActivity({ items: [transfer(), second] }, wallet).activities.length, 2);
});

test("verified XyloNet legs group into one Swap with exact output", () => {
  const hash = `0x${"c".repeat(64)}`;
  const sold = transfer({ transaction_hash: hash, from: { hash: wallet }, to: { hash: XYLO_ROUTER }, log_index: 2 });
  const bought = transfer({ transaction_hash: hash, from: { hash: XYLO_POOL }, to: { hash: wallet }, token: { address_hash: eurc.address }, total: { value: "15500000" }, log_index: 5 });
  const page = parseArcScanActivity({ items: [sold, bought] }, wallet);
  assert.equal(page.activities.length, 1); assert.equal(page.activities[0].kind, "swap"); assert.equal(page.activities[0].swapReceive?.amount, 15_500_000n); assert.equal(page.activities[0].swapReceive?.assetId, "eurc");
  const restored = deserializeWalletActivityPage(serializeWalletActivityPage(page));
  assert.equal(restored.activities[0].swapReceive?.amount, 15_500_000n);
});

test("unverified counterparties never group as XyloNet swap", () => {
  const hash = `0x${"d".repeat(64)}`;
  const records = [transfer({ transaction_hash: hash, from: { hash: wallet }, to: { hash: other } }), transfer({ transaction_hash: hash, from: { hash: other }, token: { address_hash: eurc.address }, log_index: 4 })];
  assert.equal(parseArcScanActivity({ items: records }, wallet).activities.every((item) => item.kind === "transfer"), true);
});

test("activity sorts newest block and log first", () => {
  const page = parseArcScanActivity({ items: [transfer({ block_number: 99, log_index: 8 }), transfer({ block_number: 100, log_index: 1, transaction_hash: `0x${"b".repeat(64)}` })] }, wallet);
  assert.equal(page.activities[0].blockNumber, 100n);
});

test("empty explorer response stays empty", () => {
  assert.deepEqual(parseArcScanActivity({ items: [] }, wallet), { activities: [] });
});

test("pagination cursor round-trips and rejects malformed values", () => {
  const cursor = encodeArcScanCursor({ block_number: 123, index: 7 })!;
  assert.deepEqual(decodeArcScanCursor(cursor), { block_number: 123, index: 7 });
  assert.equal(decodeArcScanCursor("../../bad"), undefined);
});

test("sanitized API page serializes and deserializes exact bigint values", () => {
  const page = parseArcScanActivity({ items: [transfer()], next_page_params: { block_number: 99, index: 2 } }, wallet);
  const restored = deserializeWalletActivityPage(serializeWalletActivityPage(page));
  assert.equal(restored.activities[0].amount, 18_000_000n); assert.equal(restored.nextCursor, "99.2");
});
