import assert from "node:assert/strict";
import test from "node:test";
import type { Address } from "viem";
import { securityPermissions } from "./jarSecurity.ts";
import type { Jar } from "./types.ts";

const owner = "0x1111111111111111111111111111111111111111" as Address;
const guardian = "0x2222222222222222222222222222222222222222" as Address;
const recovery = "0x3333333333333333333333333333333333333333" as Address;
const nextOwner = "0x4444444444444444444444444444444444444444" as Address;
const random = "0x5555555555555555555555555555555555555555" as Address;
const zero = "0x0000000000000000000000000000000000000000" as Address;

function jar(overrides: Partial<Jar> = {}): Jar {
  return { id: 1n, owner, balance: 10n, targetAmount: 100n, unlockTime: 100n, createdAt: 1n, closed: false, mode: 1, privacyMode: 0, withdrawalDelay: 10n, withdrawalReadyAt: 0n, metadataCommitment: `0x${"00".repeat(32)}`, guardian, frozen: false, freezeRecoveryReadyAt: 0n, pendingGuardian: zero, guardianChangeReadyAt: 0n, recoveryWallet: recovery, guardianChangeRecoveryApproved: false, pendingOwner: zero, ownerRecoveryReadyAt: 0n, guardianApprovedOwnerRecovery: false, name: "Jar", totalContributed: 0n, ...overrides };
}

test("SAFE jar keeps direct owner withdrawal after unlock", () => assert.equal(securityPermissions(jar({ mode: 0, guardian: zero, recoveryWallet: zero }), owner, 100n).withdraw, true));
test("SHIELDED requests first and active request exposes delay state", () => { assert.equal(securityPermissions(jar(), owner, 100n).requestWithdrawal, true); assert.equal(securityPermissions(jar({ withdrawalReadyAt: 120n }), owner, 110n).withdraw, false); assert.equal(securityPermissions(jar({ withdrawalReadyAt: 120n }), owner, 120n).withdraw, true); });
test("frozen jar disables withdrawal and clears normal flow", () => { const p = securityPermissions(jar({ frozen: true, withdrawalReadyAt: 0n, freezeRecoveryReadyAt: 200n }), owner, 150n); assert.equal(p.withdraw, false); assert.equal(p.requestWithdrawal, false); });
test("only guardian sees emergency freeze for an active request", () => { const active = jar({ withdrawalReadyAt: 120n }); assert.equal(securityPermissions(active, guardian, 110n).freeze, true); assert.equal(securityPermissions(active, random, 110n).freeze, false); });
test("recovery approves guardian change and owner cannot execute without approval", () => { const pending = jar({ pendingGuardian: random, guardianChangeReadyAt: 120n }); assert.equal(securityPermissions(pending, recovery, 120n).approveGuardianChange, true); assert.equal(securityPermissions(pending, owner, 120n).executeGuardianChange, false); assert.equal(securityPermissions({ ...pending, guardianChangeRecoveryApproved: true }, owner, 120n).executeGuardianChange, true); });
test("owner recovery roles follow contract authorization", () => { const frozen = jar({ frozen: true, freezeRecoveryReadyAt: 200n }); assert.equal(securityPermissions(frozen, recovery, 150n).requestOwnerRecovery, true); const pending = { ...frozen, pendingOwner: nextOwner, ownerRecoveryReadyAt: 220n }; assert.equal(securityPermissions(pending, guardian, 220n).approveOwnerRecovery, true); assert.equal(securityPermissions({ ...pending, guardianApprovedOwnerRecovery: true }, nextOwner, 220n).executeOwnerRecovery, true); assert.equal(securityPermissions({ ...pending, guardianApprovedOwnerRecovery: true }, owner, 220n).executeOwnerRecovery, false); });
test("loaded recovered owner state removes old owner actions", () => { const recovered = jar({ owner: nextOwner }); assert.equal(securityPermissions(recovered, owner, 100n).owner, false); assert.equal(securityPermissions(recovered, nextOwner, 100n).owner, true); });
