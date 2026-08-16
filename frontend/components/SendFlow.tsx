"use client";

import { useState } from "react";
import { useConnection, usePublicClient, useWriteContract } from "wagmi";
import { arcTestnet } from "viem/chains";
import { erc20BalanceAbi } from "@/lib/abi/erc20";
import { EXPECTED_USDC_ADDRESS } from "@/lib/config";
import { formatUsdc, shortAddress } from "@/lib/format";
import { arcScanTransactionUrl, maxUsdcAmount, normalizeRecipient, validateUsdcSend, type WalletActivity } from "@/lib/wallet";
import { usePreferences } from "@/hooks/usePreferences";
import { useVerifiedWalletChain } from "@/hooks/useVerifiedWalletChain";
import { WalletPanel } from "./WalletPanel";

type TransactionStage = "idle" | "awaiting" | "confirming" | "confirmed" | "failed";

export function SendFlow({ balance, onClose, onConfirmed }: { balance: bigint; onClose(): void; onConfirmed(activity: WalletActivity): void }) {
  const { locale } = usePreferences();
  const copy = sendCopy(locale);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState<string>();
  const [hash, setHash] = useState<`0x${string}`>();
  const [stage, setStage] = useState<TransactionStage>("idle");
  const connection = useConnection();
  const chain = useVerifiedWalletChain();
  const writer = useWriteContract();
  const client = usePublicClient({ chainId: arcTestnet.id });
  const validated = validateUsdcSend(recipient, amount, balance, connection.address);
  const pending = stage === "awaiting" || stage === "confirming";

  function validationMessage(result = validated) {
    if (!("error" in result)) return undefined;
    if (result.error === "address") return copy.invalidAddress;
    if (result.error === "self") return copy.selfSend;
    if (result.error === "balance") return copy.insufficient;
    return copy.invalidAmount;
  }

  function review() {
    const message = validationMessage();
    if (message) {
      setError(message);
      return;
    }
    setError(undefined);
    setReviewing(true);
    setStage("idle");
  }

  async function pasteRecipient() {
    try {
      const pasted = (await navigator.clipboard.readText()).trim();
      setRecipient(pasted);
      const normalized = normalizeRecipient(pasted);
      if (!normalized) setError(copy.invalidAddress);
      else if (connection.address && normalized.toLowerCase() === connection.address.toLowerCase()) setError(copy.selfSend);
      else setError(undefined);
    } catch {
      setError(copy.pasteFailed);
    }
  }

  function useMax() {
    setAmount(formatUsdc(maxUsdcAmount(balance)));
    setError(undefined);
  }

  async function submit() {
    if (pending || "error" in validated || !connection.address || !chain.isArc || !client) return;
    setError(undefined);
    setStage("awaiting");
    try {
      const txHash = await writer.writeContractAsync({
        address: EXPECTED_USDC_ADDRESS,
        abi: erc20BalanceAbi,
        functionName: "transfer",
        args: [validated.address, validated.amount],
        account: connection.address,
        chainId: arcTestnet.id,
      });
      setHash(txHash);
      setStage("confirming");
      const receipt = await client.waitForTransactionReceipt({ hash: txHash });
      const block = await client.getBlock({ blockNumber: receipt.blockNumber });
      onConfirmed({
        hash: txHash,
        direction: "send",
        amount: validated.amount,
        counterparty: validated.address,
        confirmedAt: Number(block.timestamp) * 1000,
      });
      setStage("confirmed");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message.toLowerCase() : "";
      setError(message.includes("reject") || message.includes("denied") ? copy.rejected : copy.failed);
      setStage("failed");
    }
  }

  if (stage === "confirmed" && hash && !("error" in validated)) {
    return <WalletPanel title={copy.title} onClose={onClose}><div className="transaction-state"><span>✓</span><h3>{copy.success}</h3><p>{formatUsdc(validated.amount)} USDC → {shortAddress(validated.address)}</p><a href={arcScanTransactionUrl(hash)} target="_blank" rel="noreferrer">{copy.view} ↗</a></div></WalletPanel>;
  }

  return (
    <WalletPanel title={copy.title} onClose={onClose}>
      {reviewing && !("error" in validated) ? (
        <div className="wallet-flow">
          <h3>{copy.review}</h3>
          <dl className="wallet-review">
            <div><dt>{copy.token}</dt><dd>USDC</dd></div>
            <div><dt>{copy.amount}</dt><dd>{formatUsdc(validated.amount)} USDC</dd></div>
            <div><dt>{copy.destination}</dt><dd>{validated.address}</dd></div>
            <div><dt>{copy.network}</dt><dd>Arc Testnet</dd></div>
            <div><dt>{copy.currentBalance}</dt><dd>{formatUsdc(balance)} USDC</dd></div>
            <div><dt>{copy.remainingBalance}</dt><dd>{formatUsdc(validated.remaining)} USDC</dd></div>
          </dl>
          <p className="wallet-notice">{copy.note}</p>
          {stage === "awaiting" && <p className="transaction-progress" role="status">{copy.awaiting}</p>}
          {stage === "confirming" && <p className="transaction-progress" role="status">{copy.confirming}{hash && <> · <a href={arcScanTransactionUrl(hash)} target="_blank" rel="noreferrer">ArcScan ↗</a></>}</p>}
          {stage === "failed" && error && <p className="field-error" role="alert">{error}</p>}
          {!chain.isArc && <p className="field-error">{copy.arcRequired}</p>}
          <div className="modal-actions">
            <button type="button" className="secondary-action" onClick={() => { setReviewing(false); setStage("idle"); }} disabled={pending}>{copy.back}</button>
            <button type="button" className="primary-action" onClick={() => void submit()} disabled={pending || !chain.isArc}>{stage === "awaiting" ? copy.awaitingShort : stage === "confirming" ? copy.confirmingShort : copy.confirm}</button>
          </div>
        </div>
      ) : (
        <form className="create-form wallet-flow" onSubmit={(event) => { event.preventDefault(); review(); }}>
          <label>{copy.recipient}<div className="wallet-field-with-action"><input value={recipient} onChange={(event) => { setRecipient(event.target.value); setError(undefined); }} placeholder="0x…" spellCheck={false} /><button type="button" onClick={() => void pasteRecipient()}>{copy.paste}</button></div></label>
          <label>{copy.amount}<div className="wallet-field-with-action amount"><input inputMode="decimal" value={amount} onChange={(event) => { setAmount(event.target.value); setError(undefined); }} placeholder="0.00" /><span>USDC</span><button type="button" onClick={useMax}>{copy.max}</button></div><small>{copy.available}: {formatUsdc(balance)} USDC</small></label>
          {error && <p className="field-error" role="alert">{error}</p>}
          <div className="modal-actions"><button type="button" className="secondary-action" onClick={onClose}>{copy.back}</button><button type="submit" className="primary-action">{copy.next}</button></div>
        </form>
      )}
    </WalletPanel>
  );
}

function sendCopy(locale: "en" | "vi") {
  return locale === "vi" ? {
    title: "Gửi USDC", recipient: "Địa chỉ nhận", amount: "Số tiền", next: "Kiểm tra", back: "Quay lại", confirm: "Xác nhận trong ví", review: "Kiểm tra giao dịch", token: "Tài sản", network: "Mạng", destination: "Người nhận", currentBalance: "Số dư USDC hiện tại", remainingBalance: "Số dư USDC còn lại", note: "Ví của bạn sẽ yêu cầu xác nhận rõ ràng. Makoto không giữ khóa riêng.", invalidAddress: "Nhập địa chỉ ví hợp lệ.", selfSend: "Không thể gửi USDC đến chính ví đang kết nối.", invalidAmount: "Nhập số tiền lớn hơn 0, tối đa 6 chữ số thập phân.", insufficient: "Số dư USDC không đủ.", awaiting: "Đang chờ bạn xác nhận trong ví.", awaitingShort: "Đang chờ ví…", confirming: "Đã gửi. Đang chờ Arc xác nhận giao dịch.", confirmingShort: "Đang xác nhận…", success: "Đã gửi USDC", failed: "Không thể gửi. RPC hoặc giao dịch không phản hồi như mong đợi.", rejected: "Bạn đã từ chối yêu cầu trong ví. Không có giao dịch mới được gửi.", view: "Xem trên ArcScan", paste: "Dán", pasteFailed: "Không thể đọc bộ nhớ tạm.", max: "TỐI ĐA", available: "Khả dụng", arcRequired: "Cần kết nối Arc Testnet.",
  } : {
    title: "Send USDC", recipient: "Recipient address", amount: "Amount", next: "Review", back: "Back", confirm: "Confirm in wallet", review: "Review transaction", token: "Asset", network: "Network", destination: "Recipient", currentBalance: "Current USDC balance", remainingBalance: "Estimated remaining USDC", note: "Your wallet will ask for explicit confirmation. Makoto never holds your private keys.", invalidAddress: "Enter a valid wallet address.", selfSend: "You cannot send USDC to the currently connected wallet.", invalidAmount: "Enter an amount greater than 0 with at most 6 decimals.", insufficient: "Your USDC balance is too low.", awaiting: "Awaiting confirmation in your wallet.", awaitingShort: "Awaiting wallet…", confirming: "Submitted. Confirming the transaction on Arc.", confirmingShort: "Confirming…", success: "USDC sent", failed: "Send failed because the RPC or transaction did not respond as expected.", rejected: "You rejected the wallet request. No new transaction was submitted.", view: "View on ArcScan", paste: "Paste", pasteFailed: "Clipboard access was unavailable.", max: "MAX", available: "Available", arcRequired: "Arc Testnet is required.",
  };
}
