"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatUnits } from "viem";
import { useConnection } from "wagmi";

import { AppHeader } from "./AppHeader";
import { SendFlow } from "./SendFlow";
import { ReceivePanel } from "./ReceivePanel";
import { SwapPanel } from "./SwapPanel";

import { useHydrated } from "@/hooks/useHydrated";
import { useOwnerJars } from "@/hooks/useOwnerJars";
import { usePreferences } from "@/hooks/usePreferences";
import { useVerifiedWalletChain } from "@/hooks/useVerifiedWalletChain";
import { useWalletBalances } from "@/hooks/useWalletBalances";

import { ARC_EXPLORER_URL } from "@/lib/config";
import { formatUsdc, jarStatus, shortAddress } from "@/lib/format";
import { arcScanTransactionUrl, type WalletActivity } from "@/lib/wallet";
import { addWalletActivity, loadWalletActivity } from "@/lib/walletActivity";
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

export function WalletDashboard() {
  const { locale } = usePreferences();

  const c =
    locale === "vi"
      ? {
          totalBalance: "Tổng số dư",
          native: "Số dư Arc",
          copy: "Sao chép",
          copied: "Đã sao chép",
          refresh: "Làm mới",
          send: "Gửi",
          receive: "Nhận",
          swap: "Hoán đổi",
          save: "Tiết kiệm",
          sendSub: "Gửi USDC tới địa chỉ",
          receiveSub: "Nhận USDC vào ví",
          swapSub: "Sắp ra mắt",
          saveSub: "Tiết kiệm với PenguJar",
          companionTitle: "Người bạn đồng hành ví Arc của bạn",
          companionCopy: "Đơn giản. Non-custodial. Dành cho Arc.",
          activity: "Hoạt động Makoto",
          activityEyebrow: "GIAO DỊCH ĐƯỢC TẠO BẰNG MAKOTO",
          sessionOnly: "Chỉ phiên này",
          noActivity: "Chưa có giao dịch nào trong phiên này.",
          noActivitySub: "Giao dịch bạn tạo tại đây sẽ xuất hiện sau khi Arc xác nhận.",
          viewAll: "Xem tất cả",
          savings: "Savings Jars",
          penguJar: "PENGUJAR",
          createJar: "Tạo hũ",
          noJars: "Chưa có hũ tiết kiệm.",
          viewSavings: "Xem tiết kiệm",
          saved: "đã tiết kiệm",
          target: "mục tiêu",
          confirmed: "Đã xác nhận",
          connectTitle: "Kết nối ví để bắt đầu",
          connectCopy: "Makoto Wallet hiển thị số dư thật trên Arc Testnet và không giữ private key của bạn.",
          switchNetwork: "Chuyển sang Arc Testnet",
        }
      : {
          totalBalance: "Total Balance",
          native: "Native balance",
          copy: "Copy",
          copied: "Copied",
          refresh: "Refresh",
          send: "Send",
          receive: "Receive",
          swap: "Swap",
          save: "Save",
          sendSub: "Send USDC to any address",
          receiveSub: "Receive USDC to your wallet",
          swapSub: "Coming next",
          saveSub: "Save with PenguJar",
          companionTitle: "Your friendly Arc wallet companion",
          companionCopy: "Simple. Non-custodial. Made for Arc.",
          activity: "Makoto Activity",
          activityEyebrow: "TRANSACTIONS CREATED WITH MAKOTO",
          sessionOnly: "Session only",
          noActivity: "No transactions in this session yet.",
          noActivitySub: "Activity you create here appears after Arc confirms it.",
          viewAll: "View All",
          savings: "Savings Jars",
          penguJar: "PENGUJAR",
          createJar: "Create a Jar",
          noJars: "No savings jars yet.",
          viewSavings: "View Savings",
          saved: "saved",
          target: "target",
          confirmed: "Completed",
          connectTitle: "Connect your wallet to begin",
          connectCopy: "Makoto Wallet shows real Arc Testnet balances and never stores your private key.",
          switchNetwork: "Switch to Arc Testnet",
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
  const [activities, setActivities] = useState<WalletActivity[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const address = connection.address;
    const frame = window.requestAnimationFrame(() => {
      setActivities(hydrated && onArc && address ? loadWalletActivity(address, 5042002) : []);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [connection.address, hydrated, onArc]);

  const totals = useMemo(
    () => ({
      locked: jars.reduce((sum, jar) => sum + jar.balance, 0n),
      active: jars.filter(
        (jar) => jarStatus(jar.unlockTime, jar.closed) === "Locked",
      ).length,
    }),
    [jars],
  );

  const visibleJars = jars.slice(0, 3);

  async function copyAddress() {
    if (!connection.address) return;
    await navigator.clipboard.writeText(connection.address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  async function refresh() {
    await Promise.all([
      balances.native.refetch(),
      balances.usdc.refetch(),
      refetchJars(),
    ]);
  }

  const usdcBalance =
    balances.usdc.data === undefined ? "…" : formatUsdc(balances.usdc.data);

  const nativeBalance = balances.native.data
    ? `${Number(
        formatUnits(
          balances.native.data.value,
          balances.native.data.decimals,
        ),
      ).toFixed(4)} ${balances.native.data.symbol}`
    : "…";

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <AppHeader />

        {!connected ? (
          <section className={styles.disconnected}>
            <div className={styles.disconnectedCopy}>
              <span className={styles.kicker}>MAKOTO WALLET · ARC TESTNET</span>
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
                    src="/makoto/hero-art.jpg"
                    alt=""
                    fill
                    priority
                    className={styles.coverImage}
                  />
                </div>
                <div className={styles.heroShade} aria-hidden="true" />

                <div className={styles.heroContent}>
                  <span className={styles.balanceLabel}>
                    {c.totalBalance} <span aria-hidden="true">◉</span>
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
                      {c.native}: {nativeBalance}
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
                      disabled={
                        balances.usdc.isFetching || balances.native.isFetching
                      }
                    >
                      {c.refresh}
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
                  <h2>
                    {c.companionTitle} <span aria-hidden="true">💜</span>
                  </h2>
                  <p>{c.companionCopy}</p>
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
                    src="/makoto/icon-send.png"
                    alt=""
                    width={92}
                    height={92}
                    className={styles.actionIcon}
                  />
                  <span className={styles.actionText}>
                    <strong>{c.send}</strong>
                    <small>{c.sendSub}</small>
                  </span>
                  <span className={styles.chevron}>›</span>
                </button>

                <button
                  type="button"
                  className={`${styles.actionCard} ${styles.actionReceive}`}
                  onClick={() => setAction("receive")}
                  disabled={!onArc}
                >
                  <Image
                    src="/makoto/icon-receive.png"
                    alt=""
                    width={92}
                    height={92}
                    className={styles.actionIcon}
                  />
                  <span className={styles.actionText}>
                    <strong>{c.receive}</strong>
                    <small>{c.receiveSub}</small>
                  </span>
                  <span className={styles.chevron}>›</span>
                </button>

                <button
                  type="button"
                  className={`${styles.actionCard} ${styles.actionSwap}`}
                  onClick={() => setAction("swap")}
                  disabled={!onArc}
                >
                  <Image
                    src="/makoto/icon-swap.png"
                    alt=""
                    width={92}
                    height={92}
                    className={styles.actionIcon}
                  />
                  <span className={styles.actionText}>
                    <strong>{c.swap}</strong>
                    <small>{c.swapSub}</small>
                  </span>
                  <span className={styles.chevron}>›</span>
                </button>

                <Link
                  className={`${styles.actionCard} ${styles.actionSave}`}
                  href="/savings"
                >
                  <Image
                    src="/makoto/icon-save.png"
                    alt=""
                    width={92}
                    height={92}
                    className={styles.actionIcon}
                  />
                  <span className={styles.actionText}>
                    <strong>{c.save}</strong>
                    <small>{c.saveSub}</small>
                  </span>
                  <span className={styles.chevron}>›</span>
                </Link>
              </div>
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

                {activities.length === 0 ? (
                  <div className={styles.emptyActivity}>
                    <Image
                      src="/makoto/logo.png"
                      alt=""
                      width={62}
                      height={62}
                    />
                    <strong>{c.noActivity}</strong>
                    <span>{c.noActivitySub}</span>
                  </div>
                ) : (
                  <ul className={styles.activityList}>
                    {activities.map((item) => (
                      <li key={item.hash}>
                        <Image
                          src="/makoto/icon-send.png"
                          alt=""
                          width={54}
                          height={54}
                          className={styles.activityIcon}
                        />
                        <div className={styles.activityMain}>
                          <strong>
                            {c.send} {formatUsdc(item.amount)} USDC
                          </strong>
                          <small>{shortAddress(item.counterparty)} · {formatActivityTime(item.confirmedAt, locale)}</small>
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
                          ArcScan ↗
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
                  <div className={styles.savingsLoading}>…</div>
                ) : visibleJars.length === 0 ? (
                  <div className={styles.emptyJars}>
                    <p>{c.noJars}</p>
                    <Link href="/savings">{c.createJar}</Link>
                  </div>
                ) : (
                  <div className={styles.jarList}>
                    {visibleJars.map((jar, index) => {
                      const progress = progressPercent(
                        jar.balance,
                        jar.targetAmount,
                      );
                      return (
                        <Link
                          href={`/jars/${jar.id.toString()}`}
                          className={styles.jarRow}
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
                              <span>{Math.round(progress)}%</span>
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
                          <span className={styles.jarArrow}>›</span>
                        </Link>
                      );
                    })}
                  </div>
                )}

                <footer className={styles.savingsFooter}>
                  <span>
                    {formatUsdc(totals.locked)} USDC {c.saved}
                  </span>
                  <Link href="/savings">{c.createJar}</Link>
                </footer>
              </article>
            </section>
          </>
        )}

        <footer className={styles.footer}>
          <span>Makoto Wallet · Arc Testnet</span>
          <span>PenguJar Savings</span>
        </footer>
      </div>

      {action === "send" && (
        <SendFlow
          balance={balances.usdc.data ?? 0n}
          onClose={() => setAction(undefined)}
          onConfirmed={(item) => {
            if (connection.address) setActivities(addWalletActivity(connection.address, 5042002, item));
            void balances.usdc.refetch();
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
        <SwapPanel onClose={() => setAction(undefined)} />
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
