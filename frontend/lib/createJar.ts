import { parseUnits, stringToBytes } from "viem";
import { normalizeDecimalInput } from "./decimalInput.ts";

export type CreateJarValues = { name: string; target: string; unlockLocal: string };
export type ParsedCreateJar = { name: string; targetAmount: bigint; unlockTime: bigint; unlockDate: Date };
export const MINIMUM_UNLOCK_BUFFER_MS = 5 * 60 * 1000;

export function parseCreateJar(values: CreateJarValues, now = Date.now()): ParsedCreateJar {
  const name = values.name.trim();
  if (!name) throw new Error("Give your jar a name.");
  if (stringToBytes(name).length > 64) throw new Error("Jar name must be 64 UTF-8 bytes or fewer.");
  const normalizedTarget = normalizeDecimalInput(values.target, 6);
  if (!normalizedTarget) {
    throw new Error("Enter a positive USDC target with no more than 6 decimal places.");
  }
  const targetAmount = parseUnits(normalizedTarget, 6);
  if (targetAmount <= 0n) throw new Error("Target amount must be greater than 0 USDC.");
  const unlockDate = new Date(values.unlockLocal);
  if (!values.unlockLocal || Number.isNaN(unlockDate.getTime())) throw new Error("Choose a valid unlock date and time.");
  if (unlockDate.getTime() < now + MINIMUM_UNLOCK_BUFFER_MS) {
    throw new Error("Choose a time at least 5 minutes from now.");
  }
  const unlockTime = BigInt(Math.floor(unlockDate.getTime() / 1000));
  if (unlockTime > 18_446_744_073_709_551_615n) throw new Error("Unlock time is outside the supported range.");
  return { name, targetAmount, unlockTime, unlockDate };
}

export function minimumUnlockLocal(now = Date.now()) {
  const minimumMinute = Math.ceil((now + MINIMUM_UNLOCK_BUFFER_MS) / 60_000) * 60_000;
  const date = new Date(minimumMinute);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export function defaultUnlockLocal() {
  return minimumUnlockLocal();
}
