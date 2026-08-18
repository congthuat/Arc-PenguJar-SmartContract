"use client";

import { useMemo, useRef, useState } from "react";
import { useConnection, usePublicClient, useWriteContract } from "wagmi";
import { arcTestnet } from "viem/chains";
import { erc20BalanceAbi } from "@/lib/abi/erc20";
import { formatAssetAmount, getAssetById, SUPPORTED_ASSETS, type SupportedAssetId } from "@/lib/assets";
import { shortAddress } from "@/lib/format";
import { arcScanAddressUrl, arcScanTransactionUrl, normalizeRecipient, validateAssetSend, type WalletActivity } from "@/lib/wallet";
import { createAssetActivity } from "@/lib/walletActivity";
import { classifyWalletFailure, isLargeSend } from "@/lib/walletSafety";
import { ContactError, deleteContact, loadContacts, loadRecentRecipients, recordRecentRecipient, saveContact, type WalletContact } from "@/lib/contacts";
import { ARC_MEMO_ADDRESS, arcMemoAbi, buildArcMemoTransfer, normalizeMemoNote, verifyMemoEvent } from "@/lib/arcMemo";
import { usePreferences } from "@/hooks/usePreferences";
import { useVerifiedWalletChain } from "@/hooks/useVerifiedWalletChain";
import { WalletPanel } from "./WalletPanel";

type TransactionStage = "idle" | "awaiting" | "confirming" | "confirmed" | "failed" | "unknown";
type RecipientKind = "checking" | "wallet" | "contract" | "unknown";
type MemoCompatibility = "none" | "checking" | "compatible" | "contract-wallet" | "unavailable";
type MemoVerification = "none" | "verified" | "unverified";

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
  const [contactsRevision, setContactsRevision] = useState(0);
  const [contactFormOpen, setContactFormOpen] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactFeedback, setContactFeedback] = useState<string>();
  const [note, setNote] = useState("");
  const [memoCompatibility, setMemoCompatibility] = useState<MemoCompatibility>("none");
  const [memoVerification, setMemoVerification] = useState<MemoVerification>("none");
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
  const contacts = useMemo(() => { void contactsRevision; return connection.address ? loadContacts(connection.address, arcTestnet.id) : []; }, [connection.address, contactsRevision]);
  const recents = useMemo(() => { void contactsRevision; return connection.address ? loadRecentRecipients(connection.address, arcTestnet.id) : []; }, [connection.address, contactsRevision]);
  const normalizedRecipient = normalizeRecipient(recipient);
  const matchedContact = normalizedRecipient ? contacts.find((item) => item.address.toLowerCase() === normalizedRecipient.toLowerCase()) : undefined;
  const canSaveContact = Boolean(connection.address && normalizedRecipient && normalizedRecipient.toLowerCase() !== connection.address.toLowerCase() && !matchedContact);
  const memoNote = memoNoteResult(note);

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
    if (memoNote.error) return setError(copy.memoInvalid);
    setError(undefined); setReviewing(true); setStage("idle");
    if ("error" in validated || !client) return;
    setRecipientKind("checking");
    setMemoCompatibility(memoNote.note ? "checking" : "none");
    try {
      if (!memoNote.note || !connection.address) {
        const code = await client.getBytecode({ address: validated.address });
        setRecipientKind(code && code !== "0x" ? "contract" : "wallet");
        return;
      }
      const [recipientCode, senderCode, memoCode] = await Promise.all([client.getBytecode({ address: validated.address }), client.getBytecode({ address: connection.address }), client.getBytecode({ address: ARC_MEMO_ADDRESS })]);
      setRecipientKind(recipientCode && recipientCode !== "0x" ? "contract" : "wallet");
      setMemoCompatibility(senderCode && senderCode !== "0x" ? "contract-wallet" : memoCode && memoCode !== "0x" ? "compatible" : "unavailable");
    } catch { setRecipientKind("unknown"); if (memoNote.note) setMemoCompatibility("unavailable"); }
  }

  function resetSafety() { setLargeAcknowledged(false); setRecipientKind("unknown"); setMemoCompatibility("none"); setMemoVerification("none"); setError(undefined); }

  function selectRecipient(address: `0x${string}`) { setRecipient(address); setReviewing(false); setContactFormOpen(false); setContactFeedback(undefined); resetSafety(); }

  function submitContact() {
    if (!connection.address || !normalizedRecipient) return;
    try { saveContact(connection.address, arcTestnet.id, contactName, normalizedRecipient); setContactsRevision((value) => value + 1); setContactName(""); setContactFormOpen(false); setContactFeedback(copy.contactSaved); }
    catch (caught) { setContactFeedback(caught instanceof ContactError ? copy.contactErrors[caught.code] : copy.contactSaveFailed); }
  }

  function removeSavedContact(contact: WalletContact) {
    if (!connection.address || !window.confirm(copy.removeConfirm.replace("{name}", contact.name))) return;
    deleteContact(connection.address, arcTestnet.id, contact.address); setContactsRevision((value) => value + 1); setContactFeedback(copy.contactRemoved);
  }

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
    if (submittingRef.current || pending || "error" in validated || !connection.address || !client || memoNote.error || (memoNote.note && memoCompatibility !== "compatible") || (large && !largeAcknowledged)) return;
    submittingRef.current = true; setError(undefined); setStage("awaiting");
    let submittedHash: `0x${string}` | undefined;
    try {
      if (!(await chain.verifyNow())) throw new Error("Wrong network: Arc Testnet is required");
      const memoTransfer = memoNote.note ? buildArcMemoTransfer({ sender: connection.address, token: asset.address, recipient: validated.address, amount: validated.amount, note: memoNote.note }) : undefined;
      if (memoTransfer) {
        const [senderCode, memoCode] = await Promise.all([client.getBytecode({ address: connection.address }), client.getBytecode({ address: ARC_MEMO_ADDRESS })]);
        if (senderCode && senderCode !== "0x") { setError(copy.eoaRequired); setStage("failed"); submittingRef.current = false; return; }
        if (!memoCode || memoCode === "0x") { setError(copy.memoUnavailable); setStage("failed"); submittingRef.current = false; return; }
      }
      const freshBalance = await client.readContract({ address: asset.address, abi: erc20BalanceAbi, functionName: "balanceOf", args: [connection.address] });
      if (validated.amount > freshBalance) {
        setError(copy.freshInsufficient); setStage("failed"); submittingRef.current = false; return;
      }
      if (memoTransfer) {
        await client.simulateContract({ address: ARC_MEMO_ADDRESS, abi: arcMemoAbi, functionName: "memo", args: memoTransfer.args, account: connection.address });
        if (!(await chain.verifyNow())) throw new Error("Wrong network: Arc Testnet is required");
        submittedHash = await writer.writeContractAsync({ address: ARC_MEMO_ADDRESS, abi: arcMemoAbi, functionName: "memo", args: memoTransfer.args, account: connection.address, chainId: arcTestnet.id });
      } else {
        await client.simulateContract({ address: asset.address, abi: erc20BalanceAbi, functionName: "transfer", args: [validated.address, validated.amount], account: connection.address });
        if (!(await chain.verifyNow())) throw new Error("Wrong network: Arc Testnet is required");
        submittedHash = await writer.writeContractAsync({ address: asset.address, abi: erc20BalanceAbi, functionName: "transfer", args: [validated.address, validated.amount], account: connection.address, chainId: arcTestnet.id });
      }
      setHash(submittedHash); setStage("confirming");
      const receipt = await client.waitForTransactionReceipt({ hash: submittedHash });
      if (receipt.status !== "success") throw new Error("Transaction receipt reported a revert");
      const block = await client.getBlock({ blockNumber: receipt.blockNumber });
      const transferLog = receipt.logs.find((log) => log.address.toLowerCase() === asset.address.toLowerCase());
      setMemoVerification(memoTransfer ? verifyMemoEvent(receipt.logs, { ...memoTransfer, sender: connection.address, target: asset.address }) ? "verified" : "unverified" : "none");
      onConfirmed(createAssetActivity(asset, { hash: submittedHash, logIndex: transferLog?.logIndex ?? -1, direction: "send", kind: "transfer", amount: validated.amount, counterparty: validated.address, confirmedAt: Number(block.timestamp) * 1000, blockNumber: receipt.blockNumber }));
      recordRecentRecipient(connection.address, arcTestnet.id, validated.address);
      setStage("confirmed");
    } catch (caught) {
      const failure = classifyWalletFailure(caught, Boolean(submittedHash));
      setError(copy.failures[failure]); setStage(failure === "confirmation-unknown" ? "unknown" : "failed");
      if (!submittedHash) submittingRef.current = false;
    }
  }

  if (stage === "confirmed" && hash && !("error" in validated)) return <WalletPanel title={copy.title} onClose={onClose}><div className="transaction-state"><span>✓</span><h3>{copy.success}</h3><p>{formatAssetAmount(validated.amount, asset)} {asset.symbol} → {matchedContact?.name ?? shortAddress(validated.address)}<br /><span className="full-address">{validated.address}</span></p>{memoNote.note && <div className="memo-success"><strong>{copy.onchainNote}</strong><span>{memoNote.note}</span><b className={memoVerification === "verified" ? "memo-verified" : "memo-unverified"}>{memoVerification === "verified" ? `✓ ${copy.memoVerified}` : copy.memoUnverified}</b></div>}<a href={arcScanTransactionUrl(hash)} target="_blank" rel="noreferrer">{copy.view} ↗</a></div></WalletPanel>;

  if (stage === "unknown" && hash) return <WalletPanel title={copy.title} onClose={onClose}><div className="transaction-state transaction-unknown"><span>!</span><h3>{copy.unknownTitle}</h3><p>{error}</p><code>{hash}</code><a href={arcScanTransactionUrl(hash)} target="_blank" rel="noreferrer">{copy.view} ↗</a><p className="wallet-notice">{copy.checkBeforeRetry}</p></div></WalletPanel>;

  return <WalletPanel title={copy.title} onClose={onClose} closeDisabled={pending}>{reviewing && !("error" in validated) ? <div className="wallet-flow">
    <h3>{copy.review}</h3>
    <dl className="wallet-review">
      <div><dt>{copy.token}</dt><dd>{asset.symbol} · {asset.name} · <a href={arcScanAddressUrl(asset.address)} target="_blank" rel="noreferrer">{shortAddress(asset.address)} ↗</a></dd></div>
      <div><dt>{copy.amount}</dt><dd>{formatAssetAmount(validated.amount, asset)} {asset.symbol}</dd></div>
      <div><dt>{copy.destination}</dt><dd>{matchedContact && <strong className="recipient-contact-name">{matchedContact.name}</strong>}<span className="full-address">{validated.address}</span></dd></div>
      <div><dt>{copy.network}</dt><dd>Arc Testnet · 5042002</dd></div>
      <div><dt>{copy.currentBalance}</dt><dd>{formatAssetAmount(balance, asset)} {asset.symbol}</dd></div>
      <div><dt>{copy.remainingBalance}</dt><dd>{formatAssetAmount(validated.remaining, asset)} {asset.symbol}</dd></div>
      {memoNote.note && <><div><dt>{copy.onchainNote}</dt><dd>{memoNote.note}</dd></div><div><dt>{copy.memoContract}</dt><dd>Arc Transaction Memo · {shortAddress(ARC_MEMO_ADDRESS)}</dd></div></>}
    </dl>
    <div className="recipient-actions"><button type="button" onClick={() => void navigator.clipboard.writeText(validated.address)}>{copy.copyAddress}</button><a href={arcScanAddressUrl(validated.address)} target="_blank" rel="noreferrer">ArcScan ↗</a></div>
    {recipientKind === "checking" && <p className="wallet-hint">{copy.checkingRecipient}</p>}
    {recipientKind === "contract" && <p className="wallet-warning" role="alert">{copy.contractWarning}</p>}
    {memoNote.note && <p className="memo-public-warning" role="alert">{copy.memoPublic}</p>}
    {memoCompatibility === "checking" && <p className="wallet-hint" role="status">{copy.memoChecking}</p>}
    {memoCompatibility === "contract-wallet" && <p className="field-error" role="alert">{copy.eoaRequired}</p>}
    {memoCompatibility === "unavailable" && <p className="field-error" role="alert">{copy.memoUnavailable}</p>}
    {memoNote.note && memoCompatibility === "compatible" && <p className="wallet-notice">{copy.memoWrap}</p>}
    {large && <label className="large-send-warning"><strong>{copy.largeTitle}</strong><span>{copy.largeCopy}</span><span><input type="checkbox" checked={largeAcknowledged} onChange={(event) => setLargeAcknowledged(event.target.checked)} /> {copy.largeConfirm}</span></label>}
    <p className="wallet-notice">{copy.note}</p>
    {stage === "awaiting" && <p className="transaction-progress" role="status">{copy.awaiting}</p>}
    {stage === "confirming" && <p className="transaction-progress" role="status">{copy.confirming}{hash && <> · <a href={arcScanTransactionUrl(hash)} target="_blank" rel="noreferrer">ArcScan ↗</a></>}</p>}
    {stage === "failed" && error && <p className="field-error" role="alert">{error}</p>}
    {!chain.isArc && <p className="field-error">{copy.arcRequired}</p>}
    <div className="modal-actions"><button type="button" className="secondary-action" onClick={() => { setReviewing(false); setStage("idle"); }} disabled={pending}>{copy.back}</button><button type="button" className="primary-action" onClick={() => void submit()} disabled={pending || !chain.isArc || Boolean(memoNote.note && memoCompatibility !== "compatible") || (large && !largeAcknowledged)}>{stage === "awaiting" ? copy.awaitingShort : stage === "confirming" ? copy.confirmingShort : copy.confirm}</button></div>
  </div> : <form className="create-form wallet-flow" onSubmit={(event) => { event.preventDefault(); void review(); }}>
    <label>{copy.asset}<select className="asset-selector" value={assetId} onChange={(event) => selectAsset(event.target.value as SupportedAssetId)}>{SUPPORTED_ASSETS.map((item) => <option key={item.id} value={item.id}>{item.symbol} · {item.name}</option>)}</select></label>
    <label>{copy.recipient}<div className="wallet-field-with-action"><input value={recipient} onChange={(event) => { setRecipient(event.target.value); setContactFormOpen(false); setContactFeedback(undefined); resetSafety(); }} placeholder="0x…" spellCheck={false} /><button type="button" onClick={() => void pasteRecipient()}>{copy.paste}</button></div></label>
    {(contacts.length > 0 || recents.length > 0 || canSaveContact || matchedContact) && <div className="recipient-helper">
      {contacts.length > 0 && <section aria-labelledby="saved-contacts-title"><div className="recipient-helper-heading"><strong id="saved-contacts-title">{copy.contacts}</strong><small>{copy.localOnly}</small></div><div className="recipient-list">{contacts.map((contact) => <div className="recipient-row" key={contact.address}><button type="button" className="recipient-choice" onClick={() => selectRecipient(contact.address)}><strong>{contact.name}</strong><span>{shortAddress(contact.address)}</span></button><button type="button" className="recipient-remove" aria-label={`${copy.remove} ${contact.name}`} onClick={() => removeSavedContact(contact)}>×</button></div>)}</div></section>}
      {contacts.length === 0 && canSaveContact && <small className="recipient-empty">{copy.noContacts}</small>}
      {recents.length > 0 && <section aria-labelledby="recent-recipients-title"><strong id="recent-recipients-title">{copy.recent}</strong><div className="recipient-chips">{recents.map((item) => <button type="button" key={item.address} onClick={() => selectRecipient(item.address)}>{shortAddress(item.address)}</button>)}</div></section>}
      {matchedContact && <p className="contact-match">{copy.savedAs} <strong>{matchedContact.name}</strong></p>}
      {canSaveContact && !contactFormOpen && <button type="button" className="save-contact-trigger" onClick={() => { setContactFormOpen(true); setContactFeedback(undefined); }}>+ {copy.saveContact}</button>}
      {canSaveContact && contactFormOpen && <div className="contact-inline-form"><label>{copy.contactName}<input value={contactName} maxLength={40} autoFocus onChange={(event) => { setContactName(event.target.value); setContactFeedback(undefined); }} /></label><div><button type="button" onClick={() => { setContactFormOpen(false); setContactName(""); }}>{copy.cancel}</button><button type="button" className="primary-action" onClick={submitContact}>{copy.save}</button></div></div>}
      {contactFeedback && <p className="contact-feedback" role="status">{contactFeedback}</p>}
    </div>}
    <label>{copy.amount}<div className="wallet-field-with-action amount"><input inputMode="decimal" value={amount} onChange={(event) => { setAmount(event.target.value); resetSafety(); }} placeholder="0.00" /><span>{asset.symbol}</span><button type="button" onClick={useMax}>{copy.max}</button></div><small>{copy.available}: {formatAssetAmount(balance, asset)} {asset.symbol}</small></label>
    <label className="send-note-field">{copy.noteOptional}<textarea value={note} onChange={(event) => { setNote(event.target.value); resetSafety(); }} rows={2} aria-invalid={Boolean(memoNote.error)} aria-describedby={memoNote.error ? "send-note-error" : memoNote.note ? "send-note-warning" : undefined} /><small>{Array.from(note).length}/100</small></label>
    {memoNote.error && <p id="send-note-error" className="field-error" role="alert">{copy.memoInvalid}</p>}
    {memoNote.note && <p id="send-note-warning" className="memo-public-warning" role="alert">{copy.memoPublic}</p>}
    {error && <p className="field-error" role="alert">{error}</p>}
    <div className="modal-actions"><button type="button" className="secondary-action" onClick={onClose}>{copy.back}</button><button type="submit" className="primary-action">{copy.next}</button></div>
  </form>}</WalletPanel>;
}

function sendCopy(locale: "en" | "vi") {
  const vi = locale === "vi";
  return {
    title: vi ? "Gửi tài sản" : "Send asset", asset: vi ? "Tài sản" : "Asset", recipient: vi ? "Địa chỉ nhận" : "Recipient address", amount: vi ? "Số tiền" : "Amount", next: vi ? "Kiểm tra" : "Review", back: vi ? "Quay lại" : "Back", confirm: vi ? "Xác nhận trong ví" : "Confirm in wallet", review: vi ? "Kiểm tra giao dịch" : "Review transaction", token: vi ? "Tài sản / hợp đồng token" : "Asset / token contract", network: vi ? "Mạng" : "Network", destination: vi ? "Người nhận" : "Recipient", currentBalance: vi ? "Số dư hiện tại" : "Current balance", remainingBalance: vi ? "Số dư ước tính còn lại" : "Estimated remaining balance", note: vi ? "Ví sẽ yêu cầu xác nhận rõ ràng. Makoto không giữ khóa riêng." : "Your wallet will ask for explicit confirmation. Makoto never holds your private keys.", invalidAddress: vi ? "Nhập địa chỉ ví hợp lệ." : "Enter a valid wallet address.", selfSend: vi ? "Không thể gửi tài sản đến chính ví đang kết nối." : "You cannot send assets to the currently connected wallet.", invalidAmount: vi ? "Nhập số tiền lớn hơn 0, tối đa 6 chữ số thập phân." : "Enter an amount greater than 0 with at most 6 decimals.", insufficient: vi ? "Số dư tài sản đã chọn không đủ." : "Your selected asset balance is too low.", freshInsufficient: vi ? "Số dư vừa thay đổi và không còn đủ. Không có giao dịch nào được gửi." : "Your balance changed and is no longer sufficient. No transaction was submitted.", awaiting: vi ? "Đang chờ bạn xác nhận trong ví." : "Awaiting confirmation in your wallet.", awaitingShort: vi ? "Đang chờ ví…" : "Awaiting wallet…", confirming: vi ? "Đã gửi. Đang chờ Arc xác nhận giao dịch." : "Submitted. Confirming the transaction on Arc.", confirmingShort: vi ? "Đang xác nhận…" : "Confirming…", success: vi ? "Đã gửi tài sản" : "Asset sent", view: vi ? "Xem trên ArcScan" : "View on ArcScan", paste: vi ? "Dán" : "Paste", pasteFailed: vi ? "Không thể đọc bộ nhớ tạm." : "Clipboard access was unavailable.", max: vi ? "TỐI ĐA" : "MAX", available: vi ? "Khả dụng" : "Available", arcRequired: vi ? "Cần kết nối Arc Testnet." : "Arc Testnet is required.", copyAddress: vi ? "Sao chép địa chỉ" : "Copy address", checkingRecipient: vi ? "Đang kiểm tra địa chỉ người nhận…" : "Checking recipient address…", contractWarning: vi ? "Địa chỉ người nhận là hợp đồng. Hãy chắc chắn hợp đồng này có thể nhận tài sản đã chọn." : "The recipient is a contract. Make sure it can receive the selected asset.", largeTitle: vi ? "Giao dịch lớn" : "Large send", largeCopy: vi ? "Bạn đang gửi ít nhất 50% số dư tài sản đã chọn." : "You are sending at least 50% of your selected asset balance.", largeConfirm: vi ? "Tôi đã kiểm tra người nhận và số tiền." : "I checked the recipient and amount.", unknownTitle: vi ? "Đã gửi — trạng thái xác nhận chưa rõ" : "Submitted — confirmation status unknown", checkBeforeRetry: vi ? "Kiểm tra giao dịch trên ArcScan trước khi thử lại để tránh gửi hai lần." : "Check ArcScan before retrying to avoid sending twice.",
    noteOptional: vi ? "Ghi chú (không bắt buộc)" : "Note (optional)", onchainNote: vi ? "Ghi chú on-chain" : "On-chain note", memoContract: vi ? "Hợp đồng Memo" : "Memo contract", memoPublic: vi ? "Ghi chú này sẽ công khai on-chain và không thể xóa. Không nhập thông tin nhạy cảm." : "This note will be public on-chain and cannot be deleted. Do not include sensitive information.", memoInvalid: vi ? "Ghi chú tối đa 100 ký tự và 256 byte UTF-8." : "The note must be at most 100 characters and 256 UTF-8 bytes.", memoChecking: vi ? "Đang kiểm tra khả năng hỗ trợ Arc Memo…" : "Checking Arc Memo compatibility…", eoaRequired: vi ? "Ghi chú on-chain hiện yêu cầu ví EOA trên Arc. Hãy xóa ghi chú để gửi bình thường." : "On-chain notes currently require an EOA wallet on Arc. Remove the note to send normally.", memoUnavailable: vi ? "Không thể xác minh ví hoặc hợp đồng Arc Memo. Hãy thử lại hoặc xóa ghi chú để gửi bình thường." : "The wallet or Arc Memo contract could not be verified. Retry or remove the note to send normally.", memoWrap: vi ? "Makoto sẽ bọc giao dịch bằng Arc Memo để ghi chú được phát on-chain. Ví của bạn có thể hiển thị đây là một tương tác hợp đồng." : "Makoto will wrap this transfer with Arc Memo so the note is emitted on-chain. Your wallet may display this as a contract interaction.", memoVerified: vi ? "Đã xác minh ghi chú on-chain" : "On-chain note verified", memoUnverified: vi ? "Giao dịch đã xác nhận. Không thể hoàn tất xác minh ghi chú." : "Transfer confirmed. Memo verification could not be completed.",
    contacts: vi ? "Danh bạ" : "Contacts", recent: vi ? "Gần đây" : "Recent", saveContact: vi ? "Lưu liên hệ" : "Save contact", contactName: vi ? "Tên liên hệ" : "Contact name", save: vi ? "Lưu" : "Save", cancel: vi ? "Hủy" : "Cancel", remove: vi ? "Xóa" : "Remove", noContacts: vi ? "Chưa có liên hệ đã lưu" : "No saved contacts yet", localOnly: vi ? "Danh bạ chỉ được lưu trên trình duyệt này." : "Contacts are stored only in this browser.", savedAs: vi ? "Đã lưu dưới tên" : "Saved as", contactSaved: vi ? "Đã lưu liên hệ." : "Contact saved.", contactRemoved: vi ? "Đã xóa liên hệ." : "Contact removed.", contactSaveFailed: vi ? "Không thể lưu liên hệ trên trình duyệt này." : "This browser could not save the contact.", removeConfirm: vi ? "Xóa {name} khỏi danh bạ?" : "Remove {name} from contacts?",
    contactErrors: {
      "invalid-address": vi ? "Nhập địa chỉ ví hợp lệ." : "Enter a valid wallet address.", self: vi ? "Không thể lưu chính ví đang kết nối." : "You cannot save the connected wallet as a contact.", "empty-name": vi ? "Tên liên hệ là bắt buộc." : "Contact name is required.", "name-too-long": vi ? "Tên liên hệ không được quá 40 ký tự." : "Contact name must be 40 characters or fewer.", limit: vi ? "Danh bạ đã đạt giới hạn 50 liên hệ." : "Contacts are limited to 50.",
    },
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

function memoNoteResult(value: string): { note?: string; error?: true } {
  try { return { note: normalizeMemoNote(value) }; } catch { return { error: true }; }
}
