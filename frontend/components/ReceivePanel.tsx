"use client";

import type { Address } from "viem";
import { usePreferences } from "@/hooks/usePreferences";
import { shortAddress } from "@/lib/format";
import { EXPECTED_USDC_ADDRESS } from "@/lib/config";
import { arcScanAddressUrl } from "@/lib/wallet";
import { CopyButton, WalletPanel } from "./WalletPanel";

export function ReceivePanel({ address, onClose }: { address: Address; onClose(): void }) {
  const { locale } = usePreferences();
  const copy = locale === "vi" ? {
    title: "Nhận trên Arc", network: "Arc Testnet · 5042002", asset: "Tài sản / hợp đồng token", address: "Địa chỉ ví đầy đủ", short: "Địa chỉ rút gọn", copy: "Sao chép địa chỉ", copied: "Đã sao chép", warning: "Chỉ gửi USDC trên Arc Testnet đến địa chỉ này. Luôn kiểm tra mạng và hợp đồng token.",
  } : {
    title: "Receive on Arc", network: "Arc Testnet · 5042002", asset: "Asset / token contract", address: "Full wallet address", short: "Short address", copy: "Copy address", copied: "Address copied", warning: "Only send USDC on Arc Testnet to this address. Always verify the network and token contract.",
  };

  return (
    <WalletPanel title={copy.title} onClose={onClose}>
      <div className="wallet-flow receive-flow">
        <div className="receive-network-badge"><i />{copy.network}</div>
        <div className="receive-asset"><span>{copy.asset}</span><strong>USDC · <a href={arcScanAddressUrl(EXPECTED_USDC_ADDRESS)} target="_blank" rel="noreferrer">{shortAddress(EXPECTED_USDC_ADDRESS)} ↗</a></strong></div>
        <p>{copy.address}</p>
        <code>{address}</code>
        <small>{copy.short}: {shortAddress(address)}</small>
        <CopyButton value={address} idle={copy.copy} copiedLabel={copy.copied} />
        <p className="wallet-notice">{copy.warning}</p>
      </div>
    </WalletPanel>
  );
}
