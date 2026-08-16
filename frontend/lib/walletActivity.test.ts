import assert from "node:assert/strict";
import test from "node:test";
import type { Address, Hash } from "viem";
import type { WalletActivity } from "./wallet.ts";
import { addWalletActivity, deserializeWalletActivity, loadWalletActivity, serializeWalletActivity, walletActivityKey } from "./walletActivity.ts";

const owner = "0x0000000000000000000000000000000000000001" as Address;
const recipient = "0x000000000000000000000000000000000000dEaD" as Address;

function activity(index: number, confirmedAt = index): WalletActivity {
  return { hash: `0x${index.toString(16).padStart(64, "0")}` as Hash, direction: "send", amount: BigInt(index + 1), counterparty: recipient, confirmedAt };
}

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

test("activity bigint serializes as a decimal string and restores to bigint", () => {
  const payload = serializeWalletActivity([activity(1)]);
  assert.equal(payload.includes('"amount":"2"'), true);
  assert.equal(deserializeWalletActivity(payload)[0].amount, 2n);
});

test("activity is newest first and duplicate hashes are deduplicated", () => {
  const storage = new MemoryStorage();
  addWalletActivity(owner, 5042002, activity(1, 100), storage);
  addWalletActivity(owner, 5042002, activity(2, 300), storage);
  addWalletActivity(owner, 5042002, { ...activity(1, 200), amount: 99n }, storage);
  const records = loadWalletActivity(owner, 5042002, storage);
  assert.deepEqual(records.map((item) => item.confirmedAt), [300, 200]);
  assert.equal(records.filter((item) => item.hash === activity(1).hash).length, 1);
});

test("malformed localStorage data fails safely", () => {
  const storage = new MemoryStorage();
  storage.setItem(walletActivityKey(owner, 5042002), "{not-json");
  assert.deepEqual(loadWalletActivity(owner, 5042002, storage), []);
  storage.setItem(walletActivityKey(owner, 5042002), JSON.stringify([{ amount: "bad" }]));
  assert.deepEqual(loadWalletActivity(owner, 5042002, storage), []);
});

test("activity is capped at 50 records", () => {
  const storage = new MemoryStorage();
  for (let index = 0; index < 55; index += 1) addWalletActivity(owner, 5042002, activity(index), storage);
  const records = loadWalletActivity(owner, 5042002, storage);
  assert.equal(records.length, 50);
  assert.equal(records[0].confirmedAt, 54);
});
