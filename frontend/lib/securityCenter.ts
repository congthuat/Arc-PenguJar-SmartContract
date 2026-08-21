import { zeroAddress } from "viem";
import type { Jar } from "./types";

export type NetworkSafetyStatus = "correct" | "wrong" | "disconnected";
export type ProtectionLoadState = "unavailable" | "loading" | "error" | "ready";
export type SecurityOverallStatus = "protected" | "review" | "disconnected" | "unknown";
export type SecurityAlertCode =
  | "disconnected"
  | "wrong-network"
  | "protection-loading"
  | "protection-unavailable"
  | "frozen-jars"
  | "pending-owner-recovery"
  | "pending-guardian-change"
  | "shielded-without-guardian"
  | "shielded-without-recovery";

export type SecurityAlert = {
  code: SecurityAlertCode;
  severity: "info" | "attention" | "warning";
  count?: number;
};

export type JarProtectionSummary = {
  total: number;
  active: number;
  safe: number;
  shielded: number;
  publicMetadata: number;
  privateMetadata: number;
  guardianProtected: number;
  recoveryConfigured: number;
  frozen: number;
  pendingOwnerRecovery: number;
  pendingGuardianChange: number;
  shieldedWithoutGuardian: number;
  shieldedWithoutRecovery: number;
};

export const SECURITY_DATA_STORAGE = {
  contacts: "browser-local",
  recentRecipients: "browser-local",
  privateMetadata: "browser-local-encrypted",
  arcMemo: "public-onchain",
} as const;

export function deriveNetworkSafety(connected: boolean, isArc: boolean): NetworkSafetyStatus {
  if (!connected) return "disconnected";
  return isArc ? "correct" : "wrong";
}

export function summarizeJarProtection(jars: readonly Jar[]): JarProtectionSummary {
  const active = jars.filter((jar) => !jar.closed);
  const hasGuardian = (jar: Jar) => jar.guardian !== zeroAddress;
  const hasRecovery = (jar: Jar) => jar.recoveryWallet !== zeroAddress;
  const isShielded = (jar: Jar) => Number(jar.mode) === 1;
  return {
    total: jars.length,
    active: active.length,
    safe: jars.filter((jar) => !isShielded(jar)).length,
    shielded: jars.filter(isShielded).length,
    publicMetadata: jars.filter((jar) => Number(jar.privacyMode) === 0).length,
    privateMetadata: jars.filter((jar) => Number(jar.privacyMode) === 1).length,
    guardianProtected: jars.filter(hasGuardian).length,
    recoveryConfigured: jars.filter(hasRecovery).length,
    frozen: active.filter((jar) => jar.frozen).length,
    pendingOwnerRecovery: active.filter((jar) => jar.pendingOwner !== zeroAddress).length,
    pendingGuardianChange: active.filter((jar) => jar.pendingGuardian !== zeroAddress).length,
    shieldedWithoutGuardian: active.filter((jar) => isShielded(jar) && !hasGuardian(jar)).length,
    shieldedWithoutRecovery: active.filter((jar) => isShielded(jar) && !hasRecovery(jar)).length,
  };
}

export function deriveSecurityAlerts(input: {
  network: NetworkSafetyStatus;
  protectionState: ProtectionLoadState;
  summary: JarProtectionSummary;
}): SecurityAlert[] {
  if (input.network === "disconnected") return [{ code: "disconnected", severity: "info" }];
  if (input.network === "wrong") return [{ code: "wrong-network", severity: "warning" }];
  if (input.protectionState === "loading") return [{ code: "protection-loading", severity: "info" }];
  if (input.protectionState !== "ready") return [{ code: "protection-unavailable", severity: "attention" }];

  const alerts: SecurityAlert[] = [];
  if (input.summary.frozen) alerts.push({ code: "frozen-jars", severity: "warning", count: input.summary.frozen });
  if (input.summary.pendingOwnerRecovery) alerts.push({ code: "pending-owner-recovery", severity: "warning", count: input.summary.pendingOwnerRecovery });
  if (input.summary.pendingGuardianChange) alerts.push({ code: "pending-guardian-change", severity: "attention", count: input.summary.pendingGuardianChange });
  if (input.summary.shieldedWithoutGuardian) alerts.push({ code: "shielded-without-guardian", severity: "info", count: input.summary.shieldedWithoutGuardian });
  if (input.summary.shieldedWithoutRecovery) alerts.push({ code: "shielded-without-recovery", severity: "info", count: input.summary.shieldedWithoutRecovery });
  return alerts;
}

export function deriveOverallSecurityStatus(
  network: NetworkSafetyStatus,
  protectionState: ProtectionLoadState,
  alerts: readonly SecurityAlert[],
): SecurityOverallStatus {
  if (network === "disconnected") return "disconnected";
  if (network === "wrong") return "review";
  if (protectionState !== "ready") return "unknown";
  return alerts.length ? "review" : "protected";
}
