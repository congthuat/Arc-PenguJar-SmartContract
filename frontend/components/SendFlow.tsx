"use client";

import { useRef, useState } from "react";
import { useConnection, usePublicClient, useWriteContract } from "wagmi";
import { arcTestnet } from "viem/chains";
import { erc20BalanceAbi } from "@/lib/abi/erc20";
import { formatAssetAmount, getAssetById, SUPPORTED_ASSETS, type SupportedAssetId } from "@/lib/assets";
import { shortAddress } from "@/lib/format";
import { arcScanAddressUrl, arcScanTransactionUrl, normalizeRecipient, validateAssetSend, type WalletActivity } from "@/lib/wallet";
import { createAssetActivity } from "@/lib/walletActivity";
import { classifyWalletFailure, isLargeSend } from "@/lib/walletSafety";
import { usePreferences } from "@/hooks/usePreferences";
import { useVerifiedWalletChain } from "@/hooks/useVerifiedWalletChain";
import { WalletPanel } from "./WalletPanel";

type TransactionStage = "idle" | "awaiting" | "confirming" | "confirmed" | "failed" | "unknown";
type RecipientKind = "checking" | "wallet" | "contract" | "unknown";

export function SendFlow({ balances, onClose, onConfirmed }: { balances: Record<SupportedAssetId, bigint>; onClose(): void; onConfirmed(activity: WalletActivity): void }) {
  const { locale } = usePreferences();
  const copy = sendCopy(locale);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [assetId, setAssetId] = useState<SupportedAssetId>("usdc");
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState<string>();
  const [hash, setHash] = useState<`0x${string}`>();
  const [stage, setStage] = useState<TransactionStage>("idle");
  const [largeAcknowledged, setLargeAcknowledged] = useState(false);
  const [recipientKind, setRecipientKind] = useState<RecipientKind>("unknown");
  const submittingRef = useRef(false);
  const connection = useConnection();
  const chain = useVerifiedWalletChain();
  const writer = useWriteContract();
  const client = usePublicClient({ chainId: arcTestnet.id });
  const asset = getAssetById(assetId)!;
  const balance = balances[assetId];
  const validated = validateAssetSend(recipient, amount, balance, asset, connection.address);
  const pending = stage === "awaiting" || stage === "confirming";
  const large = !("error" in validated) && isLargeSend(validated.amount, balance);

  function validationMessage(result = validated) {
    if (!("error" in result)) return undefined;
    if (result.error === "address") return copy.invalidAddress;
    if (result.error === "self") return copy.selfSend;
    if (result.error === "balance") return copy.insufficient;
    return copy.invalidAmount;
  }

  async function review() {
    const message = validationMessage();
    if (message) return setError(message);
    setError(undefined); setReviewing(true); setStage("idle");
    if ("error" in validated || !client) return;
    setRecipientKind("checking");
    try {
      const code = await client.getBytecode({ address: validated.address });
      setRecipientKind(code && code !== "0x" ? "contract" : "wallet");
    } catch { setRecipientKind("unknown"); }
  }

  function resetSafety() { setLargeAcknowledged(false); setRecipientKind("unknown"); setError(undefined); }

  async function pasteRecipient() {
    try {
      const pasted = (await navigator.clipboard.readText()).trim();
      setRecipient(pasted); resetSafety();
      const normalized = normalizeRecipient(pasted);
      if (!normalized) setError(copy.invalidAddress);
      else if (connection.address && normalized.toLowerCase() === connection.address.toLowerCase()) setError(copy.selfSend);
    } catch { setError(copy.pasteFailed); }
  }

  function useMax() { setAmount(formatAssetAmount(balance < 0n ? 0n : balance, asset)); resetSafety(); }

  function selectAsset(next: SupportedAssetId) {
    setAssetId(next); setAmount(""); setReviewing(false); setStage("idle"); setHash(undefined); submittingRef.current = false; resetSafety();
  }

  async function submit() {
    if (submittingRef.current || pending || "error" in validated || !connection.address || !client || (large && !largeAcknowledged)) return;
    submittingRef.current = true; setError(undefined); setStage("awaiting");
    let submittedHash: `0x${string}` | undefined;
    try {
      if (!(await chain.verifyNow())) throw new Error("Wrong network: Arc Testnet is required");
      const freshBalance = await client.readContract({ address: asset.address, abi: erc20BalanceAbi, functionName: "balanceOf", args: [connection.address] });
      if (validated.amount > freshBalance) {
        setError(copy.freshInsufficient); setStage("failed"); submittingRef.current = false; return;
      }
      await client.simulateContract({ address: asset.address, abi: erc20BalanceAbi, functionName: "transfer", args: [validated.address, validated.amount], account: connection.address });
      if (!(await chain.verifyNow())) throw new Error("Wrong network: Arc Testnet is required");
      submittedHash = await writer.writeContractAsync({ address: asset.address, abi: erc20BalanceAbi, functionName: "transfer", args: [validated.address, validated.amount], account: connection.address, chainId: arcTestnet.id });
      setHash(submittedHash); setStage("confirming");
      const receipt = await client.waitForTransactionReceipt({ hash: submittedHash });
      if (receipt.status !== "success") throw new Error("Transaction receipt reported a revert");
      const block = await client.getBlock({ blockNumber: receipt.blockNumber });
      onConfirmed(createAssetActivity(asset, { hash: submittedHash, direction: "send", amount: validated.amount, counterparty: validated.address, confirmedAt: Number(block.timestamp) * 1000 }));
      setStage("confirmed");
    } catch (caught) {
      const failure = classifyWalletFailure(caught, Boolean(submittedHash));
      setError(copy.failures[failure]); setStage(failure === "confirmation-unknown" ? "unknown" : "failed");
      if (!submittedHash) submittingRef.current = false;
    }
  }

  if (stage === "confirmed" && hash && !("error" in validated)) return <WalletPanel title={copy.title} onClose={onClose}><div className="transaction-state"><span>✓</span><h3>{copy.success}</h3><p>{formatAssetAmount(validated.amount, asset)} {asset.symbol} → {shortAddress(validated.address)}</p><a href={arcScanTransactionUrl(hash)} target="_blank" rel="noreferrer">{copy.view} ↗</a></div></WalletPanel>;

  if (stage === "unknown" && hash) return <WalletPanel title={copy.title} onClose={onClose}><div className="transaction-state transaction-unknown"><span>!</span><h3>{copy.unknownTitle}</h3><p>{error}</p><code>{hash}</code><a href={arcScanTransactionUrl(hash)} target="_blank" rel="noreferrer">{copy.view} ↗</a><p className="wallet-notice">{copy.checkBeforeRetry}</p></div></WalletPanel>;

  return <WalletPanel title={copy.title} onClose={onClose} closeDisabled={pending}>{reviewing && !("error" in validated) ? <div className="wallet-flow">
    <h3>{copy.review}</h3>
    <dl className="wallet-review">
      <div><dt>{copy.token}</dt><dd>{asset.symbol} · {asset.name} · <a href={arcScanAddressUrl(asset.address)} target="_blank" rel="noreferrer">{shortAddress(asset.address)} ↗</a></dd></div>
      <div><dt>{copy.amount}</dt><dd>{formatAssetAmount(validated.amount, asset)} {asset.symbol}</dd></div>
      <div><dt>{copy.destination}</dt><dd className="full-address">{validated.address}</dd></div>
      <div><dt>{copy.network}</dt><dd>Arc Testnet · 5042002</dd></div>
      <div><dt>{copy.currentBalance}</dt><dd>{formatAssetAmount(balance, asset)} {asset.symbol}</dd></div>
      <div><dt>{copy.remainingBalance}</dt><dd>{formatAssetAmount(validated.remaining, asset)} {asset.symbol}</dd></div>
    </dl>
    <div className="recipient-actions"><button type="button" onClick={() => void navigator.clipboard.writeText(validated.address)}>{copy.copyAddress}</button><a href={arcScanAddressUrl(validated.address)} target="_blank" rel="noreferrer">ArcScan ↗</a></div>
    {recipientKind === "checking" && <p className="wallet-hint">{copy.checkingRecipient}</p>}
    {recipientKind === "contract" && <p className="wallet-warning" role="alert">{copy.contractWarning}</p>}
    {large && <label className="large-send-warning"><strong>{copy.largeTitle}</strong><span>{copy.largeCopy}</span><span><input type="checkbox" checked={largeAcknowledged} onChange={(event) => setLargeAcknowledged(event.target.checked)} /> {copy.largeConfirm}</span></label>}
    <p className="wallet-notice">{copy.note}</p>
    {stage === "awaiting" && <p className="transaction-progress" role="status">{copy.awaiting}</p>}
    {stage === "confirming" && <p className="transaction-progress" role="status">{copy.confirming}{hash && <> · <a href={arcScanTransactionUrl(hash)} target="_blank" rel="noreferrer">ArcScan ↗</a></>}</p>}
    {stage === "failed" && error && <p className="field-error" role="alert">{error}</p>}
    {!chain.isArc && <p className="field-error">{copy.arcRequired}</p>}
    <div className="modal-actions"><button type="button" className="secondary-action" onClick={() => { setReviewing(false); setStage("idle"); }} disabled={pending}>{copy.back}</button><button type="button" className="primary-action" onClick={() => void submit()} disabled={pending || !chain.isArc || (large && !largeAcknowledged)}>{stage === "awaiting" ? copy.awaitingShort : stage === "confirming" ? copy.confirmingShort : copy.confirm}</button></div>
  </div> : <form className="create-form wallet-flow" onSubmit={(event) => { event.preventDefault(); void review(); }}>
    <label>{copy.asset}<select className="asset-selector" value={assetId} onChange={(event) => selectAsset(event.target.value as SupportedAssetId)}>{SUPPORTED_ASSETS.map((item) => <option key={item.id} value={item.id}>{item.symbol} · {item.name}</option>)}</select></label>
    <label>{copy.recipient}<div className="wallet-field-with-action"><input value={recipient} onChange={(event) => { setRecipient(event.target.value); resetSafety(); }} placeholder="0x…" spellCheck={false} /><button type="button" onClick={() => void pasteRecipient()}>{copy.paste}</button></div></label>
    <label>{copy.amount}<div className="wallet-field-with-action amount"><input inputMode="decimal" value={amount} onChange={(event) => { setAmount(event.target.value); resetSafety(); }} placeholder="0.00" /><span>{asset.symbol}</span><button type="button" onClick={useMax}>{copy.max}</button></div><small>{copy.available}: {formatAssetAmount(balance, asset)} {asset.symbol}</small></label>
    {error && <p className="field-error" role="alert">{error}</p>}
    <div className="modal-actions"><button type="button" className="secondary-action" onClick={onClose}>{copy.back}</button><button type="submit" className="primary-action">{copy.next}</button></div>
  </form>}</WalletPanel>;
}

function sendCopy(locale: "en" | "vi") {
  const vi = locale === "vi";
  return {
    title: vi ? "Gửi tài sản" : "Send asset", asset: vi ? "Tài sản" : "Asset", recipient: vi ? "Địa chỉ nhận" : "Recipient address", amount: vi ? "Số tiền" : "Amount", next: vi ? "Kiểm tra" : "Review", back: vi ? "Quay lại" : "Back", confirm: vi ? "Xác nhận trong ví" : "Confirm in wallet", review: vi ? "Kiểm tra giao dịch" : "Review transaction", token: vi ? "Tài sản / hợp đồng token" : "Asset / token contract", network: vi ? "Mạng" : "Network", destination: vi ? "Người nhận" : "Recipient", currentBalance: vi ? "Số dư hiện tại" : "Current balance", remainingBalance: vi ? "Số dư ước tính còn lại" : "Estimated remaining balance", note: vi ? "Ví sẽ yêu cầu xác nhận rõ ràng. Makoto không giữ khóa riêng." : "Your wallet will ask for explicit confirmation. Makoto never holds your private keys.", invalidAddress: vi ? "Nhập địa chỉ ví hợp lệ." : "Enter a valid wallet address.", selfSend: vi ? "Không thể gửi tài sản đến chính ví đang kết nối." : "You cannot send assets to the currently connected wallet.", invalidAmount: vi ? "Nhập số tiền lớn hơn 0, tối đa 6 chữ số thập phân." : "Enter an amount greater than 0 with at most 6 decimals.", insufficient: vi ? "Số dư tài sản đã chọn không đủ." : "Your selected asset balance is too low.", freshInsufficient: vi ? "Số dư vừa thay đổi và không còn đủ. Không có giao dịch nào được gửi." : "Your balance changed and is no longer sufficient. No transaction was submitted.", awaiting: vi ? "Đang chờ bạn xác nhận trong ví." : "Awaiting confirmation in your wallet.", awaitingShort: vi ? "Đang chờ ví…" : "Awaiting wallet…", confirming: vi ? "Đã gửi. Đang chờ Arc xác nhận giao dịch." : "Submitted. Confirming the transaction on Arc.", confirmingShort: vi ? "Đang xác nhận…" : "Confirming…", success: vi ? "Đã gửi tài sản" : "Asset sent", view: vi ? "Xem trên ArcScan" : "View on ArcScan", paste: vi ? "Dán" : "Paste", pasteFailed: vi ? "Không thể đọc bộ nhớ tạm." : "Clipboard access was unavailable.", max: vi ? "TỐI ĐA" : "MAX", available: vi ? "Khả dụng" : "Available", arcRequired: vi ? "Cần kết nối Arc Testnet." : "Arc Testnet is required.", copyAddress: vi ? "Sao chép địa chỉ" : "Copy address", checkingRecipient: vi ? "Đang kiểm tra địa chỉ người nhận…" : "Checking recipient address…", contractWarning: vi ? "Địa chỉ người nhận là hợp đồng. Hãy chắc chắn hợp đồng này có thể nhận tài sản đã chọn." : "The recipient is a contract. Make sure it can receive the selected asset.", largeTitle: vi ? "Giao dịch lớn" : "Large send", largeCopy: vi ? "Bạn đang gửi ít nhất 50% số dư tài sản đã chọn." : "You are sending at least 50% of your selected asset balance.", largeConfirm: vi ? "Tôi đã kiểm tra người nhận và số tiền." : "I checked the recipient and amount.", unknownTitle: vi ? "Đã gửi — trạng thái xác nhận chưa rõ" : "Submitted — confirmation status unknown", checkBeforeRetry: vi ? "Kiểm tra giao dịch trên ArcScan trước khi thử lại để tránh gửi hai lần." : "Check ArcScan before retrying to avoid sending twice.",
    failures: {
      rejected: vi ? "Bạn đã từ chối yêu cầu trong ví. Không có giao dịch nào được gửi." : "You rejected the wallet request. No transaction was submitted.",
      "wrong-network": vi ? "Ví không còn ở Arc Testnet. Không có giao dịch nào được gửi." : "Your wallet is no longer on Arc Testnet. No transaction was submitted.",
      "insufficient-gas": vi ? "Không đủ token gas gốc để gửi giao dịch. Không có giao dịch nào được gửi." : "There is not enough native gas token to submit this transaction. No transaction was submitted.",
      reverted: vi ? "Mô phỏng giao dịch thất bại hoặc giao dịch sẽ bị hoàn tác. Không có giao dịch nào được gửi." : "The transaction simulation failed or would revert. No transaction was submitted.",
      "confirmation-unknown": vi ? "RPC không thể xác nhận kết quả sau khi giao dịch đã được gửi." : "The RPC could not confirm the result after the transaction was submitted.",
      rpc: vi ? "Không thể hoàn tất kiểm tra RPC. Không có giao dịch nào được gửi." : "The RPC safety checks could not complete. No transaction was submitted.",
    },
  };
}
