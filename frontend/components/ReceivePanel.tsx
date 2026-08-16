"use client";

import type { Address } from "viem";
import { usePreferences } from "@/hooks/usePreferences";
import { shortAddress } from "@/lib/format";
import { CopyButton, WalletPanel } from "./WalletPanel";

export function ReceivePanel({ address, onClose }: { address: Address; onClose(): void }) {
  const { locale } = usePreferences();
  const copy = locale === "vi" ? {
    title: "Nhận trên Arc", network: "Arc Testnet", asset: "Tài sản", address: "Địa chỉ ví đầy đủ", short: "Địa chỉ rút gọn", copy: "Sao chép địa chỉ", copied: "Đã sao chép", warning: "Chỉ gửi tài sản được hỗ trợ trên Arc Testnet đến địa chỉ này.",
  } : {
    title: "Receive on Arc", network: "Arc Testnet", asset: "Asset", address: "Full wallet address", short: "Short address", copy: "Copy address", copied: "Address copied", warning: "Only send supported assets on Arc Testnet to this address.",
  };

  return (
    <WalletPanel title={copy.title} onClose={onClose}>
      <div className="wallet-flow receive-flow">
        <div className="receive-network-badge"><i />{copy.network}</div>
        <div className="receive-asset"><span>{copy.asset}</span><strong>USDC</strong></div>
        <p>{copy.address}</p>
        <code>{address}</code>
        <small>{copy.short}: {shortAddress(address)}</small>
        <CopyButton value={address} idle={copy.copy} copiedLabel={copy.copied} />
        <p className="wallet-notice">{copy.warning}</p>
      </div>
    </WalletPanel>
  );
}
