"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { APP_LOCK_SESSION_CHANNEL, APP_LOCK_SESSION_KEY, APP_LOCK_SESSION_MARKER, APP_LOCK_SIGNAL_KEY, APP_LOCK_STORAGE_KEY, AUTO_LOCK_OPTIONS, canGrantAppLockSession, clearMakotoConvenienceData, createAppLockConfig, hasAuthenticatedAppLockSession, inactivityExpired, initialAppLockState, isMatchingAppLockSessionGrant, parseAppLockSessionMessage, parseAppLockSignal, recordFailedAttempt, resetFailedAttempts, syncAppLockStorageEvent, verifyAppLockPin, type AppLockConfig } from "@/lib/appLock";

type UnlockResult = "success" | "wrong" | "cooldown";
type AppLockContextValue = {
  initialized: boolean; available: boolean; enabled: boolean; locked: boolean; config?: AppLockConfig;
  unlock(pin: string): Promise<UnlockResult>; lock(): void; setup(pin: string, autoLockMs: number): Promise<void>;
  changePin(current: string, next: string): Promise<boolean>; setAutoLockMs(value: number): void; setKeepUnlockedSession(value: boolean): void; disable(pin: string): Promise<boolean>; reset(): void;
};
const AppLockContext = createContext<AppLockContextValue | undefined>(undefined);

export function AppLockProvider({ children }: { children: ReactNode }) {
  const [initialized, setInitialized] = useState(false);
  const [available, setAvailable] = useState(true);
  const [config, setConfig] = useState<AppLockConfig>();
  const [locked, setLocked] = useState(false);
  const lastActivity = useRef(0);
  const configRef = useRef<AppLockConfig | undefined>(undefined);
  const lockedRef = useRef(false);
  const pendingRequestRef = useRef<string | undefined>(undefined);

  const persist = useCallback((next?: AppLockConfig) => { configRef.current = next; setConfig(next); if (next) localStorage.setItem(APP_LOCK_STORAGE_KEY, JSON.stringify(next)); else localStorage.removeItem(APP_LOCK_STORAGE_KEY); }, []);
  useEffect(() => {
    let active = true;
    let resolveTimer: number | undefined;
    let channel: BroadcastChannel | undefined;
    queueMicrotask(() => {
      if (!active) return;
      const usable = Boolean(globalThis.crypto?.subtle && globalThis.crypto?.getRandomValues);
      const raw = usable ? localStorage.getItem(APP_LOCK_STORAGE_KEY) : null;
      const sessionAuthenticated = usable && hasAuthenticatedAppLockSession(readSessionMarker());
      const initial = usable ? initialAppLockState(raw, sessionAuthenticated) : { config: undefined, locked: false };
      configRef.current = initial.config; lockedRef.current = initial.locked;
      lastActivity.current = Date.now(); setAvailable(usable); setConfig(initial.config); setLocked(initial.locked);
      if (initial.config && raw !== JSON.stringify(initial.config)) localStorage.setItem(APP_LOCK_STORAGE_KEY, JSON.stringify(initial.config));

      try { if (typeof BroadcastChannel !== "undefined") channel = new BroadcastChannel(APP_LOCK_SESSION_CHANNEL); } catch { channel = undefined; }
      if (channel) channel.onmessage = (event: MessageEvent<unknown>) => {
        const message = parseAppLockSessionMessage(event.data);
        if (canGrantAppLockSession(configRef.current, lockedRef.current, message) && message) channel?.postMessage({ type: "grant-session-unlock", requestId: message.requestId });
        const requestId = pendingRequestRef.current;
        if (requestId && configRef.current?.keepUnlockedSession && isMatchingAppLockSessionGrant(requestId, message)) {
          pendingRequestRef.current = undefined; writeSessionMarker(true); lockedRef.current = false; setLocked(false); setInitialized(true);
          if (resolveTimer) window.clearTimeout(resolveTimer);
        }
      };

      if (!initial.config || !initial.locked || !initial.config.keepUnlockedSession || !channel) { setInitialized(true); return; }
      const requestId = createSessionRequestId();
      pendingRequestRef.current = requestId;
      channel.postMessage({ type: "request-session-unlock", requestId });
      resolveTimer = window.setTimeout(() => { pendingRequestRef.current = undefined; if (active) setInitialized(true); }, 250);
    });
    return () => { active = false; if (resolveTimer) window.clearTimeout(resolveTimer); channel?.close(); };
  }, []);

  useEffect(() => { configRef.current = config; lockedRef.current = locked; }, [config, locked]);
  const lock = useCallback(() => { if (!config) return; writeSessionMarker(false); lockedRef.current = true; setLocked(true); localStorage.setItem(APP_LOCK_SIGNAL_KEY, JSON.stringify({ action: "lock", at: Date.now() })); }, [config]);
  const unlock = useCallback(async (pin: string): Promise<UnlockResult> => {
    if (!config) return "success";
    const now = Date.now();
    if (config.cooldownUntil > now) return "cooldown";
    if (await verifyAppLockPin(pin, config)) { const next = resetFailedAttempts(config); persist(next); writeSessionMarker(next.keepUnlockedSession); lastActivity.current = now; lockedRef.current = false; setLocked(false); return "success"; }
    const next = recordFailedAttempt(config, now); persist(next);
    return next.cooldownUntil > now ? "cooldown" : "wrong";
  }, [config, persist]);
  const setup = useCallback(async (pin: string, autoLockMs: number) => { const next = await createAppLockConfig(pin, autoLockMs); persist(next); writeSessionMarker(false); lastActivity.current = Date.now(); lockedRef.current = false; setLocked(false); }, [persist]);
  const changePin = useCallback(async (current: string, nextPin: string) => { if (!config || !(await verifyAppLockPin(current, config))) return false; const next = await createAppLockConfig(nextPin, config.autoLockMs, crypto, config.keepUnlockedSession); persist(next); writeSessionMarker(next.keepUnlockedSession); return true; }, [config, persist]);
  const setAutoLockMs = useCallback((value: number) => { if (config && AUTO_LOCK_OPTIONS.includes(value as never)) persist({ ...config, autoLockMs: value }); }, [config, persist]);
  const setKeepUnlockedSession = useCallback((value: boolean) => { if (!config) return; persist({ ...config, keepUnlockedSession: value }); writeSessionMarker(value && !lockedRef.current); }, [config, persist]);
  const disable = useCallback(async (pin: string) => { if (!config || !(await verifyAppLockPin(pin, config))) return false; writeSessionMarker(false); persist(undefined); lockedRef.current = false; setLocked(false); localStorage.setItem(APP_LOCK_SIGNAL_KEY, JSON.stringify({ action: "disable", at: Date.now() })); return true; }, [config, persist]);
  const reset = useCallback(() => { writeSessionMarker(false); clearMakotoConvenienceData(localStorage); persist(undefined); lockedRef.current = false; setLocked(false); localStorage.setItem(APP_LOCK_SIGNAL_KEY, JSON.stringify({ action: "reset", at: Date.now() })); }, [persist]);

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
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== APP_LOCK_STORAGE_KEY && event.key !== APP_LOCK_SIGNAL_KEY) return;
      const configRaw = event.key === APP_LOCK_STORAGE_KEY ? event.newValue : localStorage.getItem(APP_LOCK_STORAGE_KEY);
      const signalRaw = event.key === APP_LOCK_SIGNAL_KEY ? event.newValue : null;
      const next = syncAppLockStorageEvent({ config, locked }, event.key, configRaw, signalRaw);
      const action = parseAppLockSignal(signalRaw);
      if (action === "lock" || action === "disable" || action === "reset" || (event.key === APP_LOCK_STORAGE_KEY && !next.config?.keepUnlockedSession)) writeSessionMarker(false);
      else if (event.key === APP_LOCK_STORAGE_KEY && next.config?.keepUnlockedSession && !next.locked) writeSessionMarker(true);
      configRef.current = next.config; lockedRef.current = next.locked;
      setConfig(next.config);
      setLocked(next.locked);
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [config, locked]);

  const value = useMemo(() => ({ initialized, available, enabled: Boolean(config), locked, config, unlock, lock, setup, changePin, setAutoLockMs, setKeepUnlockedSession, disable, reset }), [available, changePin, config, disable, initialized, lock, locked, reset, setAutoLockMs, setKeepUnlockedSession, setup, unlock]);
  return <AppLockContext.Provider value={value}>{children}</AppLockContext.Provider>;
}
export function useAppLock() { const value = useContext(AppLockContext); if (!value) throw new Error("useAppLock must be used inside AppLockProvider"); return value; }

function readSessionMarker() { try { return sessionStorage.getItem(APP_LOCK_SESSION_KEY); } catch { return null; } }
function writeSessionMarker(authenticated: boolean) { try { if (authenticated) sessionStorage.setItem(APP_LOCK_SESSION_KEY, APP_LOCK_SESSION_MARKER); else sessionStorage.removeItem(APP_LOCK_SESSION_KEY); } catch { /* Session convenience fails closed when browser storage is unavailable. */ } }
function createSessionRequestId() { const bytes = crypto.getRandomValues(new Uint8Array(16)); return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(""); }
