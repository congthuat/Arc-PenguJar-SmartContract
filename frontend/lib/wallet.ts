import { getAddress, isAddress, parseUnits, type Address, type Hash } from "viem";
const ARC_SCAN_URL = "https://testnet.arcscan.app";

export type WalletActivity = {
  hash: Hash;
  direction: "send";
  amount: bigint;
  counterparty: Address;
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

export function validateUsdcSend(recipient: string, amount: string, balance: bigint) {
  const address = normalizeRecipient(recipient);
  if (!address) return { error: "address" as const };
  const parsedAmount = parseUsdcAmount(amount);
  if (!parsedAmount) return { error: "amount" as const };
  if (parsedAmount > balance) return { error: "balance" as const };
  return { address, amount: parsedAmount };
}

export const arcScanTransactionUrl = (hash: Hash | string) => `${ARC_SCAN_URL}/tx/${hash}`;
export const arcScanAddressUrl = (address: Address | string) => `${ARC_SCAN_URL}/address/${address}`;
