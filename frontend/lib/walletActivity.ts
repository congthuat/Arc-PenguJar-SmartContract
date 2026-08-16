import { getAddress, isAddress, isHash, type Address, type Hash } from "viem";
import { getAssetById, type SupportedAsset } from "./assets.ts";
import type { WalletActivity } from "./wallet";

const V2_PREFIX = "makoto-wallet:activity:v2";
const V1_PREFIX = "makoto-wallet:activity:v1";
const MAX_ACTIVITY = 50;
type StorageLike = Pick<Storage, "getItem" | "setItem">;
type StoredActivity = Omit<WalletActivity, "amount"> & { amount: string };
type LegacyActivity = Pick<StoredActivity, "hash" | "direction" | "amount" | "counterparty" | "confirmedAt">;

export function walletActivityKey(address: Address, chainId: number) { return `${V2_PREFIX}:${address.toLowerCase()}:${chainId}`; }
export function legacyWalletActivityKey(address: Address, chainId: number) { return `${V1_PREFIX}:${address.toLowerCase()}:${chainId}`; }

export function createAssetActivity(asset: SupportedAsset, record: Omit<WalletActivity, "assetId" | "assetSymbol" | "tokenAddress" | "decimals">): WalletActivity {
  return { ...record, assetId: asset.id, assetSymbol: asset.symbol, tokenAddress: asset.address, decimals: asset.decimals };
}

export function serializeWalletActivity(records: WalletActivity[]) {
  return JSON.stringify(records.map((record) => ({ ...record, amount: record.amount.toString() })) satisfies StoredActivity[]);
}

export function deserializeWalletActivity(payload: string): WalletActivity[] {
  try {
    const parsed: unknown = JSON.parse(payload);
    if (!Array.isArray(parsed)) return [];
    const records: WalletActivity[] = [];
    for (const item of parsed) {
      if (!isStoredActivity(item)) return [];
      const asset = getAssetById(item.assetId);
      if (!asset || item.assetSymbol !== asset.symbol || item.tokenAddress.toLowerCase() !== asset.address.toLowerCase() || item.decimals !== asset.decimals) return [];
      records.push({ ...item, hash: item.hash as Hash, direction: "send", amount: BigInt(item.amount), counterparty: getAddress(item.counterparty), tokenAddress: asset.address, assetId: asset.id, assetSymbol: asset.symbol, decimals: asset.decimals });
    }
    return normalizeActivity(records);
  } catch { return []; }
}

function deserializeLegacyActivity(payload: string): WalletActivity[] {
  try {
    const parsed: unknown = JSON.parse(payload);
    if (!Array.isArray(parsed)) return [];
    const usdc = getAssetById("usdc")!;
    const records: WalletActivity[] = [];
    for (const item of parsed) {
      if (!isLegacyActivity(item)) return [];
      records.push(createAssetActivity(usdc, { hash: item.hash as Hash, direction: "send", amount: BigInt(item.amount), counterparty: getAddress(item.counterparty), confirmedAt: item.confirmedAt }));
    }
    return normalizeActivity(records);
  } catch { return []; }
}

export function loadWalletActivity(address: Address, chainId: number, storage = browserStorage()): WalletActivity[] {
  if (!storage) return [];
  try {
    const v2 = storage.getItem(walletActivityKey(address, chainId));
    if (v2 !== null) return deserializeWalletActivity(v2);
    const v1 = storage.getItem(legacyWalletActivityKey(address, chainId));
    if (v1 === null) return [];
    const migrated = deserializeLegacyActivity(v1);
    storage.setItem(walletActivityKey(address, chainId), serializeWalletActivity(migrated));
    return migrated;
  } catch { return []; }
}

export function saveWalletActivity(address: Address, chainId: number, records: WalletActivity[], storage = browserStorage()) {
  const normalized = normalizeActivity(records);
  try { storage?.setItem(walletActivityKey(address, chainId), serializeWalletActivity(normalized)); } catch { /* confirmed onchain data remains valid */ }
  return normalized;
}

export function addWalletActivity(address: Address, chainId: number, record: WalletActivity, storage = browserStorage()) {
  return saveWalletActivity(address, chainId, [record, ...loadWalletActivity(address, chainId, storage)], storage);
}

function normalizeActivity(records: WalletActivity[]) {
  const byHash = new Map<string, WalletActivity>();
  for (const record of [...records].sort((a, b) => b.confirmedAt - a.confirmedAt)) if (!byHash.has(record.hash.toLowerCase())) byHash.set(record.hash.toLowerCase(), record);
  return [...byHash.values()].slice(0, MAX_ACTIVITY);
}

function isBaseActivity(item: Record<string, unknown>) {
  return typeof item.hash === "string" && isHash(item.hash) && item.direction === "send" && typeof item.amount === "string" && /^\d+$/.test(item.amount) && typeof item.counterparty === "string" && isAddress(item.counterparty) && typeof item.confirmedAt === "number" && Number.isFinite(item.confirmedAt) && item.confirmedAt >= 0;
}

function isLegacyActivity(value: unknown): value is LegacyActivity { return Boolean(value && typeof value === "object" && isBaseActivity(value as Record<string, unknown>)); }
function isStoredActivity(value: unknown): value is StoredActivity {
  if (!value || typeof value !== "object" || !isBaseActivity(value as Record<string, unknown>)) return false;
  const item = value as Record<string, unknown>;
  return typeof item.assetId === "string" && typeof item.assetSymbol === "string" && typeof item.tokenAddress === "string" && isAddress(item.tokenAddress) && typeof item.decimals === "number";
}

function browserStorage(): StorageLike | undefined { return typeof window === "undefined" ? undefined : window.localStorage; }
