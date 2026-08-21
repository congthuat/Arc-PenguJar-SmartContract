"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { APP_LOCK_SIGNAL_KEY, APP_LOCK_STORAGE_KEY, AUTO_LOCK_OPTIONS, clearMakotoConvenienceData, createAppLockConfig, inactivityExpired, parseAppLockConfig, recordFailedAttempt, resetFailedAttempts, verifyAppLockPin, type AppLockConfig } from "@/lib/appLock";

type UnlockResult = "success" | "wrong" | "cooldown";
type AppLockContextValue = {
  initialized: boolean; available: boolean; enabled: boolean; locked: boolean; config?: AppLockConfig;
  unlock(pin: string): Promise<UnlockResult>; lock(): void; setup(pin: string, autoLockMs: number): Promise<void>;
  changePin(current: string, next: string): Promise<boolean>; setAutoLockMs(value: number): void; disable(pin: string): Promise<boolean>; reset(): void;
};
const AppLockContext = createContext<AppLockContextValue | undefined>(undefined);

export function AppLockProvider({ children }: { children: ReactNode }) {
  const [initialized, setInitialized] = useState(false);
  const [available, setAvailable] = useState(true);
  const [config, setConfig] = useState<AppLockConfig>();
  const [locked, setLocked] = useState(false);
  const lastActivity = useRef(0);

  const persist = useCallback((next?: AppLockConfig) => { setConfig(next); if (next) localStorage.setItem(APP_LOCK_STORAGE_KEY, JSON.stringify(next)); else localStorage.removeItem(APP_LOCK_STORAGE_KEY); }, []);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      const usable = Boolean(globalThis.crypto?.subtle && globalThis.crypto?.getRandomValues);
      const stored = usable ? parseAppLockConfig(localStorage.getItem(APP_LOCK_STORAGE_KEY)) : undefined;
      lastActivity.current = Date.now(); setAvailable(usable); setConfig(stored); setLocked(Boolean(stored)); setInitialized(true);
    });
    return () => { active = false; };
  }, []);

  const lock = useCallback(() => { if (!config) return; setLocked(true); localStorage.setItem(APP_LOCK_SIGNAL_KEY, JSON.stringify({ action: "lock", at: Date.now() })); }, [config]);
  const unlock = useCallback(async (pin: string): Promise<UnlockResult> => {
    if (!config) return "success";
    const now = Date.now();
    if (config.cooldownUntil > now) return "cooldown";
    if (await verifyAppLockPin(pin, config)) { persist(resetFailedAttempts(config)); lastActivity.current = now; setLocked(false); return "success"; }
    const next = recordFailedAttempt(config, now); persist(next);
    return next.cooldownUntil > now ? "cooldown" : "wrong";
  }, [config, persist]);
  const setup = useCallback(async (pin: string, autoLockMs: number) => { const next = await createAppLockConfig(pin, autoLockMs); persist(next); lastActivity.current = Date.now(); setLocked(false); }, [persist]);
  const changePin = useCallback(async (current: string, nextPin: string) => { if (!config || !(await verifyAppLockPin(current, config))) return false; persist(await createAppLockConfig(nextPin, config.autoLockMs)); return true; }, [config, persist]);
  const setAutoLockMs = useCallback((value: number) => { if (config && AUTO_LOCK_OPTIONS.includes(value as never)) persist({ ...config, autoLockMs: value }); }, [config, persist]);
  const disable = useCallback(async (pin: string) => { if (!config || !(await verifyAppLockPin(pin, config))) return false; persist(undefined); setLocked(false); localStorage.setItem(APP_LOCK_SIGNAL_KEY, JSON.stringify({ action: "disable", at: Date.now() })); return true; }, [config, persist]);
  const reset = useCallback(() => { clearMakotoConvenienceData(localStorage); persist(undefined); setLocked(false); localStorage.setItem(APP_LOCK_SIGNAL_KEY, JSON.stringify({ action: "reset", at: Date.now() })); }, [persist]);

  useEffect(() => {
    if (!config || locked) return;
    const activity = () => { lastActivity.current = Date.now(); };
    const check = () => { if (inactivityExpired(lastActivity.current, config.autoLockMs, Date.now())) lock(); };
    const events: (keyof WindowEventMap)[] = ["pointerdown", "keydown", "touchstart"];
    events.forEach((event) => window.addEventListener(event, activity, { passive: true }));
    const timer = config.autoLockMs ? window.setInterval(check, Math.min(30_000, config.autoLockMs)) : undefined;
    const visibility = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", visibility);
    return () => { events.forEach((event) => window.removeEventListener(event, activity)); if (timer) window.clearInterval(timer); document.removeEventListener("visibilitychange", visibility); };
  }, [config, lock, locked]);
  useEffect(() => { const sync = (event: StorageEvent) => { if (event.key !== APP_LOCK_STORAGE_KEY && event.key !== APP_LOCK_SIGNAL_KEY) return; const next = parseAppLockConfig(localStorage.getItem(APP_LOCK_STORAGE_KEY)); setConfig(next); setLocked(Boolean(next)); }; window.addEventListener("storage", sync); return () => window.removeEventListener("storage", sync); }, []);

  const value = useMemo(() => ({ initialized, available, enabled: Boolean(config), locked, config, unlock, lock, setup, changePin, setAutoLockMs, disable, reset }), [available, changePin, config, disable, initialized, lock, locked, reset, setAutoLockMs, setup, unlock]);
  return <AppLockContext.Provider value={value}>{children}</AppLockContext.Provider>;
}
export function useAppLock() { const value = useContext(AppLockContext); if (!value) throw new Error("useAppLock must be used inside AppLockProvider"); return value; }
