export const APP_LOCK_STORAGE_KEY = "makoto-wallet:app-lock:v1";
export const APP_LOCK_SIGNAL_KEY = "makoto-wallet:app-lock-signal:v1";
export const APP_LOCK_ITERATIONS = 210_000;
export const AUTO_LOCK_OPTIONS = [60_000, 300_000, 900_000, 1_800_000, 0] as const;

export type AppLockConfig = {
  version: 1;
  salt: string;
  verifier: string;
  iterations: number;
  autoLockMs: number;
  failedAttempts: number;
  cooldownLevel: number;
  cooldownUntil: number;
};

export type AppLockSignalAction = "lock" | "disable" | "reset";
export type AppLockSessionState = { config?: AppLockConfig; locked: boolean };

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

export function isValidPin(pin: string) { return /^\d{6}$/.test(pin); }
export function isWeakPin(pin: string) { return /^(\d)\1{5}$/.test(pin) || pin === "123456" || pin === "654321"; }
export function pinsMatch(pin: string, confirmation: string) { return isValidPin(pin) && pin === confirmation; }
export function inactivityExpired(lastActivity: number, autoLockMs: number, now: number) { return autoLockMs > 0 && now >= lastActivity + autoLockMs; }
export function cooldownDuration(level: number) { return Math.min(30_000 * 2 ** Math.max(0, level), 900_000); }
export function recordFailedAttempt(config: AppLockConfig, now: number) { const failures = config.failedAttempts + 1; const cooldown = failures >= 5; return { ...config, failedAttempts: cooldown ? 0 : failures, cooldownLevel: cooldown ? config.cooldownLevel + 1 : config.cooldownLevel, cooldownUntil: cooldown ? now + cooldownDuration(config.cooldownLevel) : 0 }; }
export function resetFailedAttempts(config: AppLockConfig) { return { ...config, failedAttempts: 0, cooldownLevel: 0, cooldownUntil: 0 }; }

export async function createAppLockConfig(pin: string, autoLockMs: number, cryptoApi: Crypto = crypto): Promise<AppLockConfig> {
  if (!isValidPin(pin) || !AUTO_LOCK_OPTIONS.includes(autoLockMs as (typeof AUTO_LOCK_OPTIONS)[number])) throw new Error("Invalid App Lock configuration.");
  const salt = cryptoApi.getRandomValues(new Uint8Array(16));
  return { version: 1, salt: bytesToBase64(salt), verifier: await deriveVerifier(pin, salt, APP_LOCK_ITERATIONS, cryptoApi), iterations: APP_LOCK_ITERATIONS, autoLockMs, failedAttempts: 0, cooldownLevel: 0, cooldownUntil: 0 };
}

export async function verifyAppLockPin(pin: string, config: AppLockConfig, cryptoApi: Crypto = crypto) {
  if (!isValidPin(pin)) return false;
  const actual = base64ToBytes(await deriveVerifier(pin, base64ToBytes(config.salt), config.iterations, cryptoApi));
  const expected = base64ToBytes(config.verifier);
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) difference |= actual[index] ^ expected[index];
  return difference === 0;
}

export function parseAppLockConfig(raw: string | null): AppLockConfig | undefined {
  try {
    const value: unknown = raw ? JSON.parse(raw) : undefined;
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
    const item = value as Record<string, unknown>;
    if (item.version !== 1 || typeof item.salt !== "string" || typeof item.verifier !== "string" || item.iterations !== APP_LOCK_ITERATIONS || typeof item.autoLockMs !== "number" || !AUTO_LOCK_OPTIONS.includes(item.autoLockMs as never) || !safeNumber(item.failedAttempts) || !safeNumber(item.cooldownLevel) || !safeNumber(item.cooldownUntil)) return undefined;
    return value as AppLockConfig;
  } catch { return undefined; }
}

export function initialAppLockState(raw: string | null): AppLockSessionState {
  const config = parseAppLockConfig(raw);
  return { config, locked: Boolean(config) };
}

export function parseAppLockSignal(raw: string | null): AppLockSignalAction | undefined {
  try {
    const value: unknown = raw ? JSON.parse(raw) : undefined;
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
    const action = (value as Record<string, unknown>).action;
    return action === "lock" || action === "disable" || action === "reset" ? action : undefined;
  } catch { return undefined; }
}

export function syncAppLockStorageEvent(
  state: AppLockSessionState,
  key: string | null,
  configRaw: string | null,
  signalRaw: string | null,
): AppLockSessionState {
  if (key === APP_LOCK_STORAGE_KEY) return { config: parseAppLockConfig(configRaw), locked: state.locked };
  if (key !== APP_LOCK_SIGNAL_KEY) return state;
  const action = parseAppLockSignal(signalRaw);
  if (action === "disable" || action === "reset") return { config: undefined, locked: false };
  if (action === "lock") {
    const config = parseAppLockConfig(configRaw);
    return { config, locked: Boolean(config) };
  }
  return state;
}

export function clearMakotoConvenienceData(storage: StorageLike) {
  const prefixes = ["makoto-wallet:contacts:v1", "makoto-wallet:recent-recipients:v1", "makoto-wallet:activity:v1", "makoto-wallet:activity:v2", "makoto-wallet:activity:v3"];
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) { const key = storage.key(index); if (key && prefixes.some((prefix) => key.startsWith(prefix))) keys.push(key); }
  for (const key of keys) storage.removeItem(key);
  storage.removeItem(APP_LOCK_STORAGE_KEY);
  storage.removeItem(APP_LOCK_SIGNAL_KEY);
  return keys;
}

async function deriveVerifier(pin: string, salt: Uint8Array, iterations: number, cryptoApi: Crypto) {
  const key = await cryptoApi.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await cryptoApi.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations }, key, 256);
  return bytesToBase64(new Uint8Array(bits));
}
function bytesToBase64(bytes: Uint8Array) { let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary); }
function base64ToBytes(value: string) { return Uint8Array.from(atob(value), (character) => character.charCodeAt(0)); }
function safeNumber(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0; }
