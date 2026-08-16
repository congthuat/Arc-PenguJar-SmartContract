import { getAddress, isAddress, parseUnits, type Address, type Hash } from "viem";
import type { SupportedAsset, SupportedAssetId } from "./assets";
const ARC_SCAN_URL = "https://testnet.arcscan.app";

export type WalletActivity = {
  hash: Hash;
  direction: "send";
  amount: bigint;
  counterparty: Address;
  confirmedAt: number;
  assetId: SupportedAssetId;
  assetSymbol: SupportedAsset["symbol"];
  tokenAddress: Address;
  decimals: number;
};

export function normalizeRecipient(value: string): Address | undefined {
  const trimmed = value.trim();
  return isAddress(trimmed) ? getAddress(trimmed) : undefined;
}

export function parseUsdcAmount(value: string): bigint | undefined {
  if (!/^\d+(\.\d{1,6})?$/.test(value.trim())) return undefined;
  try {
    const amount = parseUnits(value.trim(), 6);
    return amount > 0n ? amount : undefined;
  } catch {
    return undefined;
  }
}

export function isSelfSend(recipient: Address, sender?: Address) {
  return Boolean(sender && recipient.toLowerCase() === sender.toLowerCase());
}

export function maxUsdcAmount(balance: bigint) {
  return balance < 0n ? 0n : balance;
}

export function remainingUsdcBalance(balance: bigint, amount: bigint) {
  return amount > balance ? undefined : balance - amount;
}

export function validateUsdcSend(recipient: string, amount: string, balance: bigint, sender?: Address) {
  const address = normalizeRecipient(recipient);
  if (!address) return { error: "address" as const };
  if (isSelfSend(address, sender)) return { error: "self" as const };
  const parsedAmount = parseUsdcAmount(amount);
  if (!parsedAmount) return { error: "amount" as const };
  if (parsedAmount > balance) return { error: "balance" as const };
  return { address, amount: parsedAmount, remaining: balance - parsedAmount };
}

export function validateAssetSend(recipient: string, amount: string, balance: bigint, asset: SupportedAsset, sender?: Address) {
  const address = normalizeRecipient(recipient);
  if (!address) return { error: "address" as const };
  if (isSelfSend(address, sender)) return { error: "self" as const };
  if (!/^\d+(\.\d{1,6})?$/.test(amount.trim())) return { error: "amount" as const };
  let parsedAmount: bigint;
  try { parsedAmount = parseUnits(amount.trim(), asset.decimals); } catch { return { error: "amount" as const }; }
  if (parsedAmount <= 0n) return { error: "amount" as const };
  if (parsedAmount > balance) return { error: "balance" as const };
  return { address, amount: parsedAmount, remaining: balance - parsedAmount, tokenAddress: asset.address };
}

export const arcScanTransactionUrl = (hash: Hash | string) => `${ARC_SCAN_URL}/tx/${hash}`;
export const arcScanAddressUrl = (address: Address | string) => `${ARC_SCAN_URL}/address/${address}`;
