export const DEMO_VND_PER_USDC = 25_000;
export const TOP_UP_DENOMINATIONS = [20_000, 50_000, 100_000, 200_000, 500_000] as const;
export const DEMO_CARRIERS = ["Viettel", "VinaPhone", "MobiFone"] as const;

export type DemoCarrier = (typeof DEMO_CARRIERS)[number];

export function normalizeVietnamPhone(value: string) {
  return value.replace(/\s/g, "");
}

export function isValidVietnamDemoPhone(value: string) {
  return /^0\d{9}$/.test(normalizeVietnamPhone(value));
}

export function maskVietnamPhone(value: string) {
  const digits = normalizeVietnamPhone(value);
  if (!/^\d{10}$/.test(digits)) return "";
  return `${digits.slice(0, 4)} ••• ${digits.slice(-3)}`;
}

export function demoUsdcForVnd(vnd: number) {
  if (!TOP_UP_DENOMINATIONS.includes(vnd as (typeof TOP_UP_DENOMINATIONS)[number])) throw new Error("Unsupported demo denomination");
  return (vnd / DEMO_VND_PER_USDC).toFixed(2);
}

export function createDemoOrderId(randomValues: (values: Uint32Array) => Uint32Array = (values) => crypto.getRandomValues(values)) {
  const values = randomValues(new Uint32Array(2));
  return `MKT-DEMO-${[...values].map((value) => value.toString(16).padStart(8, "0")).join("").toUpperCase()}`;
}
