import type { Address } from "viem";

const BALANCE_HISTORY_PREFIX = "makoto-wallet:balance-history:v1";
export const BALANCE_SNAPSHOT_DEDUP_MS = 15 * 60 * 1000;
export const MAX_BALANCE_SNAPSHOTS = 500;

export type BalanceHistoryRange = "1D" | "1W" | "1M" | "1Y" | "All";
export type BalanceSnapshot = { balance: bigint; timestamp: number };
type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function balanceHistoryKey(owner: Address, chainId: number, assetId: string) {
  return `${BALANCE_HISTORY_PREFIX}:${owner.toLowerCase()}:${chainId}:${assetId.toLowerCase()}`;
}

export function loadBalanceHistory(owner: Address, chainId: number, assetId: string, storage = browserStorage()): BalanceSnapshot[] {
  try {
    const raw = storage?.getItem(balanceHistoryKey(owner, chainId, assetId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length > MAX_BALANCE_SNAPSHOTS) return [];
    const snapshots = parsed.map(parseSnapshot);
    return snapshots.every(Boolean) ? (snapshots as BalanceSnapshot[]).sort((a, b) => a.timestamp - b.timestamp) : [];
  } catch { return []; }
}

export function recordBalanceSnapshot(owner: Address, chainId: number, assetId: string, balance: bigint, storage = browserStorage(), now = Date.now()) {
  const history = loadBalanceHistory(owner, chainId, assetId, storage);
  const last = history.at(-1);
  if (last && last.balance === balance && now - last.timestamp < BALANCE_SNAPSHOT_DEDUP_MS) return history;
  const next = [...history, { balance, timestamp: now }].slice(-MAX_BALANCE_SNAPSHOTS);
  try { storage?.setItem(balanceHistoryKey(owner, chainId, assetId), JSON.stringify(next, (_, value) => typeof value === "bigint" ? value.toString() : value)); } catch { /* Optional local history fails safely. */ }
  return next;
}

export function filterBalanceHistory(history: BalanceSnapshot[], range: BalanceHistoryRange, now = Date.now()) {
  const durations: Record<Exclude<BalanceHistoryRange, "All">, number> = {
    "1D": 24 * 60 * 60 * 1000,
    "1W": 7 * 24 * 60 * 60 * 1000,
    "1M": 30 * 24 * 60 * 60 * 1000,
    "1Y": 365 * 24 * 60 * 60 * 1000,
  };
  return range === "All" ? history : history.filter((snapshot) => snapshot.timestamp >= now - durations[range]);
}

export function balanceChange(history: BalanceSnapshot[]) {
  return history.length >= 2 ? history.at(-1)!.balance - history[0].balance : undefined;
}

function parseSnapshot(value: unknown): BalanceSnapshot | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const item = value as Record<string, unknown>;
  if (typeof item.balance !== "string" || !/^\d+$/.test(item.balance) || typeof item.timestamp !== "number" || !Number.isSafeInteger(item.timestamp) || item.timestamp < 0) return undefined;
  return { balance: BigInt(item.balance), timestamp: item.timestamp };
}

function browserStorage(): StorageLike | undefined { return typeof window === "undefined" ? undefined : window.localStorage; }
