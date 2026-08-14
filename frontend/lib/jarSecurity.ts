import { zeroAddress, type Address } from "viem";
import type { Jar } from "./types";

export function sameAddress(a: Address | undefined, b: Address) {
  return Boolean(a && a.toLowerCase() === b.toLowerCase());
}

export function securityPermissions(jar: Jar, viewer: Address | undefined, now: bigint) {
  const owner = sameAddress(viewer, jar.owner);
  const guardian = jar.guardian !== zeroAddress && sameAddress(viewer, jar.guardian);
  const recovery = jar.recoveryWallet !== zeroAddress && sameAddress(viewer, jar.recoveryWallet);
  const pendingOwner = jar.pendingOwner !== zeroAddress && sameAddress(viewer, jar.pendingOwner);
  const protectedJar = jar.mode === 1 && jar.guardian !== zeroAddress && jar.recoveryWallet !== zeroAddress;
  const requestActive = jar.withdrawalReadyAt !== 0n;
  const guardianChangePending = jar.pendingGuardian !== zeroAddress;
  const ownerRecoveryPending = jar.pendingOwner !== zeroAddress;

  return {
    owner, guardian, recovery, pendingOwner, protectedJar, requestActive,
    requestWithdrawal: owner && jar.mode === 1 && !jar.closed && !jar.frozen && now >= jar.unlockTime && !requestActive,
    cancelWithdrawal: owner && jar.mode === 1 && !jar.closed && requestActive,
    withdraw: owner && !jar.closed && !jar.frozen && jar.balance > 0n && now >= jar.unlockTime && (jar.mode === 0 || (requestActive && now >= jar.withdrawalReadyAt)),
    freeze: guardian && !jar.closed && !jar.frozen && requestActive,
    requestGuardianChange: owner && protectedJar && !jar.closed && !jar.frozen && !guardianChangePending,
    approveGuardianChange: recovery && protectedJar && !jar.frozen && guardianChangePending && !jar.guardianChangeRecoveryApproved,
    cancelGuardianChange: owner && protectedJar && !jar.frozen && guardianChangePending,
    executeGuardianChange: owner && protectedJar && !jar.frozen && guardianChangePending && jar.guardianChangeRecoveryApproved && !requestActive && now >= jar.guardianChangeReadyAt,
    requestOwnerRecovery: recovery && protectedJar && jar.frozen && !jar.closed && !ownerRecoveryPending,
    approveOwnerRecovery: guardian && jar.frozen && ownerRecoveryPending && !jar.guardianApprovedOwnerRecovery,
    executeOwnerRecovery: pendingOwner && jar.frozen && ownerRecoveryPending && jar.guardianApprovedOwnerRecovery && now >= jar.ownerRecoveryReadyAt,
    unfreeze: owner && jar.frozen && !jar.closed && !ownerRecoveryPending && now >= jar.freezeRecoveryReadyAt,
  };
}

export function remainingLabel(readyAt: bigint, now: bigint) {
  if (readyAt === 0n || now >= readyAt) return "Ready now";
  const seconds = readyAt - now;
  const days = seconds / 86400n;
  const hours = (seconds % 86400n) / 3600n;
  const minutes = (seconds % 3600n) / 60n;
  return days > 0n ? `${days}d ${hours}h remaining` : hours > 0n ? `${hours}h ${minutes}m remaining` : `${minutes}m remaining`;
}
