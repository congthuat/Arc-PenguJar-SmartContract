import { parseUnits } from "viem";
import { normalizeDecimalInput } from "./decimalInput.ts";

export function parseDepositAmount(value: string) {
  return parseUsdcAmount(value, "Deposit");
}

export function parseContributionAmount(value: string) {
  return parseUsdcAmount(value, "Contribution");
}

function parseUsdcAmount(value: string, label: string) {
  const normalized = normalizeDecimalInput(value, 6);
  if (!normalized) {
    throw new Error("Enter a USDC amount with no more than 6 decimal places.");
  }
  const amount = parseUnits(normalized, 6);
  if (amount <= 0n) throw new Error(`${label} amount must be greater than 0 USDC.`);
  return amount;
}
