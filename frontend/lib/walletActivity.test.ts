import assert from "node:assert/strict";
import test from "node:test";
import type { Address, Hash } from "viem";

import { getAssetById } from "./assets.ts";
import type { WalletActivity } from "./wallet.ts";
import { addWalletActivity, createAssetActivity, deserializeWalletActivity, legacyWalletActivityKey, loadWalletActivity, mergeWalletActivity, serializeWalletActivity, v2WalletActivityKey, walletActivityKey } from "./walletActivity.ts";

const owner = "0x0000000000000000000000000000000000000001" as Address;
const recipient = "0x000000000000000000000000000000000000dEaD" as Address;
const asset = (id: "usdc" | "eurc") => getAssetById(id)!;
function activity(index: number, id: "usdc" | "eurc" = "usdc", confirmedAt = index, logIndex = index): WalletActivity {
  return createAssetActivity(asset(id), { hash: `0x${index.toString(16).padStart(64, "0")}` as Hash, logIndex, direction: "send", kind: "transfer", amount: BigInt(index + 1), counterparty: recipient, confirmedAt, blockNumber: BigInt(index) });
}
class MemoryStorage { values = new Map<string, string>(); getItem(key: string) { return this.values.get(key) ?? null; } setItem(key: string, value: string) { this.values.set(key, value); } }

test("v3 retains exact USDC and EURC identity and bigint fields", () => {
  const restored = deserializeWalletActivity(serializeWalletActivity([activity(1, "usdc"), activity(2, "eurc")]));
  assert.deepEqual(restored.map((item) => item.assetSymbol), ["EURC", "USDC"]);
  assert.equal(restored[0].blockNumber, 2n);
});

test("v1 records migrate safely to v3 optimistic USDC records", () => {
  const storage = new MemoryStorage();
  storage.setItem(legacyWalletActivityKey(owner, 5042002), JSON.stringify([{ hash: activity(1).hash, direction: "send", amount: "2", counterparty: recipient, confirmedAt: 10 }]));
  const migrated = loadWalletActivity(owner, 5042002, storage);
  assert.equal(migrated[0].assetId, "usdc");
  assert.equal(migrated[0].logIndex, -1);
  assert.notEqual(storage.getItem(walletActivityKey(owner, 5042002)), null);
});

test("v2 records migrate safely and preserve EURC", () => {
  const storage = new MemoryStorage();
  const old = { hash: activity(1).hash, direction: "send", amount: "2", counterparty: recipient, confirmedAt: 10, assetId: "eurc", assetSymbol: "EURC", tokenAddress: asset("eurc").address, decimals: 6 };
  storage.setItem(v2WalletActivityKey(owner, 5042002), JSON.stringify([old]));
  assert.equal(loadWalletActivity(owner, 5042002, storage)[0].assetId, "eurc");
});

test("local optimistic record does not duplicate its canonical on-chain transfer", () => {
  const canonical = activity(4, "usdc", 200, 7);
  const optimistic = { ...canonical, logIndex: -1 };
  assert.deepEqual(mergeWalletActivity([canonical], [optimistic]), [canonical]);
});

test("same hash can retain multiple token transfer logs", () => {
  const usdc = activity(5, "usdc", 100, 1);
  const eurc = { ...activity(6, "eurc", 100, 2), hash: usdc.hash };
  assert.equal(mergeWalletActivity([usdc, eurc], []).length, 2);
});

test("malformed v3 and legacy payloads fail safely", () => {
  assert.deepEqual(deserializeWalletActivity(JSON.stringify([{ amount: "bad" }])), []);
  const storage = new MemoryStorage(); storage.setItem(v2WalletActivityKey(owner, 5042002), "{bad");
  assert.deepEqual(loadWalletActivity(owner, 5042002, storage), []);
});

test("activity remains capped at 50 records", () => {
  const storage = new MemoryStorage();
  for (let index = 0; index < 55; index += 1) addWalletActivity(owner, 5042002, activity(index), storage);
  assert.equal(loadWalletActivity(owner, 5042002, storage).length, 50);
});
