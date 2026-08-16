import { getAddress, isAddress, isHash, type Address, type Hash } from "viem";
import type { WalletActivity } from "./wallet";

const ACTIVITY_PREFIX = "makoto-wallet:activity:v1";
const MAX_ACTIVITY = 50;

type StorageLike = Pick<Storage, "getItem" | "setItem">;
type StoredActivity = Omit<WalletActivity, "amount"> & { amount: string };

export function walletActivityKey(address: Address, chainId: number) {
  return `${ACTIVITY_PREFIX}:${address.toLowerCase()}:${chainId}`;
}

export function serializeWalletActivity(records: WalletActivity[]) {
  const stored: StoredActivity[] = records.map((record) => ({ ...record, amount: record.amount.toString() }));
  return JSON.stringify(stored);
}

export function deserializeWalletActivity(payload: string): WalletActivity[] {
  try {
    const parsed: unknown = JSON.parse(payload);
    if (!Array.isArray(parsed)) return [];
    const records: WalletActivity[] = [];
    for (const item of parsed) {
      if (!isStoredActivity(item)) return [];
      records.push({
        hash: item.hash as Hash,
        direction: "send",
        amount: BigInt(item.amount),
        counterparty: getAddress(item.counterparty),
        confirmedAt: item.confirmedAt,
      });
    }
    return normalizeActivity(records);
  } catch {
    return [];
  }
}

export function loadWalletActivity(address: Address, chainId: number, storage = browserStorage()): WalletActivity[] {
  if (!storage) return [];
  try {
    const payload = storage.getItem(walletActivityKey(address, chainId));
    return payload ? deserializeWalletActivity(payload) : [];
  } catch {
    return [];
  }
}

export function saveWalletActivity(address: Address, chainId: number, records: WalletActivity[], storage = browserStorage()) {
  const normalized = normalizeActivity(records);
  if (!storage) return normalized;
  try {
    storage.setItem(walletActivityKey(address, chainId), serializeWalletActivity(normalized));
  } catch {
    // Storage can be unavailable or full. Confirmed onchain activity remains valid.
  }
  return normalized;
}

export function addWalletActivity(address: Address, chainId: number, record: WalletActivity, storage = browserStorage()) {
  return saveWalletActivity(address, chainId, [record, ...loadWalletActivity(address, chainId, storage)], storage);
}

function normalizeActivity(records: WalletActivity[]) {
  const byHash = new Map<string, WalletActivity>();
  for (const record of [...records].sort((a, b) => b.confirmedAt - a.confirmedAt)) {
    const key = record.hash.toLowerCase();
    if (!byHash.has(key)) byHash.set(key, record);
  }
  return [...byHash.values()].slice(0, MAX_ACTIVITY);
}

function isStoredActivity(value: unknown): value is StoredActivity {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.hash === "string" && isHash(item.hash)
    && item.direction === "send"
    && typeof item.amount === "string" && /^\d+$/.test(item.amount)
    && typeof item.counterparty === "string" && isAddress(item.counterparty)
    && typeof item.confirmedAt === "number" && Number.isFinite(item.confirmedAt) && item.confirmedAt >= 0;
}

function browserStorage(): StorageLike | undefined {
  return typeof window === "undefined" ? undefined : window.localStorage;
}
