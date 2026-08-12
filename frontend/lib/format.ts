import { type Address } from "viem";

const amountFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

export function formatUsdc(amount: bigint) {
  const whole = amount / 1_000_000n;
  const fraction = (amount % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return `${amountFormatter.format(whole)}${fraction ? `.${fraction}` : ""}`;
}

export function progressPercent(balance: bigint, target: bigint) {
  if (target === 0n) return 0;
  return Math.min(100, Number((balance * 10_000n) / target) / 100);
}

export function formatDate(timestamp: bigint) {
  return formatLocalDateTime(new Date(Number(timestamp) * 1000));
}

export function formatLocalDateTime(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.day}/${value.month}/${value.year} ${value.hour}:${value.minute}`;
}

export function shortAddress(address: Address | string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function jarStatus(unlockTime: bigint, closed: boolean) {
  if (closed) return "Closed";
  return BigInt(Math.floor(Date.now() / 1000)) >= unlockTime ? "Unlocked" : "Locked";
}
