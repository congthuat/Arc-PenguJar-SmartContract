"use client";

import { FormEvent, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getAddress, type Hash } from "viem";
import { useConnection, usePublicClient, useReadContract, useWriteContract, type Connector } from "wagmi";
import { arcTestnet } from "viem/chains";
import { useVerifiedWalletChain } from "@/hooks/useVerifiedWalletChain";
import { usePreferences } from "@/hooks/usePreferences";
import { useWalletBalances } from "@/hooks/useWalletBalances";
import { erc20BalanceAbi } from "@/lib/abi/erc20";
import { penguJarV3Abi } from "@/lib/abi/penguJarV3";
import { ARC_EXPLORER_URL, contractAddress, EXPECTED_USDC_ADDRESS } from "@/lib/config";
import { parseContributionAmount } from "@/lib/deposit";
import { formatUsdc, shortAddress } from "@/lib/format";
import { confirmThenRefresh } from "@/lib/confirmedTransaction";
import { getAssetById } from "@/lib/assets";
import { createAssetActivity, recordWalletActivity } from "@/lib/walletActivity";
import type { Jar } from "@/lib/types";

type Step = "form" | "review" | "checking" | "approval-required" | "approval-wallet" | "approval-submitted" | "approval-confirmed" | "ready" | "contribution-wallet" | "contribution-submitted" | "confirming" | "success" | "error";

export function SharedContributionFlow({ jar, open, onClose, onSuccess }: { jar: Jar; open: boolean; onClose(): void; onSuccess(): Promise<void> }) {
  const { t } = usePreferences();
  const connection = useConnection();
  const verifiedChain = useVerifiedWalletChain();
  const queryClient = useQueryClient();
  const publicClient = usePublicClient({ chainId: arcTestnet.id });
  const { writeContractAsync } = useWriteContract();
  const balances = useWalletBalances(connection.address, connection.isConnected && verifiedChain.isArc);
  const allowance = useReadContract({
    address: EXPECTED_USDC_ADDRESS,
    abi: erc20BalanceAbi,
    functionName: "allowance",
    args: connection.address && contractAddress ? [connection.address, contractAddress] : undefined,
    chainId: arcTestnet.id,
    query: { enabled: Boolean(open && connection.address && contractAddress && verifiedChain.isArc) },
  });
  const [value, setValue] = useState("");
  const [step, setStep] = useState<Step>("form");
  const [error, setError] = useState<string>();
  const [approvalHash, setApprovalHash] = useState<Hash>();
  const [contributionHash, setContributionHash] = useState<Hash>();
  const amount = useMemo(() => { try { return parseContributionAmount(value); } catch { return undefined; } }, [value]);

  function review(event: FormEvent) {
    event.preventDefault();
    try {
      const parsed = parseContributionAmount(value);
      if (balances.usdc.data !== undefined && parsed > balances.usdc.data) throw new Error("Contribution exceeds your available USDC balance.");
      setError(undefined);
      setStep("review");
    } catch {
      setError(t("validation.amount"));
    }
  }

  async function checkAllowance() {
    if (!amount) return;
    setStep("checking");
    setError(undefined);
    try {
      await assertCurrentContributor(connection.connector, verifiedChain.isArc);
      assertJarAcceptsContributions(jar);
      const [freshAllowance, freshBalance] = await Promise.all([allowance.refetch(), balances.usdc.refetch()]);
      if (freshBalance.data === undefined || freshBalance.data < amount) throw new Error("Your wallet does not have enough USDC for this contribution.");
      setStep((freshAllowance.data ?? 0n) >= amount ? "ready" : "approval-required");
    } catch (reason) {
      fail(reason, "approval");
    }
  }

  async function approve() {
    if (!amount) return;
    setError(undefined);
    try {
      const contributor = await assertCurrentContributor(connection.connector, verifiedChain.isArc);
      assertJarAcceptsContributions(jar);
      const [freshAllowance, freshBalance] = await Promise.all([allowance.refetch(), balances.usdc.refetch()]);
      if (freshBalance.data === undefined || freshBalance.data < amount) throw new Error("Your wallet does not have enough USDC for this contribution.");
      if ((freshAllowance.data ?? 0n) >= amount) { setStep("ready"); return; }
      if (!contractAddress || !publicClient) throw new Error("Contribution configuration is unavailable.");
      setStep("approval-wallet");
      const hash = await writeContractAsync({ address: EXPECTED_USDC_ADDRESS, abi: erc20BalanceAbi, functionName: "approve", args: [contractAddress, amount], account: contributor, chainId: arcTestnet.id });
      setApprovalHash(hash);
      setStep("approval-submitted");
      let replacementReason: string | undefined;
      const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1, onReplaced: (replacement) => { replacementReason = replacement.reason; setApprovalHash(replacement.transaction.hash); } });
      if (replacementReason === "cancelled") throw new Error("The approval transaction was cancelled.");
      if (receipt.status !== "success") throw new Error("The USDC approval reverted.");
      const confirmed = await allowance.refetch();
      if ((confirmed.data ?? 0n) < amount) throw new Error("The confirmed USDC allowance is still too low.");
      setStep("approval-confirmed");
    } catch (reason) {
      fail(reason, "approval");
    }
  }

  async function contribute() {
    if (!amount) return;
    setError(undefined);
    try {
      const contributor = await assertCurrentContributor(connection.connector, verifiedChain.isArc);
      assertJarAcceptsContributions(jar);
      const [freshAllowance, freshBalance] = await Promise.all([allowance.refetch(), balances.usdc.refetch()]);
      if ((freshAllowance.data ?? 0n) < amount) throw new Error("USDC allowance changed. Check it again before contributing.");
      if (freshBalance.data === undefined || freshBalance.data < amount) throw new Error("Your wallet no longer has enough USDC.");
      if (!contractAddress || !publicClient) throw new Error("Contribution configuration is unavailable.");
      const jarAddress = contractAddress;
      const [onchainJarBefore, latestBlock] = await Promise.all([
        publicClient.readContract({ address: jarAddress, abi: penguJarV3Abi, functionName: "getJar", args: [jar.id] }),
        publicClient.getBlock({ blockTag: "latest" }),
      ]);
      if (getAddress(onchainJarBefore.owner) !== getAddress(jar.owner)) throw new Error("Jar ownership changed; contribution was stopped.");
      if (onchainJarBefore.closed || latestBlock.timestamp >= onchainJarBefore.unlockTime) throw new Error("This jar can no longer receive contributions.");

      setStep("contribution-wallet");
      const hash = await writeContractAsync({ address: jarAddress, abi: penguJarV3Abi, functionName: "contributeToJar", args: [jar.id, amount], account: contributor, chainId: arcTestnet.id });
      setContributionHash(hash);
      setStep("contribution-submitted");
      setStep("confirming");
      let replacementReason: string | undefined;
      const receiptPromise = publicClient.waitForTransactionReceipt({ hash, confirmations: 1, onReplaced: (replacement) => { replacementReason = replacement.reason; setContributionHash(replacement.transaction.hash); } }).then((receipt) => {
        if (replacementReason === "cancelled") throw new Error("The contribution transaction was cancelled.");
        return receipt;
      });
      const receipt = await receiptPromise;
      const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber });
      await confirmThenRefresh({
        receipt: Promise.resolve(receipt),
        onConfirmed: () => { const usdc = getAssetById("usdc")!; const transferLog = receipt.logs.find((log) => log.address.toLowerCase() === usdc.address.toLowerCase()); recordWalletActivity(contributor, arcTestnet.id, createAssetActivity(usdc, { hash: receipt.transactionHash, logIndex: transferLog?.logIndex ?? -1, direction: "send", kind: "vault-deposit", amount: amount!, counterparty: jarAddress, confirmedAt: Number(block.timestamp) * 1000, blockNumber: receipt.blockNumber })); setStep("success"); },
        refresh: async () => {
          const [onchainJarAfter] = await Promise.all([publicClient.readContract({ address: jarAddress, abi: penguJarV3Abi, functionName: "getJar", args: [jar.id] }), onSuccess(), balances.usdc.refetch(), allowance.refetch(), queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] !== "jar-activity" })]);
          if (getAddress(onchainJarAfter.owner) !== getAddress(jar.owner)) throw new Error("Post-contribution ownership verification failed.");
        },
      });
    } catch (reason) {
      fail(reason, "contribution");
    }
  }

  function fail(reason: unknown, action: "approval" | "contribution") {
    setError(transactionError(reason, action, t));
    setStep("error");
  }

  function close() {
    if (isBusy(step)) return;
    setValue(""); setStep("form"); setError(undefined); setApprovalHash(undefined); setContributionHash(undefined); onClose();
  }

  if (!open) return null;
  const expectedBalance = amount === undefined ? undefined : jar.balance + amount;
  const expectedShared = amount === undefined ? undefined : jar.totalContributed + amount;
  const hashes = { approvalHash, contributionHash };

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><section className="create-modal deposit-modal" role="dialog" aria-modal="true" aria-labelledby="contribution-title">
    <div className="modal-header"><div><p className="eyebrow">{t("flow.sharedContribution")} · {t("jar.number", { id: jar.id.toString() })}</p><h2 id="contribution-title">{t("flow.helpFund", { name: jar.name })}</h2></div><button onClick={close} disabled={isBusy(step)} aria-label={t("common.close")}>×</button></div>
    {step === "form" && <form className="create-form" onSubmit={review}><div className="deposit-summary"><span>{t("jar.saved")}<strong>{formatUsdc(jar.balance)} USDC</strong></span><span>{t("jar.target")}<strong>{formatUsdc(jar.targetAmount)} USDC</strong></span><span>{t("jar.shared")}<strong>{formatUsdc(jar.totalContributed)} USDC</strong></span><span>{t("jar.owner")}<strong>{shortAddress(jar.owner)}</strong></span><span>{t("wallet.wallet")}<strong>{connection.address ? shortAddress(connection.address) : t("validation.disconnected")}</strong></span><span>{t("flow.walletBalance")}<strong>{balances.usdc.data === undefined ? t("common.loading") : `${formatUsdc(balances.usdc.data)} USDC`}</strong></span></div><label>{t("flow.contributionAmount")}<div className="unit-input"><input inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} placeholder="0.00" autoFocus /><span>USDC</span></div><small>{t("create.amountHelp")}</small></label>{error && <p className="form-alert" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="cancel-action" onClick={close}>{t("common.cancel")}</button><button type="submit" className="primary-action">{t("flow.reviewContribution")}</button></div></form>}
    {step === "review" && amount && expectedBalance !== undefined && expectedShared !== undefined && <div className="review-panel"><dl><div><dt>{t("actions.contribute")}</dt><dd>{formatUsdc(amount)} USDC</dd></div><div><dt>{t("jar.number", { id: jar.id.toString() })}</dt><dd>{jar.name}</dd></div><div><dt>{t("jar.owner")}</dt><dd>{shortAddress(jar.owner)}</dd></div><div><dt>{t("jar.saved")}</dt><dd>{formatUsdc(jar.balance)} → {formatUsdc(expectedBalance)} USDC</dd></div><div><dt>{t("jar.shared")}</dt><dd>{formatUsdc(jar.totalContributed)} → {formatUsdc(expectedShared)} USDC</dd></div><div><dt>{t("flow.contributor")}</dt><dd>{connection.address ? shortAddress(connection.address) : t("validation.disconnected")}</dd></div><div><dt>{t("wallet.network")}</dt><dd>Arc Testnet</dd></div></dl><p className="review-note"><strong>{t("flow.contributionWarning")}</strong></p><div className="modal-actions"><button className="cancel-action" onClick={() => setStep("form")}>{t("common.back")}</button><button className="primary-action" onClick={() => void checkAllowance()}>{t("flow.checkAllowance")}</button></div></div>}
    {step === "approval-required" && <Panel title={t("flow.approvalRequired")} copy={t("flow.approvalExactCopy")} hashes={hashes} action={<button className="primary-action standalone-action" onClick={() => void approve()}>{t("flow.approveExact")}</button>} />}
    {step === "approval-confirmed" && <Panel title={t("flow.approvalConfirmed")} copy={t("tx.success")} hashes={hashes} action={<button className="primary-action standalone-action" onClick={() => setStep("ready")}>{t("flow.continue")}</button>} />}
    {step === "ready" && <Panel title={t("flow.readyContribution")} copy={t("create.waitingCopy")} hashes={hashes} action={<button className="primary-action standalone-action" onClick={() => void contribute()}>{t("flow.confirmContribution")}</button>} />}
    {step === "success" && <Panel title={t("flow.contributionSuccess")} copy={t("tx.success")} hashes={hashes} action={<button className="primary-action standalone-action" onClick={close}>{t("flow.updatedJar")}</button>} />}
    {step === "error" && <Panel title={t("flow.contributionFailed")} copy={error ?? t("tx.failed")} hashes={hashes} action={<button className="primary-action standalone-action" onClick={() => setStep("review")}>{t("flow.reviewRetry")}</button>} />}
    {!["form", "review", "approval-required", "approval-confirmed", "ready", "success", "error"].includes(step) && <Panel title={stepTitle(step, t)} copy={step === "checking" ? t("flow.checkAllowance") : t("create.submittedCopy")} hashes={hashes} />}
  </section></div>;
}

function Panel({ title, copy, hashes, action }: { title: string; copy: string; hashes: { approvalHash?: Hash; contributionHash?: Hash }; action?: React.ReactNode }) {
  const { t } = usePreferences();
  return <div className="transaction-state"><span>↻</span><h3>{title}</h3><p>{copy}</p><div className="transaction-links">{hashes.approvalHash && <a href={`${ARC_EXPLORER_URL}/tx/${hashes.approvalHash}`} target="_blank" rel="noreferrer">{t("tx.arcscan")} ↗</a>}{hashes.contributionHash && <a href={`${ARC_EXPLORER_URL}/tx/${hashes.contributionHash}`} target="_blank" rel="noreferrer">{t("tx.arcscan")} ↗</a>}</div>{action}</div>;
}

function stepTitle(step: Step, t: ReturnType<typeof usePreferences>["t"]) {
  const labels: Partial<Record<Step, string>> = { checking: t("flow.checkAllowance"), "approval-wallet": t("tx.waiting"), "approval-submitted": t("tx.submitted"), "contribution-wallet": t("tx.waiting"), "contribution-submitted": t("tx.submitted"), confirming: t("tx.confirming") };
  return labels[step] ?? "Working…";
}

function isBusy(step: Step) { return ["checking", "approval-wallet", "approval-submitted", "contribution-wallet", "contribution-submitted", "confirming"].includes(step); }

async function assertCurrentContributor(connector: Connector | undefined, verifiedArc: boolean) {
  if (!connector || !verifiedArc) throw new Error("Switch the connected wallet to Arc Testnet before contributing.");
  const provider = await connector.getProvider() as { request(args: { method: string }): Promise<unknown> } | undefined;
  if (!provider) throw new Error("The connected wallet provider is unavailable.");
  const [accountsValue, providerChainValue, connectorChainId] = await Promise.all([provider.request({ method: "eth_accounts" }), provider.request({ method: "eth_chainId" }), connector.getChainId()]);
  const accounts = Array.isArray(accountsValue) ? accountsValue : [];
  if (typeof accounts[0] !== "string") throw new Error("The contributor wallet disconnected.");
  const providerChainId = typeof providerChainValue === "string" ? Number.parseInt(providerChainValue, 16) : Number(providerChainValue);
  if (providerChainId !== arcTestnet.id || connectorChainId !== arcTestnet.id) throw new Error("The connected wallet is not verified on Arc Testnet.");
  return getAddress(accounts[0]);
}

function assertJarAcceptsContributions(jar: Jar) {
  if (jar.closed) throw new Error("This jar is closed and cannot receive contributions.");
  if (BigInt(Math.floor(Date.now() / 1000)) >= jar.unlockTime) throw new Error("This jar has reached its unlock time and cannot receive contributions.");
}

function transactionError(reason: unknown, action: "approval" | "contribution", t: ReturnType<typeof usePreferences>["t"]) {
  const message = reason instanceof Error ? reason.message : "";
  if (/reject|denied|4001|replac|cancel/i.test(message)) return t("tx.rejected");
  if (/balance/i.test(message)) return t("validation.balance");
  if (/network|Arc|provider/i.test(message)) return t("wallet.switch");
  if (/revert|execution/i.test(message)) return t("validation.reverted");
  return action === "approval" ? t("flow.approvalRequired") : t("tx.rpc");
}
