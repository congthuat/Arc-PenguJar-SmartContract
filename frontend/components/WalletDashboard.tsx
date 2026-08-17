"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useConnection } from "wagmi";

import { AppHeader } from "./AppHeader";
import { SendFlow } from "./SendFlow";
import { ReceivePanel } from "./ReceivePanel";
import { SwapPanel } from "./SwapPanel";

import { useHydrated } from "@/hooks/useHydrated";
import { useOwnerJars } from "@/hooks/useOwnerJars";
import { usePreferences } from "@/hooks/usePreferences";
import { useVerifiedWalletChain } from "@/hooks/useVerifiedWalletChain";
import { useWalletActivity } from "@/hooks/useWalletActivity";
import { useWalletBalances } from "@/hooks/useWalletBalances";

import { ARC_EXPLORER_URL } from "@/lib/config";
import { formatAssetAmount, getAssetById, SUPPORTED_ASSETS } from "@/lib/assets";
import { formatUsdc, shortAddress } from "@/lib/format";
import { summarizeSavingsJars } from "@/lib/savingsSummary";
import { arcScanTransactionUrl, type WalletActivity } from "@/lib/wallet";
import { activityIdentity } from "@/lib/onchainActivity";
import { addWalletActivity, mergeWalletActivity } from "@/lib/walletActivity";
import styles from "./MakotoWallet.module.css";

type Action = "send" | "receive" | "swap";

const jarImages = [
  "/makoto/jar-rainy.png",
  "/makoto/jar-trip.png",
  "/makoto/jar-game.png",
];

function progressPercent(balance: bigint, target: bigint) {
  if (target <= 0n) return 0;
  const basisPoints = (balance * 10000n) / target;
  return Math.min(100, Number(basisPoints) / 100);
}

function ChevronRightIcon() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m7 4 6 6-6 6" /></svg>;
}

function ExternalLinkIcon() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 10 12 4M7 4h5v5" /><path d="M12 10v2H4V4h2" /></svg>;
}

export function WalletDashboard() {
  const { locale } = usePreferences();

  const c =
    locale === "vi"
      ? {
          totalBalance: "Số dư USDC",
          assets: "Tài sản",
          assetsEyebrow: "TÀI SẢN ĐƯỢC HỖ TRỢ",
          native: "Phí gas",
          copy: "Sao chép",
          copied: "Đã sao chép",
          refresh: "Làm mới",
          refreshing: "Đang làm mới",
          send: "Gửi",
          receive: "Nhận",
          swap: "Hoán đổi",
          save: "Tiết kiệm",
          sendSub: "Gửi USDC tới địa chỉ",
          receiveSub: "Nhận USDC vào ví",
          swapSub: "USDC ↔ EURC · báo giá trực tiếp",
          saveSub: "PenguJar · Tiết kiệm USDC",
          companionTitle: "Gặp Makoto 💜",
          companionCopy: "Người bạn đồng hành cùng ví của bạn trên Arc.",
          companionSupport: "Đơn giản. Non-custodial. Dành cho Arc.",
          activity: "Hoạt động",
          activityEyebrow: "HOẠT ĐỘNG TRÊN ARC",
          activityLoading: "Đang tải hoạt động on-chain…",
          activityWrongNetwork: "Chuyển sang Arc Testnet để xem hoạt động ví.",
          noActivity: "Chưa tìm thấy hoạt động USDC hoặc EURC.",
          noActivitySub: "Các giao dịch đã xác nhận trên Arc sẽ xuất hiện tại đây.",
          activityError: "Không thể tải hoạt động.",
          retry: "Thử lại",
          loadMore: "Tải thêm",
          bridge: "Bridge",
          bridgeRoute: "Arc Testnet → Base Sepolia",
          from: "Từ",
          to: "Đến",
          viewAll: "Xem tất cả",
          savings: "Savings Jars",
          penguJar: "PENGUJAR",
          createJar: "Tạo hũ",
          noJars: "Chưa có hũ tiết kiệm.",
          viewSavings: "Xem tiết kiệm",
          totalSaved: "Tổng đã tiết kiệm",
          activeJars: "Hũ đang hoạt động",
          completedJars: "Hũ hoàn thành",
          saved: "đã tiết kiệm",
          target: "mục tiêu",
          confirmed: "Đã xác nhận",
          connectTitle: "Kết nối ví để bắt đầu",
          connectCopy: "Makoto Wallet hiển thị số dư thật trên Arc Testnet và không giữ private key của bạn.",
          switchNetwork: "Chuyển sang Arc Testnet",
          balanceError: "Không thể tải số dư lúc này. Hãy thử làm mới.",
          betaInfo: "Makoto Wallet hiện đang chạy trên Arc Testnet. Tài sản testnet chỉ dùng để thử nghiệm và không có giá trị thực dự kiến.",
        }
      : {
          totalBalance: "USDC Balance",
          assets: "Assets",
          assetsEyebrow: "SUPPORTED ASSETS",
          native: "Gas token",
          copy: "Copy",
          copied: "Copied",
          refresh: "Refresh",
          refreshing: "Refreshing",
          send: "Send",
          receive: "Receive",
          swap: "Swap",
          save: "Save",
          sendSub: "Send USDC to any address",
          receiveSub: "Receive USDC to your wallet",
          swapSub: "USDC ↔ EURC · live quotes",
          saveSub: "PenguJar · USDC Savings",
          companionTitle: "Meet Makoto 💜",
          companionCopy: "Your friendly wallet companion on Arc.",
          companionSupport: "Simple. Non-custodial. Made for Arc.",
          activity: "Activity",
          activityEyebrow: "ON-CHAIN ARC ACTIVITY",
          activityLoading: "Loading on-chain activity…",
          activityWrongNetwork: "Switch to Arc Testnet to view wallet activity.",
          noActivity: "No USDC or EURC activity found yet.",
          noActivitySub: "Confirmed Arc transactions will appear here.",
          activityError: "Activity could not be loaded.",
          retry: "Retry",
          loadMore: "Load More",
          bridge: "Bridge",
          bridgeRoute: "Arc Testnet → Base Sepolia",
          from: "From",
          to: "To",
          viewAll: "View All",
          savings: "Savings Jars",
          penguJar: "PENGUJAR",
          createJar: "Create a Jar",
          noJars: "No savings jars yet.",
          viewSavings: "View Savings",
          totalSaved: "Total saved",
          activeJars: "Active jars",
          completedJars: "Completed jars",
          saved: "saved",
          target: "target",
          confirmed: "Completed",
          connectTitle: "Connect your wallet to begin",
          connectCopy: "Makoto Wallet shows real Arc Testnet balances and never stores your private key.",
          switchNetwork: "Switch to Arc Testnet",
          balanceError: "Balances could not be loaded. Try refreshing.",
          betaInfo: "Makoto Wallet is currently running on Arc Testnet. Testnet assets are for testing and have no intended real-world value.",
        };

  const hydrated = useHydrated();
  const connection = useConnection();
  const chain = useVerifiedWalletChain();
  const connected = hydrated && connection.isConnected;
  const onArc = connected && chain.isArc;

  const balances = useWalletBalances(connection.address, onArc);
  const {
    jars,
    isLoading: jarsLoading,
    refetch: refetchJars,
  } = useOwnerJars(onArc ? connection.address : undefined);

  const [action, setAction] = useState<Action>();
  const activity = useWalletActivity(connection.address, onArc);
  const [optimisticActivity, setOptimisticActivity] = useState<{ address: string; records: WalletActivity[] }>();
  const [copied, setCopied] = useState(false);

  const activities = useMemo(() => {
    const optimistic = optimisticActivity && connection.address && optimisticActivity.address.toLowerCase() === connection.address.toLowerCase()
      ? optimisticActivity.records
      : [];
    return mergeWalletActivity(activity.data, optimistic);
  }, [activity.data, connection.address, optimisticActivity]);

  const totals = useMemo(() => summarizeSavingsJars(jars), [jars]);

  const visibleJars = jars.slice(0, 3);
  const visibleActivities = activities.slice(0, 5);
  const refreshing = balances.usdc.isFetching || balances.eurc.isFetching;

  async function copyAddress() {
    if (!connection.address) return;
    await navigator.clipboard.writeText(connection.address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  async function refresh() {
    await Promise.all([
      balances.usdc.refetch(),
      balances.eurc.refetch(),
      refetchJars(),
      activity.refetch(),
    ]);
  }

  const usdcBalance =
    balances.usdc.data === undefined ? "..." : formatUsdc(balances.usdc.data);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <AppHeader />

        {!connected ? (
          <section className={styles.disconnected}>
            <div className={styles.disconnectedCopy}>
              <span className={styles.kicker}>MAKOTO WALLET{" · "}ARC TESTNET</span>
              <h1>{c.connectTitle}</h1>
              <p>{c.connectCopy}</p>
            </div>
            <div className={styles.disconnectedArt}>
              <Image
                src="/makoto/companion-art.jpg"
                alt=""
                fill
                priority
                className={styles.coverImage}
              />
            </div>
          </section>
        ) : (
          <>
            <section className={styles.topGrid}>
              <article
                className={`${styles.balanceHero} ${
                  onArc ? "" : styles.wrongNetwork
                }`}
              >
                <div className={styles.heroArt} aria-hidden="true">
                  <Image
                    src="/makoto/hero-wallet-pro-v2.png"
                    alt=""
                    fill
                    priority
                    className={styles.heroWallet}
                  />
                </div>
                <div className={styles.heroShade} aria-hidden="true" />

                <div className={styles.heroContent}>
                  <span className={styles.balanceLabel}>
                    {c.totalBalance} <span className={styles.balanceDot} aria-hidden="true" />
                  </span>
                  <div className={styles.balanceValue}>
                    {usdcBalance}
                    <small>USDC</small>
                  </div>

                  <div className={styles.heroPills}>
                    <span className={styles.heroPill}>
                      <i />
                      Arc Testnet
                    </span>
                    <span className={styles.heroPill}>
                      {c.native}: USDC
                    </span>
                  </div>

                  <div className={styles.heroButtons}>
                    <button
                      type="button"
                      onClick={() => void copyAddress()}
                    >
                      {copied ? c.copied : c.copy}
                    </button>
                    <button
                      type="button"
                      onClick={() => void refresh()}
                      className={refreshing ? styles.refreshingButton : undefined}
                      disabled={refreshing}
                      aria-busy={refreshing}
                    >
                      <span className={styles.refreshIcon} aria-hidden="true">↻</span>
                      {refreshing ? c.refreshing : c.refresh}
                    </button>
                  </div>

                  {connection.address && (
                    <span className={styles.heroAddress}>
                      {shortAddress(connection.address)}
                    </span>
                  )}

                  {!onArc && (
                    <button
                      type="button"
                      className={styles.switchNetwork}
                      onClick={() => void chain.switchToArc()}
                    >
                      {c.switchNetwork}
                    </button>
                  )}
                  {onArc && (balances.usdc.isError || balances.eurc.isError) && <p className={styles.balanceError} role="alert">{c.balanceError}</p>}
                </div>
              </article>

              <article className={styles.companionCard}>
                <div className={styles.companionImage}>
                  <Image
                    src="/makoto/companion-art.jpg"
                    alt=""
                    fill
                    priority
                    className={styles.coverImage}
                  />
                </div>
                <div className={styles.companionText}>
                  <h2>{c.companionTitle}</h2>
                  <p>{c.companionCopy}<br />{c.companionSupport}</p>
                </div>
              </article>

              <div className={styles.actionsGrid}>
                <button
                  type="button"
                  className={`${styles.actionCard} ${styles.actionSend}`}
                  onClick={() => setAction("send")}
                  disabled={!onArc}
                >
                  <Image
                    src="/makoto/icon-send-pro-v2.png"
                    alt=""
                    width={92}
                    height={92}
                    className={styles.actionIcon}
                  />
                  <span className={styles.actionText}>
                    <strong>{c.send}</strong>
                    <small>{c.sendSub}</small>
                  </span>
                  <span className={styles.chevron}><ChevronRightIcon /></span>
                </button>

                <button
                  type="button"
                  className={`${styles.actionCard} ${styles.actionReceive}`}
                  onClick={() => setAction("receive")}
                  disabled={!onArc}
                >
                  <Image
                    src="/makoto/icon-receive-pro-v2.png"
                    alt=""
                    width={92}
                    height={92}
                    className={styles.actionIcon}
                  />
                  <span className={styles.actionText}>
                    <strong>{c.receive}</strong>
                    <small>{c.receiveSub}</small>
                  </span>
                  <span className={styles.chevron}><ChevronRightIcon /></span>
                </button>

                <button
                  type="button"
                  className={`${styles.actionCard} ${styles.actionSwap}`}
                  onClick={() => setAction("swap")}
                  disabled={!onArc}
                >
                  <Image
                    src="/makoto/icon-swap-pro-v2.png"
                    alt=""
                    width={92}
                    height={92}
                    className={styles.actionIcon}
                  />
                  <span className={styles.actionText}>
                    <strong>{c.swap}</strong>
                    <small>{c.swapSub}</small>
                  </span>
                  <span className={styles.chevron}><ChevronRightIcon /></span>
                </button>

                <Link
                  className={`${styles.actionCard} ${styles.actionSave}`}
                  href="/savings"
                >
                  <Image
                    src="/makoto/icon-save-pro-v2.png"
                    alt=""
                    width={92}
                    height={92}
                    className={styles.actionIcon}
                  />
                  <span className={styles.actionText}>
                    <strong>{c.save}</strong>
                    <small>{c.saveSub}</small>
                  </span>
                  <span className={styles.chevron}><ChevronRightIcon /></span>
                </Link>
              </div>
            </section>

            <section className={styles.assetsSection} aria-labelledby="assets-title">
              <header className={styles.assetsHeader}><p>{c.assetsEyebrow}</p><h2 id="assets-title">{c.assets}</h2></header>
              <div className={styles.assetRows}>{SUPPORTED_ASSETS.map((asset) => {
                const query = balances.assets[asset.id];
                return <article className={`${styles.assetRow} ${asset.id === "usdc" ? styles.assetUsdc : styles.assetEurc}`} key={asset.id}>
                  <Image
                    src={asset.id === "usdc" ? "/makoto/token-usdc-3d.png" : "/makoto/token-eurc-3d.png"}
                    alt={`${asset.symbol} 3D logo`}
                    width={64}
                    height={64}
                    className={styles.assetLogo3d}
                  />
                  <div><strong>{asset.symbol}</strong><small>{asset.name}</small></div>
                  <div className={styles.assetContract}><span>{shortAddress(asset.address)}</span><a href={`${ARC_EXPLORER_URL}/address/${asset.address}`} target="_blank" rel="noreferrer">ArcScan <ExternalLinkIcon /></a></div>
                  <strong className={`${styles.assetBalance} ${query.data === undefined ? styles.loadingValue : ""}`}>{query.data === undefined ? <span aria-label="Loading balance" /> : <>{formatAssetAmount(query.data, asset)} {asset.symbol}</>}</strong>
                </article>;
              })}</div>
            </section>

            <section className={styles.lowerGrid}>
              <article className={styles.activityCard} id="activity">
                <header className={styles.sectionHeader}>
                  <div>
                    <p>{c.activityEyebrow}</p>
                    <h2>{c.activity}</h2>
                  </div>
                  <a
                    className={styles.viewButton}
                    href={
                      connection.address
                        ? `${ARC_EXPLORER_URL}/address/${connection.address}`
                        : ARC_EXPLORER_URL
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    {c.viewAll}
                  </a>
                </header>

                {!onArc ? (
                  <div className={styles.emptyActivity}><strong>{c.activityWrongNetwork}</strong></div>
                ) : activity.isLoading ? (
                  <div className={styles.activitySkeleton} aria-label={c.activityLoading}>{Array.from({ length: 3 }, (_, index) => <span key={index} />)}</div>
                ) : activity.isError && activities.length === 0 ? (
                  <div className={styles.emptyActivity}><strong>{c.activityError}</strong><button type="button" className={styles.viewButton} onClick={() => void activity.refetch()}>{c.retry}</button></div>
                ) : activities.length === 0 ? (
                  <div className={styles.emptyActivity}>
                    <Image
                      src="/makoto/logo-pro-v2.png"
                      alt=""
                      width={62}
                      height={62}
                    />
                    <strong>{c.noActivity}</strong>
                    <span>{c.noActivitySub}</span>
                  </div>
                ) : (
                  <ul className={styles.activityList}>
                    {visibleActivities.map((item) => (
                      <li key={activityIdentity(item)}>
                        <Image
                          src={item.kind === "swap" ? "/makoto/icon-swap-pro-v2.png" : item.direction === "receive" ? "/makoto/icon-receive-pro-v2.png" : "/makoto/icon-send-pro-v2.png"}
                          alt=""
                          width={54}
                          height={54}
                          className={styles.activityIcon}
                        />
                        <div className={styles.activityMain}>
                          <strong>
                            {item.kind === "swap" && item.swapReceive ? <>Swap -{formatAssetAmount(item.amount, getAssetById(item.assetId)!)} {item.assetSymbol} → +{formatAssetAmount(item.swapReceive.amount, getAssetById(item.swapReceive.assetId)!)} {item.swapReceive.assetSymbol}</> : <>{item.kind === "bridge" ? c.bridge : item.direction === "receive" ? c.receive : c.send}{" "}{item.direction === "receive" ? "+" : "-"}{formatAssetAmount(item.amount, getAssetById(item.assetId)!)} {item.assetSymbol}</>}
                          </strong>
                          <small>{item.kind === "swap" ? "XyloNet StableSwap" : item.kind === "bridge" ? c.bridgeRoute : <>{item.direction === "receive" ? c.from : c.to}{" "}{shortAddress(item.counterparty)}</>}{" · "}{formatActivityTime(item.confirmedAt, locale)}</small>
                        </div>
                        <span className={styles.activityStatus}>
                          {c.confirmed}
                        </span>
                        <a
                          href={arcScanTransactionUrl(item.hash)}
                          target="_blank"
                          rel="noreferrer"
                          className={styles.activityLink}
                        >
                          ArcScan <ExternalLinkIcon />
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </article>

              <article className={styles.savingsCard}>
                <header className={styles.sectionHeader}>
                  <div>
                    <p>{c.penguJar}</p>
                    <h2>{c.savings}</h2>
                  </div>
                  <Link className={styles.viewButton} href="/savings">
                    {c.viewSavings}
                  </Link>
                </header>

                {jarsLoading ? (
                  <div className={styles.jarSkeleton} aria-label="Loading savings jars">{Array.from({ length: 3 }, (_, index) => <span key={index} />)}</div>
                ) : visibleJars.length === 0 ? (
                  <div className={styles.emptyJars}>
                    <p>{c.noJars}</p>
                    <Link href="/savings">{c.createJar}</Link>
                  </div>
                ) : (
                  <><dl className={styles.savingsSummary}>
                    <div><dt>{c.totalSaved}</dt><dd>{formatUsdc(totals.totalSaved)} USDC</dd></div>
                    <div><dt>{c.activeJars}</dt><dd>{totals.active}</dd></div>
                    <div><dt>{c.completedJars}</dt><dd>{totals.completed}</dd></div>
                  </dl><div className={styles.jarList}>
                    {visibleJars.map((jar, index) => {
                      const progress = progressPercent(
                        jar.balance,
                        jar.targetAmount,
                      );
                      return (
                        <Link
                          href={`/jars/${jar.id.toString()}`}
                          className={`${styles.jarRow} ${jar.closed ? styles.jarCompleted : ""}`}
                          key={jar.id.toString()}
                        >
                          <Image
                            src={jarImages[index % jarImages.length]}
                            alt=""
                            width={70}
                            height={70}
                            className={styles.jarImage}
                          />
                          <div className={styles.jarBody}>
                            <div className={styles.jarTitleRow}>
                              <strong>{jar.name || `Jar #${jar.id}`}</strong>
                              <span>{jar.closed ? c.confirmed : `${Math.round(progress)}%`}</span>
                            </div>
                            <div className={styles.progressTrack}>
                              <span
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <small>
                              {formatUsdc(jar.balance)} USDC /{" "}
                              {formatUsdc(jar.targetAmount)} USDC
                            </small>
                          </div>
                          <span className={styles.jarArrow}><ChevronRightIcon /></span>
                        </Link>
                      );
                    })}
                  </div></>
                )}

                <footer className={styles.savingsFooter}>
                  <span>
                    {formatUsdc(totals.totalSaved)} USDC {c.saved}
                  </span>
                  <Link href="/savings">{c.createJar}</Link>
                </footer>
              </article>
            </section>
          </>
        )}

        <footer className={styles.footer} title={c.betaInfo}>
          <span>Makoto Wallet{" · "}Public Beta{" · "}Arc Testnet</span>
          <span>PenguJar Savings</span>
        </footer>
      </div>

      {action === "send" && (
        <SendFlow
          balances={{ usdc: balances.usdc.data ?? 0n, eurc: balances.eurc.data ?? 0n }}
          onClose={() => setAction(undefined)}
          onConfirmed={(item) => {
            if (connection.address) setOptimisticActivity({ address: connection.address, records: addWalletActivity(connection.address, 5042002, item) });
            void balances.usdc.refetch();
            void balances.eurc.refetch();
            void activity.refetch();
          }}
        />
      )}

      {action === "receive" && connection.address && (
        <ReceivePanel
          address={connection.address}
          onClose={() => setAction(undefined)}
        />
      )}

      {action === "swap" && (
        <SwapPanel onClose={() => setAction(undefined)} onConfirmed={() => void activity.refetch()} />
      )}
    </main>
  );
}

function formatActivityTime(timestamp: number, locale: "en" | "vi") {
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}
