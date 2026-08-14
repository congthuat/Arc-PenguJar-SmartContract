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

type SecurityFunction = "requestWithdrawal" | "cancelWithdrawalRequest" | "freezeWithdrawal" | "unfreezeJar" | "approveGuardianChange" | "cancelGuardianChange" | "executeGuardianChange" | "approveOwnerRecovery" | "executeOwnerRecovery";

export function JarSecurityPanel({ jar, now, onRefresh, onWithdraw }: { jar: Jar; now: bigint; onRefresh(): Promise<unknown>; onWithdraw(): void }) {
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
      if (receipt.status !== "success") throw new Error("The contract rejected this transaction.");
      await onRefresh(); setMessage("Security state updated on Arc Testnet.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "The request failed."); }
    finally { setBusy(undefined); }
  }

  async function sendAddress(functionName: "requestGuardianChange" | "requestOwnerRecovery", value: string) {
    if (!contractAddress || !client || !viewer || !isAddress(value)) { setMessage("Enter a valid wallet address."); return; }
    const next = getAddress(value);
    const forbidden = functionName === "requestGuardianChange" ? [jar.owner, jar.guardian, jar.recoveryWallet] : [jar.owner, jar.guardian, jar.recoveryWallet];
    if (next === zeroAddress || forbidden.some((address) => address.toLowerCase() === next.toLowerCase())) { setMessage("Choose a different, non-zero wallet address."); return; }
    setBusy(functionName); setMessage(undefined);
    try {
      const hash = await writeContractAsync({ address: contractAddress, abi: penguJarV3Abi, functionName, args: [jar.id, next], account: viewer, chainId: arcTestnet.id });
      const receipt = await client.waitForTransactionReceipt({ hash, confirmations: 1 });
      if (receipt.status !== "success") throw new Error("The contract rejected this transaction.");
      await onRefresh(); setMessage("Security request recorded on Arc Testnet.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "The request failed."); }
    finally { setBusy(undefined); }
  }

  if (jar.mode !== 1) return null;
  return <section className={`security-panel ${jar.frozen ? "frozen" : ""}`}>
    <div><p className="eyebrow">Security status</p><h2>{jar.frozen ? "Emergency Freeze Active" : p.protectedJar ? "Guardian protected" : "Withdrawal Shield"}</h2></div>
    <div className="security-badges"><span>SHIELDED</span>{p.protectedJar && <span>GUARDIAN PROTECTED</span>}{jar.privacyMode === 1 && <span>PRIVATE METADATA</span>}{jar.frozen && <span className="danger">FROZEN</span>}</div>
    {p.protectedJar && <dl className="security-facts"><div><dt>Guardian wallet</dt><dd>{shortAddress(jar.guardian)}</dd></div><div><dt>Recovery wallet</dt><dd>{shortAddress(jar.recoveryWallet)}</dd></div></dl>}
    {p.requestActive && <p><strong>Withdrawal requested.</strong> Ready {formatDate(jar.withdrawalReadyAt)} · {remainingLabel(jar.withdrawalReadyAt, now)}</p>}
    {jar.frozen && <p>Freezing cancelled the previous withdrawal request. Recovery period: {remainingLabel(jar.freezeRecoveryReadyAt, now)}.</p>}
    {jar.pendingGuardian !== zeroAddress && <p><strong>Guardian change pending:</strong> {shortAddress(jar.pendingGuardian)} · {remainingLabel(jar.guardianChangeReadyAt, now)} · {jar.guardianChangeRecoveryApproved ? "Recovery approved" : "Recovery approval required"}</p>}
    {jar.pendingOwner !== zeroAddress && <p><strong>Owner recovery pending:</strong> {shortAddress(jar.pendingOwner)} · {remainingLabel(jar.ownerRecoveryReadyAt, now)} · {jar.guardianApprovedOwnerRecovery ? "Guardian approved" : "Guardian approval required"}. Owner Recovery changes control of the Jar. It does NOT transfer USDC.</p>}
    <div className="security-actions">
      {p.requestWithdrawal && <button onClick={() => void send("requestWithdrawal")} disabled={Boolean(busy)}>Request withdrawal</button>}
      {p.cancelWithdrawal && <button onClick={() => void send("cancelWithdrawalRequest")} disabled={Boolean(busy)}>Cancel withdrawal request</button>}
      {p.withdraw && <button className="primary-action" onClick={onWithdraw}>Withdraw USDC</button>}
      {p.freeze && <button className="emergency-action" onClick={() => void send("freezeWithdrawal", "Emergency Freeze cancels the active withdrawal request and starts the security recovery period. The Guardian never receives or controls Jar funds. Continue?")} disabled={Boolean(busy)}>Emergency Freeze</button>}
      {p.approveGuardianChange && <button onClick={() => void send("approveGuardianChange")} disabled={Boolean(busy)}>Approve Guardian Change</button>}
      {p.cancelGuardianChange && <button onClick={() => void send("cancelGuardianChange")} disabled={Boolean(busy)}>Cancel Guardian Change</button>}
      {p.executeGuardianChange && <button onClick={() => void send("executeGuardianChange", "Execute the approved Guardian change now?")} disabled={Boolean(busy)}>Execute Guardian Change</button>}
      {p.approveOwnerRecovery && <button onClick={() => void send("approveOwnerRecovery")} disabled={Boolean(busy)}>Approve Owner Recovery</button>}
      {p.executeOwnerRecovery && <button className="emergency-action" onClick={() => void send("executeOwnerRecovery", "Owner Recovery changes control of the Jar. It does not transfer USDC. Execute recovery?")} disabled={Boolean(busy)}>Execute Owner Recovery</button>}
      {p.unfreeze && <button onClick={() => void send("unfreezeJar")} disabled={Boolean(busy)}>Unfreeze Jar</button>}
    </div>
    {p.requestGuardianChange && <div className="security-input"><label>New Guardian wallet<input value={guardianInput} onChange={(e) => setGuardianInput(e.target.value)} placeholder="0x…" /></label><button onClick={() => void sendAddress("requestGuardianChange", guardianInput)} disabled={Boolean(busy)}>Request Guardian Change</button></div>}
    {p.requestOwnerRecovery && <div className="security-input"><label>New owner wallet<input value={ownerInput} onChange={(e) => setOwnerInput(e.target.value)} placeholder="0x…" /><small>Changes control only. No USDC is transferred.</small></label><button className="emergency-action" onClick={() => void sendAddress("requestOwnerRecovery", ownerInput)} disabled={Boolean(busy)}>Request Owner Recovery</button></div>}
    {message && <p role="status" className="form-alert">{message}</p>}
  </section>;
}
