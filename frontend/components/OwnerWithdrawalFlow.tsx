"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getAddress, type Hash } from "viem";
import { useConnection, usePublicClient, useWriteContract, type Connector } from "wagmi";
import { arcTestnet } from "viem/chains";
import { useVerifiedWalletChain } from "@/hooks/useVerifiedWalletChain";
import { penguJarV3Abi } from "@/lib/abi/penguJarV3";
import { ARC_EXPLORER_URL, contractAddress } from "@/lib/config";
import { formatDate, formatUsdc, shortAddress } from "@/lib/format";
import type { Jar } from "@/lib/types";
import { usePreferences } from "@/hooks/usePreferences";

type Step = "review" | "wallet" | "submitted" | "confirming" | "success" | "error";

export function OwnerWithdrawalFlow({ jar, open, onClose, onSuccess }: { jar: Jar; open: boolean; onClose(): void; onSuccess(): Promise<void> }) {
  const { t } = usePreferences();
  const connection = useConnection();
  const verifiedChain = useVerifiedWalletChain();
  const queryClient = useQueryClient();
  const publicClient = usePublicClient({ chainId: arcTestnet.id });
  const { writeContractAsync } = useWriteContract();
  const [step, setStep] = useState<Step>("review");
  const [error, setError] = useState<string>();
  const [hash, setHash] = useState<Hash>();

  async function withdraw() {
    setError(undefined);
    try {
      const owner = await assertConnectedOwner(connection.connector, jar.owner, verifiedChain.isArc);
      if (!contractAddress || !publicClient) throw new Error("Withdrawal configuration is unavailable.");

      const [freshJar, latestBlock] = await Promise.all([
        publicClient.readContract({ address: contractAddress, abi: penguJarV3Abi, functionName: "getJar", args: [jar.id] }),
        publicClient.getBlock({ blockTag: "latest" }),
      ]);
      if (getAddress(freshJar.owner) !== getAddress(owner)) throw new Error("Only the jar owner can withdraw.");
      if (freshJar.closed) throw new Error("This jar has already been withdrawn.");
      if (latestBlock.timestamp < freshJar.unlockTime) throw new Error(`This jar remains locked until ${formatDate(freshJar.unlockTime)}.`);
      if (freshJar.balance === 0n) throw new Error("This jar has no balance to withdraw.");

      setStep("wallet");
      const submittedHash = await writeContractAsync({
        address: contractAddress,
        abi: penguJarV3Abi,
        functionName: "withdrawJar",
        args: [jar.id],
        account: owner,
        chainId: arcTestnet.id,
      });
      setHash(submittedHash);
      setStep("submitted");
      setStep("confirming");
      let replacementReason: string | undefined;
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: submittedHash,
        confirmations: 1,
        onReplaced: (replacement) => {
          replacementReason = replacement.reason;
          setHash(replacement.transaction.hash);
        },
      });
      if (replacementReason === "cancelled") throw new Error("The withdrawal transaction was cancelled.");
      if (receipt.status !== "success") throw new Error("The withdrawal reverted on Arc.");

      const withdrawnJar = await publicClient.readContract({ address: contractAddress, abi: penguJarV3Abi, functionName: "getJar", args: [jar.id] });
      if (!withdrawnJar.closed || withdrawnJar.balance !== 0n) throw new Error("Arc confirmed the transaction, but the closed jar state could not be verified.");
      if (getAddress(withdrawnJar.owner) !== getAddress(jar.owner)) throw new Error("Post-withdrawal owner verification failed.");
      await Promise.all([onSuccess(), queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] !== "jar-activity" })]);
      setStep("success");
    } catch (reason) {
      setError(withdrawalError(reason, t));
      setStep("error");
    }
  }

  function close() {
    if (isBusy(step)) return;
    setStep("review"); setError(undefined); setHash(undefined); onClose();
  }

  if (!open) return null;
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><section className="create-modal deposit-modal" role="dialog" aria-modal="true" aria-labelledby="withdraw-title">
    <div className="modal-header"><div><p className="eyebrow">{t("flow.ownerWithdrawal")} · {t("jar.number", { id: jar.id.toString() })}</p><h2 id="withdraw-title">{t("flow.withdrawName", { name: jar.name })}</h2></div><button onClick={close} disabled={isBusy(step)} aria-label={t("common.close")}>×</button></div>
    {step === "review" && <div className="review-panel"><dl><div><dt>{t("jar.number", { id: jar.id.toString() })}</dt><dd>{jar.name}</dd></div><div><dt>{t("flow.amount")}</dt><dd>{formatUsdc(jar.balance)} USDC</dd></div><div><dt>{t("jar.owner")}</dt><dd>{shortAddress(jar.owner)}</dd></div><div><dt>{t("jar.unlockDate")}</dt><dd>{formatDate(jar.unlockTime)}</dd></div><div><dt>{t("wallet.network")}</dt><dd>Arc Testnet</dd></div><div><dt>{t("flow.destination")}</dt><dd>{connection.address ? shortAddress(connection.address) : t("validation.disconnected")}</dd></div></dl><p className="review-note">{t("flow.withdrawWarning")}</p><div className="modal-actions"><button className="cancel-action" onClick={close}>{t("common.cancel")}</button><button className="primary-action" onClick={() => void withdraw()}>{t("flow.confirmWithdrawal")}</button></div></div>}
    {step === "success" && <Panel title={t("flow.withdrawSuccess")} copy={t("tx.success")} hash={hash} action={<button className="primary-action standalone-action" onClick={close}>{t("flow.closedJar")}</button>} />}
    {step === "error" && <Panel title={t("flow.withdrawFailed")} copy={error ?? t("tx.failed")} hash={hash} action={<button className="primary-action standalone-action" onClick={() => setStep("review")}>{t("flow.reviewRetry")}</button>} />}
    {!["review", "success", "error"].includes(step) && <Panel title={step === "wallet" ? t("tx.waiting") : step === "submitted" ? t("tx.submitted") : t("tx.confirming")} copy={t("create.submittedCopy")} hash={hash} />}
  </section></div>;
}

function Panel({ title, copy, hash, action }: { title: string; copy: string; hash?: Hash; action?: React.ReactNode }) {
  const { t } = usePreferences();
  return <div className="transaction-state"><span>↻</span><h3>{title}</h3><p>{copy}</p>{hash && <div className="transaction-links"><a href={`${ARC_EXPLORER_URL}/tx/${hash}`} target="_blank" rel="noreferrer">{t("tx.arcscan")} ↗</a></div>}{action}</div>;
}

function isBusy(step: Step) { return ["wallet", "submitted", "confirming"].includes(step); }

async function assertConnectedOwner(connector: Connector | undefined, owner: `0x${string}`, verifiedArc: boolean) {
  if (!connector || !verifiedArc) throw new Error("Switch the connected owner wallet to Arc Testnet before withdrawing.");
  const provider = await connector.getProvider() as { request(args: { method: string }): Promise<unknown> } | undefined;
  if (!provider) throw new Error("The connected wallet provider is unavailable.");
  const [accountsValue, providerChainValue, connectorChainId] = await Promise.all([provider.request({ method: "eth_accounts" }), provider.request({ method: "eth_chainId" }), connector.getChainId()]);
  const accounts = Array.isArray(accountsValue) ? accountsValue : [];
  if (typeof accounts[0] !== "string" || getAddress(accounts[0]) !== getAddress(owner)) throw new Error("Only the jar owner can withdraw.");
  const providerChainId = typeof providerChainValue === "string" ? Number.parseInt(providerChainValue, 16) : Number(providerChainValue);
  if (providerChainId !== arcTestnet.id || connectorChainId !== arcTestnet.id) throw new Error("The connected wallet is not verified on Arc Testnet.");
  return getAddress(accounts[0]);
}

function withdrawalError(reason: unknown, t: ReturnType<typeof usePreferences>["t"]) {
  const message = reason instanceof Error ? reason.message : "";
  if (/reject|denied|4001|replac|cancel/i.test(message)) return t("tx.rejected");
  if (/owner/i.test(message)) return t("actions.onlyOwnerWithdraw");
  if (/balance/i.test(message)) return t("actions.noBalance");
  if (/network|Arc|provider/i.test(message)) return t("wallet.switch");
  if (/revert|execution/i.test(message)) return t("validation.reverted");
  return t("tx.rpc");
}
