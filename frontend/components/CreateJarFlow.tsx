"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { decodeEventLog } from "viem";
import { useConnection, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { arcTestnet } from "viem/chains";
import { penguJarV2Abi } from "@/lib/abi/penguJarV2";
import { ARC_EXPLORER_URL, contractAddress } from "@/lib/config";
import { defaultUnlockLocal, minimumUnlockLocal, parseCreateJar, type CreateJarValues } from "@/lib/createJar";
import { formatLocalDateTime, formatUsdc, shortAddress } from "@/lib/format";
import { useVerifiedWalletChain } from "@/hooks/useVerifiedWalletChain";
import { usePreferences } from "@/hooks/usePreferences";

type Step = "form" | "review" | "wallet" | "submitted" | "success" | "error";

export function CreateJarFlow({ open, onClose, onConfirmed }: { open: boolean; onClose(): void; onConfirmed(): Promise<void> }) {
  const { t } = usePreferences();
  const connection = useConnection();
  const verifiedChain = useVerifiedWalletChain();
  const write = useWriteContract();
  const [values, setValues] = useState<CreateJarValues>({ name: "", target: "", unlockLocal: defaultUnlockLocal() });
  const [minimumUnlock] = useState(minimumUnlockLocal);
  const [step, setStep] = useState<Step>("form");
  const [formError, setFormError] = useState<string>();
  const [transactionError, setTransactionError] = useState<string>();
  const [confirmedHash, setConfirmedHash] = useState<`0x${string}`>();
  const finalizedHash = useRef<`0x${string}` | undefined>(undefined);
  const receipt = useWaitForTransactionReceipt({ hash: write.data, chainId: arcTestnet.id, query: { enabled: Boolean(write.data) } });
  const parsed = useMemo(() => { try { return parseCreateJar(values); } catch { return undefined; } }, [values]);
  const unlockParts = splitLocalDateTime(values.unlockLocal);
  const onArc = connection.status === "connected" && verifiedChain.isArc;

  function review(event: FormEvent) {
    event.preventDefault();
    try {
      parseCreateJar(values);
      setFormError(undefined);
      setStep("review");
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setFormError(/time|future|minute/i.test(message) ? t("validation.future") : message || t("tx.failed"));
    }
  }

  async function submit() {
    if (connection.status !== "connected" || !onArc || !contractAddress) return;
    const safe = parseCreateJar(values);
    setStep("wallet");
    setTransactionError(undefined);
    try {
      const hash = await write.mutateAsync({
        address: contractAddress,
        abi: penguJarV2Abi,
        functionName: "createJar",
        args: [safe.name, safe.targetAmount, safe.unlockTime, 0n],
        chainId: arcTestnet.id,
        account: connection.address,
      });
      setConfirmedHash(hash);
      setStep("submitted");
    } catch (error) {
      setTransactionError(transactionErrorMessage(error, t));
      setStep("error");
    }
  }

  useEffect(() => {
    if (step !== "submitted") return;
    const timer = window.setTimeout(() => {
      if (receipt.isSuccess && write.data && finalizedHash.current !== write.data) {
        finalizedHash.current = write.data;
        void onConfirmed().then(() => setStep("success"));
      }
      if (receipt.isError) {
        setTransactionError(transactionErrorMessage(receipt.error, t));
        setStep("error");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [onConfirmed, receipt.error, receipt.isError, receipt.isSuccess, step, t, write.data]);

  if (!open) return null;

  let jarId: bigint | undefined;
  if (receipt.data) {
    for (const log of receipt.data.logs) {
      try {
        const decoded = decodeEventLog({ abi: penguJarV2Abi, data: log.data, topics: log.topics });
        if (decoded.eventName === "JarCreated") jarId = decoded.args.jarId;
      } catch { /* unrelated log */ }
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && step !== "wallet" && step !== "submitted") onClose(); }}>
      <section className="create-modal" role="dialog" aria-modal="true" aria-labelledby="create-title">
        <div className="modal-header"><div><p className="eyebrow">{t("create.kicker")}</p><h2 id="create-title">{t("create.title")}</h2></div><button onClick={onClose} disabled={step === "wallet" || step === "submitted"} aria-label={t("common.close")}>×</button></div>
        <div className="step-indicator"><span className={step === "form" ? "active" : "done"}>1 {t("create.goal")}</span><i /><span className={step === "review" ? "active" : (["wallet","submitted","success"].includes(step) ? "done" : "")}>2 {t("create.review")}</span><i /><span className={["wallet","submitted"].includes(step) ? "active" : step === "success" ? "done" : ""}>3 {t("create.confirm")}</span></div>

        {step === "form" && <form className="create-form" onSubmit={review}>
          <label>{t("create.name")}<input value={values.name} maxLength={64} onChange={(event) => setValues({ ...values, name: event.target.value })} placeholder="Japan Trip" autoFocus /><small>{t("create.nameHelp")}</small></label>
          <label>{t("create.target")}<div className="unit-input"><input inputMode="decimal" value={values.target} onChange={(event) => setValues({ ...values, target: event.target.value })} placeholder="250.50" /><span>USDC</span></div><small>{t("create.amountHelp")}</small></label>
          <label>{t("create.unlock")}<div className="date-time-24"><input aria-label={t("jar.unlockDate")} type="date" value={unlockParts.date} min={minimumUnlock.slice(0, 10)} onChange={(event) => setValues({ ...values, unlockLocal: joinLocalDateTime(event.target.value, unlockParts.hour, unlockParts.minute) })} /><select aria-label={t("create.unlock")} value={unlockParts.hour} onChange={(event) => setValues({ ...values, unlockLocal: joinLocalDateTime(unlockParts.date, event.target.value, unlockParts.minute) })}>{timeOptions(24).map((hour) => <option key={hour} value={hour}>{hour}</option>)}</select><span>:</span><select aria-label={t("create.unlock")} value={unlockParts.minute} onChange={(event) => setValues({ ...values, unlockLocal: joinLocalDateTime(unlockParts.date, unlockParts.hour, event.target.value) })}>{timeOptions(60).map((minute) => <option key={minute} value={minute}>{minute}</option>)}</select></div><small>{parsed ? t("create.selected", { date: formatLocalDateTime(parsed.unlockDate) }) : t("create.timeHelp")}</small></label>
          {formError && <p className="form-alert" role="alert">{formError}</p>}
          <div className="modal-actions"><button type="button" className="cancel-action" onClick={onClose}>{t("common.cancel")}</button><button type="submit" className="primary-action">{t("create.reviewJar")}</button></div>
        </form>}

        {step === "review" && parsed && <div className="review-panel">
          <div className="review-hero"><span>✦</span><div><small>{t("create.name")}</small><strong>{parsed.name}</strong></div></div>
          <dl><div><dt>{t("jar.target")}</dt><dd>{formatUsdc(parsed.targetAmount)} USDC</dd></div><div><dt>{t("jar.unlocks")}</dt><dd>{formatLocalDateTime(parsed.unlockDate)}</dd></div><div><dt>{t("wallet.wallet")}</dt><dd>{connection.address ? shortAddress(connection.address) : t("actions.connect")}</dd></div><div><dt>{t("wallet.network")}</dt><dd>{onArc ? "Arc Testnet" : t("wallet.switch")}</dd></div><div><dt>{t("create.starting")}</dt><dd>0 USDC</dd></div></dl>
          <p className="review-note">{t("create.noDeposit")}</p>
          {!connection.isConnected && <p className="form-alert">{t("create.connectBefore")}</p>}
          {connection.isConnected && !onArc && <button className="switch-review" onClick={() => void verifiedChain.switchToArc()} disabled={["waiting", "switching", "missing"].includes(verifiedChain.switchStatus)}>{verifiedChain.switchStatus === "waiting" || verifiedChain.switchStatus === "missing" ? "Waiting for wallet…" : verifiedChain.switchStatus === "switching" ? "Switching network…" : "Switch to Arc Testnet"}</button>}
          {connection.isConnected && !onArc && verifiedChain.switchMessage && <p className="form-alert">{verifiedChain.switchMessage}</p>}
          <div className="modal-actions"><button className="cancel-action" onClick={() => setStep("form")}>{t("common.back")}</button><button className="primary-action" onClick={() => void submit()} disabled={!onArc || !contractAddress}>{t("create.confirmWallet")}</button></div>
        </div>}

        {step === "wallet" && <TransactionState icon="◌" title={t("create.waitingTitle")} copy={t("create.waitingCopy")} />}
        {step === "submitted" && <TransactionState icon="↻" title={receipt.isLoading ? t("create.confirming") : t("create.submitted")} copy={t("create.submittedCopy")} hash={confirmedHash} />}
        {step === "error" && <TransactionState icon="!" title={t("create.failed")} copy={transactionError ?? t("tx.failed")} hash={confirmedHash} action={<div className="modal-actions"><button className="cancel-action" onClick={onClose}>{t("common.close")}</button><button className="primary-action" onClick={() => setStep("review")}>{t("common.tryAgain")}</button></div>} />}
        {step === "success" && <TransactionState icon="✓" title={t("create.success")} copy={`${t("create.success")}${jarId ? ` #${jarId}` : ""}.`} hash={confirmedHash} action={<div className="modal-actions"><button className="primary-action" onClick={onClose}>{t("create.viewDashboard")}</button></div>} />}
      </section>
    </div>
  );
}

function splitLocalDateTime(value: string) {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(value);
  return { date: match?.[1] ?? "", hour: match?.[2] ?? "00", minute: match?.[3] ?? "00" };
}

function joinLocalDateTime(date: string, hour: string, minute: string) {
  return date ? `${date}T${hour}:${minute}` : "";
}

function timeOptions(count: number) {
  return Array.from({ length: count }, (_, value) => value.toString().padStart(2, "0"));
}

function TransactionState({ icon, title, copy, hash, action }: { icon: string; title: string; copy: string; hash?: `0x${string}`; action?: React.ReactNode }) {
  const { t } = usePreferences();
  return <div className="transaction-state"><span>{icon}</span><h3>{title}</h3><p>{copy}</p>{hash && <a href={`${ARC_EXPLORER_URL}/tx/${hash}`} target="_blank" rel="noreferrer">{t("tx.arcscan")} ↗</a>}{action}</div>;
}

function transactionErrorMessage(error: unknown, t: ReturnType<typeof usePreferences>["t"]) {
  const message = error instanceof Error ? error.message : "";
  if (/rejected|denied|4001/i.test(message)) return t("tx.rejected");
  if (/revert|execution/i.test(message)) return t("validation.reverted");
  if (/chain|network/i.test(message)) return t("wallet.switch");
  return t("tx.rpc");
}
