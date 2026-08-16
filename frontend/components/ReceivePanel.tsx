"use client";
import type { Address } from "viem";
import { usePreferences } from "@/hooks/usePreferences";
import { shortAddress } from "@/lib/format";
import { CopyButton, WalletPanel } from "./WalletPanel";
export function ReceivePanel({ address, onClose }: { address: Address; onClose(): void }) { const { locale } = usePreferences(); const c = locale === "vi" ? { title:"Nhận trên Arc", address:"Địa chỉ ví", copy:"Sao chép địa chỉ", copied:"Đã sao chép", warning:"Chỉ gửi tài sản được hỗ trợ trên Arc đến địa chỉ này." } : { title:"Receive on Arc", address:"Wallet address", copy:"Copy address", copied:"Copied", warning:"Only send assets supported on Arc to this address." }; return <WalletPanel title={c.title} onClose={onClose}><div className="wallet-flow receive-flow"><div className="receive-mark" aria-hidden="true">↓</div><p>{c.address}</p><strong>{shortAddress(address)}</strong><code>{address}</code><CopyButton value={address} idle={c.copy} copiedLabel={c.copied} /><p className="wallet-notice">{c.warning}</p></div></WalletPanel>; }
