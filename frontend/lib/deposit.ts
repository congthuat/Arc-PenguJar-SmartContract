import { parseUnits } from "viem";

export function parseDepositAmount(value: string) {
  return parseUsdcAmount(value, "Deposit");
}

export function parseContributionAmount(value: string) {
  return parseUsdcAmount(value, "Contribution");
}

function parseUsdcAmount(value: string, label: string) {
  const normalized = value.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(normalized)) {
    throw new Error("Enter a USDC amount with no more than 6 decimal places.");
  }
  const amount = parseUnits(normalized, 6);
  if (amount <= 0n) throw new Error(`${label} amount must be greater than 0 USDC.`);
  return amount;
}
