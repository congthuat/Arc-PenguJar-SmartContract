import assert from "node:assert/strict";
import test from "node:test";
import type { Address, Hash } from "viem";
import { getAssetById } from "./assets.ts";
import type { WalletActivity } from "./wallet.ts";
import { addWalletActivity, createAssetActivity, deserializeWalletActivity, legacyWalletActivityKey, loadWalletActivity, serializeWalletActivity, walletActivityKey } from "./walletActivity.ts";

const owner = "0x0000000000000000000000000000000000000001" as Address;
const recipient = "0x000000000000000000000000000000000000dEaD" as Address;
const asset = (id: "usdc" | "eurc") => getAssetById(id)!;
function activity(index: number, id: "usdc" | "eurc" = "usdc", confirmedAt = index): WalletActivity {
  return createAssetActivity(asset(id), { hash: `0x${index.toString(16).padStart(64, "0")}` as Hash, direction: "send", amount: BigInt(index + 1), counterparty: recipient, confirmedAt });
}
class MemoryStorage { values = new Map<string, string>(); getItem(key: string) { return this.values.get(key) ?? null; } setItem(key: string, value: string) { this.values.set(key, value); } }

test("v2 retains exact USDC and EURC identity", () => {
  const restored = deserializeWalletActivity(serializeWalletActivity([activity(1, "usdc"), activity(2, "eurc")]));
  assert.deepEqual(restored.map((item) => item.assetSymbol), ["EURC", "USDC"]);
  assert.equal(restored[0].tokenAddress, asset("eurc").address);
});

test("v1 records migrate once to v2 as USDC", () => {
  const storage = new MemoryStorage();
  const legacy = { hash: activity(1).hash, direction: "send", amount: "2", counterparty: recipient, confirmedAt: 10 };
  storage.setItem(legacyWalletActivityKey(owner, 5042002), JSON.stringify([legacy]));
  const migrated = loadWalletActivity(owner, 5042002, storage);
  assert.equal(migrated[0].assetId, "usdc");
  assert.equal(storage.getItem(walletActivityKey(owner, 5042002)) !== null, true);
});

test("mixed activity is newest first and deduplicated by hash", () => {
  const storage = new MemoryStorage();
  addWalletActivity(owner, 5042002, activity(1, "usdc", 100), storage);
  addWalletActivity(owner, 5042002, activity(2, "eurc", 300), storage);
  addWalletActivity(owner, 5042002, { ...activity(1, "usdc", 200), amount: 99n }, storage);
  const records = loadWalletActivity(owner, 5042002, storage);
  assert.deepEqual(records.map((item) => [item.assetSymbol, item.confirmedAt]), [["EURC", 300], ["USDC", 200]]);
});

test("malformed v1 and v2 fail safely", () => {
  const v1 = new MemoryStorage(); v1.setItem(legacyWalletActivityKey(owner, 5042002), "{bad");
  assert.deepEqual(loadWalletActivity(owner, 5042002, v1), []);
  const v2 = new MemoryStorage(); v2.setItem(walletActivityKey(owner, 5042002), JSON.stringify([{ amount: "bad" }]));
  assert.deepEqual(loadWalletActivity(owner, 5042002, v2), []);
});

test("activity remains capped at 50 records", () => {
  const storage = new MemoryStorage();
  for (let index = 0; index < 55; index += 1) addWalletActivity(owner, 5042002, activity(index, index % 2 ? "eurc" : "usdc"), storage);
  const records = loadWalletActivity(owner, 5042002, storage);
  assert.equal(records.length, 50); assert.equal(records[0].confirmedAt, 54);
});
