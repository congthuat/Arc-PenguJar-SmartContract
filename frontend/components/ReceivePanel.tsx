"use client";

import { useState } from "react";
import type { Address } from "viem";
import { arcTestnet } from "viem/chains";
import { QRCodeSVG } from "qrcode.react";
import { usePreferences } from "@/hooks/usePreferences";
import { shortAddress } from "@/lib/format";
import { formatAssetAmount, getAssetById, parseAssetAmount, SUPPORTED_ASSETS, type SupportedAssetId } from "@/lib/assets";
import { buildAddressQrPayload, buildErc20PaymentRequest } from "@/lib/paymentRequest";
import { arcScanAddressUrl } from "@/lib/wallet";
import { CopyButton, WalletPanel } from "./WalletPanel";

export function ReceivePanel({ address, onClose }: { address: Address; onClose(): void }) {
  const { locale } = usePreferences();
  const [assetId, setAssetId] = useState<SupportedAssetId>("usdc");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const selected = getAssetById(assetId)!;
  const atomicAmount = amount.trim() ? parseAssetAmount(amount, selected) : undefined;
  const amountInvalid = Boolean(amount.trim() && atomicAmount === undefined);
  const paymentUri = atomicAmount ? buildErc20PaymentRequest({ token: selected.address, recipient: address, chainId: arcTestnet.id, amount: atomicAmount }) : undefined;
  const qrPayload = paymentUri ?? buildAddressQrPayload(address);
  const displayAmount = atomicAmount ? formatAssetAmount(atomicAmount, selected) : undefined;
  const copy = locale === "vi" ? {
    title: "Nhận trên Arc", network: "Arc Testnet · 5042002", networkLabel: "Mạng", asset: "Tài sản", contract: "Hợp đồng token", address: "Địa chỉ ví đầy đủ", short: "Địa chỉ rút gọn", copy: "Sao chép địa chỉ", copied: "Đã sao chép", same: "Địa chỉ ví này giống nhau cho USDC và EURC.", warning: "Chỉ gửi tài sản được hỗ trợ trên Arc Testnet đến địa chỉ này. Tài sản gửi từ mạng khác có thể không hiển thị trong Makoto Wallet.", amount: "Số tiền (không bắt buộc)", note: "Ghi chú (không bắt buộc)", invalidAmount: "Số tiền không hợp lệ. Hãy nhập số lớn hơn 0 với tối đa 6 chữ số thập phân.", paymentRequest: "Yêu cầu thanh toán", requesting: "Yêu cầu nhận", to: "Đến", noteExplanation: "Ghi chú được hiển thị cùng yêu cầu này nhưng không được mã hóa trong QR thanh toán tiêu chuẩn.", copyUri: "Sao chép URI thanh toán", copyDetails: "Sao chép chi tiết yêu cầu", copiedUri: "Đã sao chép URI", copiedDetails: "Đã sao chép chi tiết", verify: "Hãy kiểm tra mạng, tài sản, số tiền và địa chỉ trước khi thanh toán.", addressQr: `QR địa chỉ ${selected.symbol} trên Arc Testnet`, paymentQr: `QR yêu cầu thanh toán ${displayAmount ?? ""} ${selected.symbol} trên Arc Testnet`, requestHeading: "Yêu cầu thanh toán Makoto", noteLabel: "Ghi chú",
  } : {
    title: "Receive on Arc", network: "Arc Testnet · 5042002", networkLabel: "Network", asset: "Asset", contract: "Token contract", address: "Full wallet address", short: "Short address", copy: "Copy address", copied: "Address copied", same: "This wallet address is the same for USDC and EURC.", warning: "Only send supported assets on Arc Testnet to this address. Assets sent on another network may not appear in Makoto Wallet.", amount: "Amount (optional)", note: "Note (optional)", invalidAmount: "Invalid amount. Enter more than 0 with at most 6 decimal places.", paymentRequest: "Payment request", requesting: "Requesting", to: "To", noteExplanation: "Your note is shown with this request but is not encoded in the standard payment QR.", copyUri: "Copy payment URI", copyDetails: "Copy request details", copiedUri: "Payment URI copied", copiedDetails: "Request details copied", verify: "Verify the network, token, amount and address before payment.", addressQr: `${selected.symbol} address QR on Arc Testnet`, paymentQr: `QR payment request for ${displayAmount ?? ""} ${selected.symbol} on Arc Testnet`, requestHeading: "Makoto payment request", noteLabel: "Note",
  };
  const requestDetails = paymentUri && displayAmount ? [copy.requestHeading, `${displayAmount} ${selected.symbol}`, "Arc Testnet", address, ...(note.trim() ? [`${copy.noteLabel}: ${note.trim()}`] : [])].join("\n") : "";

  return (
    <WalletPanel title={copy.title} onClose={onClose}>
      <div className="wallet-flow receive-flow">
        <div className="receive-network-badge"><i />{copy.network}</div>
        <label>{copy.asset}<select className="asset-selector" value={assetId} onChange={(event) => setAssetId(event.target.value as SupportedAssetId)}>{SUPPORTED_ASSETS.map((asset) => <option key={asset.id} value={asset.id}>{asset.symbol} · {asset.name}</option>)}</select></label>
        <label>{copy.amount}<div className="wallet-field-with-action amount receive-amount"><input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" aria-invalid={amountInvalid} /><span>{selected.symbol}</span></div></label>
        {amountInvalid && <p className="field-error" role="alert">{copy.invalidAmount}</p>}
        <label>{copy.note}<textarea value={note} maxLength={100} onChange={(event) => setNote(event.target.value)} rows={2} /><small>{note.length}/100</small></label>
        <div className="receive-asset"><span>{copy.contract}</span><strong>{selected.symbol} · <a href={arcScanAddressUrl(selected.address)} target="_blank" rel="noreferrer">{shortAddress(selected.address)} ↗</a></strong></div>
        <div className="receive-qr-card" role="img" aria-label={paymentUri ? copy.paymentQr : copy.addressQr}><QRCodeSVG value={qrPayload} size={204} marginSize={2} title={paymentUri ? copy.paymentQr : copy.addressQr} /><strong>{displayAmount ? `${displayAmount} ${selected.symbol}` : selected.symbol} · Arc Testnet</strong></div>
        {paymentUri && displayAmount && <div className="payment-request-summary"><span>{copy.paymentRequest}</span><strong>{copy.requesting}<b>{displayAmount} {selected.symbol}</b></strong><dl><div><dt>{copy.to}:</dt><dd>{shortAddress(address)}</dd></div><div><dt>{copy.networkLabel}:</dt><dd>Arc Testnet</dd></div>{note.trim() && <div><dt>{copy.noteLabel}:</dt><dd>{note.trim()}</dd></div>}</dl></div>}
        <p>{copy.address}</p>
        <code>{address}</code>
        <small>{copy.short}: {shortAddress(address)}</small>
        <small>{copy.same}</small>
        <div className="receive-actions"><CopyButton value={address} idle={copy.copy} copiedLabel={copy.copied} />{paymentUri && <><CopyButton value={paymentUri} idle={copy.copyUri} copiedLabel={copy.copiedUri} /><CopyButton value={requestDetails} idle={copy.copyDetails} copiedLabel={copy.copiedDetails} /></>}</div>
        {note.trim() && <p className="receive-note-explanation">{copy.noteExplanation}</p>}
        <p className="wallet-notice">{copy.verify}</p>
        <p className="wallet-notice">{copy.warning}</p>
      </div>
    </WalletPanel>
  );
}
