"use client";

import { useState } from "react";
import type { Address } from "viem";
import { usePreferences } from "@/hooks/usePreferences";
import { shortAddress } from "@/lib/format";
import { getAssetById, SUPPORTED_ASSETS, type SupportedAssetId } from "@/lib/assets";
import { arcScanAddressUrl } from "@/lib/wallet";
import { CopyButton, WalletPanel } from "./WalletPanel";

export function ReceivePanel({ address, onClose }: { address: Address; onClose(): void }) {
  const { locale } = usePreferences();
  const [assetId, setAssetId] = useState<SupportedAssetId>("usdc");
  const selected = getAssetById(assetId)!;
  const copy = locale === "vi" ? {
    title: "Nhận trên Arc", network: "Arc Testnet · 5042002", asset: "Tài sản", contract: "Hợp đồng token", address: "Địa chỉ ví đầy đủ", short: "Địa chỉ rút gọn", copy: "Sao chép địa chỉ", copied: "Đã sao chép", same: "Địa chỉ ví này giống nhau cho USDC và EURC.", warning: "Chỉ gửi tài sản được hỗ trợ trên Arc Testnet đến địa chỉ này. Tài sản gửi từ mạng khác có thể không hiển thị trong Makoto Wallet.",
  } : {
    title: "Receive on Arc", network: "Arc Testnet · 5042002", asset: "Asset", contract: "Token contract", address: "Full wallet address", short: "Short address", copy: "Copy address", copied: "Address copied", same: "This wallet address is the same for USDC and EURC.", warning: "Only send supported assets on Arc Testnet to this address. Assets sent on another network may not appear in Makoto Wallet.",
  };

  return (
    <WalletPanel title={copy.title} onClose={onClose}>
      <div className="wallet-flow receive-flow">
        <div className="receive-network-badge"><i />{copy.network}</div>
        <label>{copy.asset}<select className="asset-selector" value={assetId} onChange={(event) => setAssetId(event.target.value as SupportedAssetId)}>{SUPPORTED_ASSETS.map((asset) => <option key={asset.id} value={asset.id}>{asset.symbol} · {asset.name}</option>)}</select></label>
        <div className="receive-asset"><span>{copy.contract}</span><strong>{selected.symbol} · <a href={arcScanAddressUrl(selected.address)} target="_blank" rel="noreferrer">{shortAddress(selected.address)} ↗</a></strong></div>
        <p>{copy.address}</p>
        <code>{address}</code>
        <small>{copy.short}: {shortAddress(address)}</small>
        <small>{copy.same}</small>
        <CopyButton value={address} idle={copy.copy} copiedLabel={copy.copied} />
        <p className="wallet-notice">{copy.warning}</p>
      </div>
    </WalletPanel>
  );
}
