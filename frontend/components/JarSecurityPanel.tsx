"use client";

import { useState } from "react";
import { getAddress, isAddress, zeroAddress } from "viem";
import { useConnection, usePublicClient, useWriteContract } from "wagmi";
import { arcTestnet } from "viem/chains";
import { penguJarV3Abi } from "@/lib/abi/penguJarV3";
import { contractAddress } from "@/lib/config";
import { remainingLabel, securityPermissions } from "@/lib/jarSecurity";
import { formatDate, shortAddress } from "@/lib/format";
import type { Jar } from "@/lib/types";
import { usePreferences } from "@/hooks/usePreferences";

type SecurityFunction = "requestWithdrawal" | "cancelWithdrawalRequest" | "freezeWithdrawal" | "unfreezeJar" | "approveGuardianChange" | "cancelGuardianChange" | "executeGuardianChange" | "approveOwnerRecovery" | "executeOwnerRecovery";

export function JarSecurityPanel({ jar, now, onRefresh, onWithdraw }: { jar: Jar; now: bigint; onRefresh(): Promise<unknown>; onWithdraw(): void }) {
  const { t } = usePreferences();
  const connection = useConnection();
  const client = usePublicClient({ chainId: arcTestnet.id });
  const { writeContractAsync } = useWriteContract();
  const [guardianInput, setGuardianInput] = useState("");
  const [ownerInput, setOwnerInput] = useState("");
  const [busy, setBusy] = useState<string>();
  const [message, setMessage] = useState<string>();
  const viewer = connection.address;
  const p = securityPermissions(jar, viewer, now);

  async function send(functionName: SecurityFunction, warning?: string) {
    if (!contractAddress || !client || !viewer) return;
    if (warning && !window.confirm(warning)) return;
    setBusy(functionName); setMessage(undefined);
    try {
      const hash = await writeContractAsync({ address: contractAddress, abi: penguJarV3Abi, functionName, args: [jar.id], account: viewer, chainId: arcTestnet.id });
      const receipt = await client.waitForTransactionReceipt({ hash, confirmations: 1 });
      if (receipt.status !== "success") throw new Error(t("security.contractRejected"));
      await onRefresh(); setMessage(t("security.updated"));
    } catch (error) { setMessage(error instanceof Error ? error.message : t("tx.failed")); }
    finally { setBusy(undefined); }
  }

  async function sendAddress(functionName: "requestGuardianChange" | "requestOwnerRecovery", value: string) {
    if (!contractAddress || !client || !viewer || !isAddress(value)) { setMessage(t("validation.address")); return; }
    const next = getAddress(value);
    const forbidden = functionName === "requestGuardianChange" ? [jar.owner, jar.guardian, jar.recoveryWallet] : [jar.owner, jar.guardian, jar.recoveryWallet];
    if (next === zeroAddress || forbidden.some((address) => address.toLowerCase() === next.toLowerCase())) { setMessage(t("security.differentAddress")); return; }
    setBusy(functionName); setMessage(undefined);
    try {
      const hash = await writeContractAsync({ address: contractAddress, abi: penguJarV3Abi, functionName, args: [jar.id, next], account: viewer, chainId: arcTestnet.id });
      const receipt = await client.waitForTransactionReceipt({ hash, confirmations: 1 });
      if (receipt.status !== "success") throw new Error(t("security.contractRejected"));
      await onRefresh(); setMessage(t("security.recorded"));
    } catch (error) { setMessage(error instanceof Error ? error.message : t("tx.failed")); }
    finally { setBusy(undefined); }
  }

  if (jar.mode !== 1) return null;
  return <section className={`security-panel ${jar.frozen ? "frozen" : ""}`}>
    <div><p className="eyebrow">{t("security.status")}</p><h2>{jar.frozen ? t("security.freezeActive") : p.protectedJar ? t("jar.guardianProtected") : t("security.withdrawalShield")}</h2></div>
    <div className="security-badges"><span>{t("create.shielded")}</span>{p.protectedJar && <span>{t("jar.guardianProtected")}</span>}{jar.privacyMode === 1 && <span>{t("jar.privateMetadata")}</span>}{jar.frozen && <span className="danger">{t("jar.frozen")}</span>}</div>
    {p.protectedJar && <dl className="security-facts"><div><dt>{t("create.guardianWallet")}</dt><dd>{shortAddress(jar.guardian)}</dd></div><div><dt>{t("create.recoveryWallet")}</dt><dd>{shortAddress(jar.recoveryWallet)}</dd></div></dl>}
    {p.requestActive && <p><strong>{t("security.withdrawalRequested")}</strong> {t("security.ready", { date: formatDate(jar.withdrawalReadyAt), remaining: remainingLabel(jar.withdrawalReadyAt, now) })}</p>}
    {jar.frozen && <p>{t("security.freezeCopy", { remaining: remainingLabel(jar.freezeRecoveryReadyAt, now) })}</p>}
    {jar.pendingGuardian !== zeroAddress && <p>{t("security.guardianPending", { address: shortAddress(jar.pendingGuardian), remaining: remainingLabel(jar.guardianChangeReadyAt, now), approval: jar.guardianChangeRecoveryApproved ? t("security.recoveryApproved") : t("security.recoveryRequired") })}</p>}
    {jar.pendingOwner !== zeroAddress && <p>{t("security.ownerPending", { address: shortAddress(jar.pendingOwner), remaining: remainingLabel(jar.ownerRecoveryReadyAt, now), approval: jar.guardianApprovedOwnerRecovery ? t("security.guardianApproved") : t("security.guardianRequired") })}</p>}
    <div className="security-actions">
      {p.requestWithdrawal && <button onClick={() => void send("requestWithdrawal")} disabled={Boolean(busy)}>{t("security.requestWithdrawal")}</button>}
      {p.cancelWithdrawal && <button onClick={() => void send("cancelWithdrawalRequest")} disabled={Boolean(busy)}>{t("security.cancelWithdrawal")}</button>}
      {p.withdraw && <button className="primary-action" onClick={onWithdraw}>{t("security.withdraw")}</button>}
      {p.freeze && <button className="emergency-action" onClick={() => void send("freezeWithdrawal", t("security.freezeConfirm"))} disabled={Boolean(busy)}>{t("security.emergencyFreeze")}</button>}
      {p.approveGuardianChange && <button onClick={() => void send("approveGuardianChange")} disabled={Boolean(busy)}>{t("security.approveGuardian")}</button>}
      {p.cancelGuardianChange && <button onClick={() => void send("cancelGuardianChange")} disabled={Boolean(busy)}>{t("security.cancelGuardian")}</button>}
      {p.executeGuardianChange && <button onClick={() => void send("executeGuardianChange", t("security.executeGuardianConfirm"))} disabled={Boolean(busy)}>{t("security.executeGuardian")}</button>}
      {p.approveOwnerRecovery && <button onClick={() => void send("approveOwnerRecovery")} disabled={Boolean(busy)}>{t("security.approveRecovery")}</button>}
      {p.executeOwnerRecovery && <button className="emergency-action" onClick={() => void send("executeOwnerRecovery", t("security.executeRecoveryConfirm"))} disabled={Boolean(busy)}>{t("security.executeRecovery")}</button>}
      {p.unfreeze && <button onClick={() => void send("unfreezeJar")} disabled={Boolean(busy)}>{t("security.unfreeze")}</button>}
    </div>
    {p.requestGuardianChange && <div className="security-input"><label>{t("security.newGuardian")}<input value={guardianInput} onChange={(e) => setGuardianInput(e.target.value)} placeholder="0x…" /></label><button onClick={() => void sendAddress("requestGuardianChange", guardianInput)} disabled={Boolean(busy)}>{t("security.requestGuardian")}</button></div>}
    {p.requestOwnerRecovery && <div className="security-input"><label>{t("security.newOwner")}<input value={ownerInput} onChange={(e) => setOwnerInput(e.target.value)} placeholder="0x…" /><small>{t("security.ownerControlOnly")}</small></label><button className="emergency-action" onClick={() => void sendAddress("requestOwnerRecovery", ownerInput)} disabled={Boolean(busy)}>{t("security.requestRecovery")}</button></div>}
    {message && <p role="status" className="form-alert">{message}</p>}
  </section>;
}
