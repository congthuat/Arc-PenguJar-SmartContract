import assert from "node:assert/strict";
import test from "node:test";
import { zeroAddress, type Address } from "viem";
import type { Jar } from "./types.ts";
import {
  SECURITY_DATA_STORAGE,
  deriveNetworkSafety,
  deriveOverallSecurityStatus,
  deriveSecurityAlerts,
  summarizeJarProtection,
} from "./securityCenter.ts";

const address = "0x1111111111111111111111111111111111111111" as Address;

function jar(overrides: Partial<Jar> = {}): Jar {
  return {
    id: 1n, owner: address, balance: 1n, targetAmount: 2n, unlockTime: 3n, createdAt: 1n,
    closed: false, mode: 0, privacyMode: 0, withdrawalDelay: 0n, withdrawalReadyAt: 0n,
    metadataCommitment: `0x${"00".repeat(32)}`, guardian: zeroAddress, frozen: false,
    freezeRecoveryReadyAt: 0n, pendingGuardian: zeroAddress, guardianChangeReadyAt: 0n,
    recoveryWallet: zeroAddress, guardianChangeRecoveryApproved: false, pendingOwner: zeroAddress,
    ownerRecoveryReadyAt: 0n, guardianApprovedOwnerRecovery: false, name: "Jar", totalContributed: 1n,
    ...overrides,
  };
}

test("network state is derived without trusting a display-only chain value", () => {
  assert.equal(deriveNetworkSafety(false, false), "disconnected");
  assert.equal(deriveNetworkSafety(true, false), "wrong");
  assert.equal(deriveNetworkSafety(true, true), "correct");
});

test("jar protection summary only alerts on active lifecycle state", () => {
    const summary = summarizeJarProtection([
      jar(),
      jar({ id: 2n, mode: 1, privacyMode: 1, guardian: address, recoveryWallet: address, frozen: true }),
      jar({ id: 3n, mode: 1, closed: true, pendingOwner: address }),
    ]);
  assert.deepEqual({ total: summary.total, active: summary.active, safe: summary.safe, shielded: summary.shielded, privateMetadata: summary.privateMetadata, guardianProtected: summary.guardianProtected, frozen: summary.frozen, pendingOwnerRecovery: summary.pendingOwnerRecovery }, { total: 3, active: 2, safe: 1, shielded: 2, privateMetadata: 1, guardianProtected: 1, frozen: 1, pendingOwnerRecovery: 0 });
});

test("real warnings and recommendations are deterministic", () => {
    const summary = summarizeJarProtection([jar({ mode: 1, pendingOwner: address })]);
    const alerts = deriveSecurityAlerts({ network: "correct", protectionState: "ready", summary });
    assert.deepEqual(alerts.map(({ code }) => code), [
      "pending-owner-recovery", "shielded-without-guardian", "shielded-without-recovery",
    ]);
  assert.equal(deriveOverallSecurityStatus("correct", "ready", alerts), "review");
  assert.equal(deriveOverallSecurityStatus("correct", "loading", []), "unknown");
});

test("browser data and public on-chain memo labels are accurate", () => {
  assert.deepEqual(SECURITY_DATA_STORAGE, {
      contacts: "browser-local",
      recentRecipients: "browser-local",
      privateMetadata: "browser-local-encrypted",
      arcMemo: "public-onchain",
  });
});
