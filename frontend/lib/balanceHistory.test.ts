import assert from "node:assert/strict";
import test from "node:test";
import type { Address } from "viem";
import { BALANCE_SNAPSHOT_DEDUP_MS, balanceChange, balanceHistoryKey, filterBalanceHistory, loadBalanceHistory, recordBalanceSnapshot } from "./balanceHistory.ts";

const owner = "0x0000000000000000000000000000000000000001" as Address;
const other = "0x0000000000000000000000000000000000000002" as Address;
class MemoryStorage { data = new Map<string, string>(); getItem(key: string) { return this.data.get(key) ?? null; } setItem(key: string, value: string) { this.data.set(key, value); } }

test("real bigint balance snapshots round-trip without numeric fabrication", () => {
  const storage = new MemoryStorage();
  recordBalanceSnapshot(owner, 5042002, "usdc", 1234567n, storage, 100);
  assert.deepEqual(loadBalanceHistory(owner, 5042002, "usdc", storage), [{ balance: 1234567n, timestamp: 100 }]);
});

test("balance history is isolated by wallet, chain, and asset", () => {
  const storage = new MemoryStorage();
  recordBalanceSnapshot(owner, 5042002, "usdc", 1n, storage, 1);
  assert.equal(loadBalanceHistory(other, 5042002, "usdc", storage).length, 0);
  assert.equal(loadBalanceHistory(owner, 1, "usdc", storage).length, 0);
  assert.equal(loadBalanceHistory(owner, 5042002, "eurc", storage).length, 0);
  assert.notEqual(balanceHistoryKey(owner, 5042002, "usdc"), balanceHistoryKey(other, 5042002, "usdc"));
});

test("unchanged recent balances deduplicate while changes and later observations persist", () => {
  const storage = new MemoryStorage();
  recordBalanceSnapshot(owner, 5042002, "usdc", 10n, storage, 100);
  assert.equal(recordBalanceSnapshot(owner, 5042002, "usdc", 10n, storage, 101).length, 1);
  assert.equal(recordBalanceSnapshot(owner, 5042002, "usdc", 11n, storage, 102).length, 2);
  assert.equal(recordBalanceSnapshot(owner, 5042002, "usdc", 11n, storage, 102 + BALANCE_SNAPSHOT_DEDUP_MS).length, 3);
});

test("time filters retain only real observations in the selected window", () => {
  const day = 24 * 60 * 60 * 1000; const now = 400 * day;
  const history = [{ balance: 1n, timestamp: now - 366 * day }, { balance: 2n, timestamp: now - 20 * day }, { balance: 3n, timestamp: now - 3 * day }, { balance: 4n, timestamp: now - 2 * 60 * 60 * 1000 }];
  assert.deepEqual(filterBalanceHistory(history, "1D", now).map((x) => x.balance), [4n]);
  assert.deepEqual(filterBalanceHistory(history, "1W", now).map((x) => x.balance), [3n, 4n]);
  assert.deepEqual(filterBalanceHistory(history, "1M", now).map((x) => x.balance), [2n, 3n, 4n]);
  assert.equal(filterBalanceHistory(history, "1Y", now).length, 3);
  assert.equal(filterBalanceHistory(history, "All", now).length, 4);
});

test("change and insufficient-history states never synthesize points", () => {
  assert.equal(balanceChange([]), undefined);
  assert.equal(balanceChange([{ balance: 5n, timestamp: 1 }]), undefined);
  assert.equal(balanceChange([{ balance: 5n, timestamp: 1 }, { balance: 8n, timestamp: 2 }]), 3n);
});
