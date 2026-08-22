"use client";

import Image from "next/image";

import { formatAssetAmount, getAssetById } from "@/lib/assets";
import { shortAddress } from "@/lib/format";
import { activityIdentity } from "@/lib/onchainActivity";
import { arcScanTransactionUrl, type WalletActivity } from "@/lib/wallet";
import styles from "./MakotoWallet.module.css";

type Props = {
  activities: WalletActivity[];
  locale: "en" | "vi";
  limit: number;
  loading: boolean;
  loadingMore: boolean;
  partial: boolean;
  canLoadMore: boolean;
  onClose(): void;
  onLoadMore(): void;
  onReceipt(activity: WalletActivity): void;
};

export function ActivityHistoryPanel({ activities, locale, limit, loading, loadingMore, partial, canLoadMore, onClose, onLoadMore, onReceipt }: Props) {
  const vi = locale === "vi";
  return <div className={styles.activityHistoryLayer} role="dialog" aria-modal="true" aria-labelledby="activity-history-title">
    <button type="button" className={styles.activityHistoryBackdrop} onClick={onClose} aria-label={vi ? "Đóng" : "Close"} />
    <section className={styles.activityHistoryPanel}>
      <header><div><small>{vi ? "Hoạt động Arc on-chain" : "On-chain Arc activity"}</small><h2 id="activity-history-title">{vi ? "Toàn bộ hoạt động" : "All Activity"}</h2></div><button type="button" onClick={onClose} aria-label={vi ? "Đóng" : "Close"}>×</button></header>
      {loading && activities.length === 0 ? <div className={styles.activitySkeleton} aria-label={vi ? "Đang tải hoạt động" : "Loading activity"}>{Array.from({ length: 5 }, (_, index) => <span key={index} />)}</div> : activities.length === 0 ? <div className={styles.emptyActivity}><strong>{vi ? "Chưa có hoạt động" : "No activity yet"}</strong><span>{vi ? "Giao dịch Arc được hỗ trợ sẽ xuất hiện tại đây sau khi xác nhận." : "Supported Arc transactions will appear here after confirmation."}</span></div> : <>
        {partial && <p className={styles.activityPartialWarning}>{vi ? "Không thể tải một phần lịch sử on-chain. Hoạt động hợp lệ đã lưu vẫn được hiển thị." : "Some on-chain history could not be loaded. Valid saved activity is still shown."}</p>}
        <ul className={styles.activityList}>{activities.slice(0, limit).map((item) => <ActivityRow key={activityIdentity(item)} item={item} locale={locale} onReceipt={onReceipt} />)}</ul>
        {canLoadMore && <button type="button" className={styles.activityLoadMore} onClick={onLoadMore} disabled={loadingMore}>{loadingMore ? (vi ? "Đang tải…" : "Loading…") : (vi ? "Tải thêm" : "Load more")}</button>}
      </>}
    </section>
  </div>;
}

function ActivityRow({ item, locale, onReceipt }: { item: WalletActivity; locale: "en" | "vi"; onReceipt(activity: WalletActivity): void }) {
  const vi = locale === "vi";
  const asset = getAssetById(item.assetId)!;
  const amount = formatAssetAmount(item.amount, asset);
  const title = item.kind === "swap" && item.swapReceive
    ? `${vi ? "Hoán đổi" : "Swap"} -${amount} ${item.assetSymbol} → +${formatAssetAmount(item.swapReceive.amount, getAssetById(item.swapReceive.assetId)!)} ${item.swapReceive.assetSymbol}`
    : `${kindLabel(item, vi)} ${item.direction === "receive" ? "+" : "-"}${amount} ${item.assetSymbol}`;
  const detail = item.kind === "swap" ? "XyloNet StableSwap" : item.kind === "bridge" ? "Arc → Base · CCTP V2" : item.kind === "vault-deposit" || item.kind === "vault-withdraw" ? "Makoto Vault" : `${item.direction === "receive" ? (vi ? "Từ" : "From") : (vi ? "Đến" : "To")} ${shortAddress(item.counterparty)}`;
  return <li>
    <Image src={item.kind === "swap" ? "/makoto/icon-swap-pro-v2.png" : item.direction === "receive" ? "/makoto/icon-receive-pro-v2.png" : "/makoto/icon-send-pro-v2.png"} alt="" width={54} height={54} className={styles.activityIcon} />
    <div className={styles.activityMain}><strong>{title}</strong><small>{detail} · {formatTime(item.confirmedAt, locale)}</small></div>
    <span className={styles.activityStatus}>{vi ? "Đã xác nhận" : "Confirmed"}</span>
    <div className={styles.activityActions}>{item.source !== "onchain" && <button type="button" onClick={() => onReceipt(item)}>{vi ? "Biên nhận" : "Receipt"}</button>}<a href={arcScanTransactionUrl(item.hash)} target="_blank" rel="noreferrer" className={styles.activityLink}>ArcScan ↗</a></div>
  </li>;
}

function kindLabel(item: WalletActivity, vi: boolean) {
  if (item.kind === "bridge") return vi ? "Chuyển chuỗi" : "Bridge";
  if (item.kind === "vault-deposit") return vi ? "Nạp Makoto Vault" : "Makoto Vault Deposit";
  if (item.kind === "vault-withdraw") return vi ? "Rút Makoto Vault" : "Makoto Vault Withdraw";
  return item.direction === "receive" ? (vi ? "Nhận" : "Receive") : (vi ? "Gửi" : "Send");
}

function formatTime(timestamp: number, locale: "en" | "vi") {
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(timestamp));
}
