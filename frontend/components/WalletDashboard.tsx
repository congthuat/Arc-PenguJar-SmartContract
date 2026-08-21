"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useConnection } from "wagmi";

import { AppHeader } from "./AppHeader";
import { SendFlow } from "./SendFlow";
import { ReceivePanel } from "./ReceivePanel";
import { SwapPanel } from "./SwapPanel";
import { TransactionReceiptPanel } from "./TransactionReceiptPanel";

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
import {
  appKitViewForPath,
  ONBOARDING_INTENT_KEY,
  parseOnboardingIntent,
  shouldShowWalletReady,
  type OnboardingPath,
} from "@/lib/onboarding";
import { getAppKit, isReownConfigured } from "@/lib/wagmi";
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
  const { locale, t } = usePreferences();

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
  const [receiptActivity, setReceiptActivity] = useState<WalletActivity>();
  const [onboardingIntent, setOnboardingIntent] = useState<OnboardingPath | undefined>(() =>
    typeof window === "undefined" ? undefined : parseOnboardingIntent(window.sessionStorage.getItem(ONBOARDING_INTENT_KEY)),
  );

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

  async function beginOnboarding(path: OnboardingPath) {
    const appKit = getAppKit();
    if (!appKit) return;
    window.sessionStorage.setItem(ONBOARDING_INTENT_KEY, path);
    setOnboardingIntent(path);
    await appKit.open({ view: appKitViewForPath(path) });
  }

  function continueToWallet() {
    window.sessionStorage.removeItem(ONBOARDING_INTENT_KEY);
    setOnboardingIntent(undefined);
  }

  const usdcBalance =
    balances.usdc.data === undefined ? "—" : formatUsdc(balances.usdc.data);
  const showWalletReady = shouldShowWalletReady(onboardingIntent, onArc, connection.connector?.id);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <AppHeader />

        {!connected ? (
          <section className={styles.disconnected}>
            <div className={styles.disconnectedCopy}>
              <span className={styles.kicker}>MAKOTO WALLET{" · "}ARC TESTNET</span>
              <h1>{t("walletHome.connectTitle")}</h1>
              <p>{t("walletHome.connectCopy")}</p>
              <div className={styles.onboardingPanel} aria-labelledby="onboarding-title">
                <h2 id="onboarding-title">{t("onboarding.title")}</h2>
                <button
                  type="button"
                  className={styles.createWalletButton}
                  onClick={() => void beginOnboarding("create")}
                  disabled={!isReownConfigured}
                >
                  <strong>{t("onboarding.createWallet")}</strong>
                  <span>{t("onboarding.createHelp")}</span>
                </button>
                <button
                  type="button"
                  className={styles.connectExistingButton}
                  onClick={() => void beginOnboarding("existing")}
                  disabled={!isReownConfigured}
                >
                  <strong>{t("onboarding.connectExisting")}</strong>
                  <span>{t("onboarding.connectHelp")}</span>
                </button>
                <p className={styles.onboardingSafety}>{t("onboarding.methods")}<br />{t("onboarding.noPrivateKeyStorage")}</p>
                {!isReownConfigured && <p className={styles.onboardingUnavailable} role="status">{t("onboarding.unavailable")}</p>}
              </div>
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
        ) : showWalletReady && connection.address ? (
          <section className={styles.walletReady} aria-labelledby="wallet-ready-title">
            <span className={styles.kicker}>MAKOTO WALLET{" · "}ARC TESTNET</span>
            <div className={styles.walletReadyBadge}>Arc Testnet</div>
            <h1 id="wallet-ready-title">{t("onboarding.walletReady")}</h1>
            <p>{t("onboarding.walletReadyCopy")}</p>
            <dl>
              <div><dt>{t("onboarding.walletAddress")}</dt><dd>{shortAddress(connection.address)}</dd></div>
              <div><dt>{t("wallet.network")}</dt><dd>Arc Testnet · 5042002</dd></div>
              <div><dt>{t("wallet.usdcBalance")}</dt><dd>{usdcBalance} USDC</dd></div>
            </dl>
            <p className={styles.walletReadySafety}>{t("onboarding.noPrivateKeyStorage")}</p>
            <button type="button" onClick={continueToWallet}>{t("onboarding.continue")}</button>
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
                    {t("walletHome.totalBalance")} <span className={styles.balanceDot} aria-hidden="true" />
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
                      {t("walletHome.native")}: USDC
                    </span>
                  </div>

                  <div className={styles.heroButtons}>
                    <button
                      type="button"
                      onClick={() => void copyAddress()}
                    >
                      {copied ? t("walletHome.copied") : t("walletHome.copy")}
                    </button>
                    <button
                      type="button"
                      onClick={() => void refresh()}
                      className={refreshing ? styles.refreshingButton : undefined}
                      disabled={refreshing}
                      aria-busy={refreshing}
                    >
                      <span className={styles.refreshIcon} aria-hidden="true">↻</span>
                      {refreshing ? t("common.refreshing") : t("common.refresh")}
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
                      {t("wallet.switch")}
                    </button>
                  )}
                  {onArc && (balances.usdc.isError || balances.eurc.isError) && <p className={styles.balanceError} role="alert">{t("walletHome.balanceError")}</p>}
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
                  <h2>{t("walletHome.companionTitle")}</h2>
                  <p>{t("walletHome.companionCopy")}<br />{t("walletHome.companionSupport")}</p>
                </div>
              </article>

              <section className={styles.actionsArea} aria-labelledby="quick-actions-title">
                <header className={styles.actionsHeader}>
                  <h2 id="quick-actions-title">{t("walletHome.quickActions")}</h2>
                  <p>{t("walletHome.quickActionsCopy")}</p>
                </header>
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
                    <strong>{t("walletHome.send")}</strong>
                    <small>{t("walletHome.sendSub")}</small>
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
                    <strong>{t("walletHome.receive")}</strong>
                    <small>{t("walletHome.receiveSub")}</small>
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
                    <strong>{t("walletHome.swap")}</strong>
                    <small>{t("walletHome.swapSub")}</small>
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
                    <strong>{t("walletHome.save")}</strong>
                    <small>{t("walletHome.saveSub")}</small>
                  </span>
                  <span className={styles.chevron}><ChevronRightIcon /></span>
                </Link>
                </div>
              </section>
            </section>

            <section className={styles.assetsSection} aria-labelledby="assets-title">
              <header className={styles.assetsHeader}><p>{t("walletHome.assetsEyebrow")}</p><h2 id="assets-title">{t("walletHome.assets")}</h2></header>
              <div className={styles.assetRows}>{SUPPORTED_ASSETS.map((asset) => {
                const query = balances.assets[asset.id];
                return <article className={`${styles.assetRow} ${asset.id === "usdc" ? styles.assetUsdc : styles.assetEurc}`} key={asset.id}>
                  <Image
                    src={asset.id === "usdc" ? "/makoto/token-usdc-3d.png" : "/makoto/token-eurc-3d.png"}
                    alt={t("walletHome.assetLogo", { symbol: asset.symbol })}
                    width={64}
                    height={64}
                    className={styles.assetLogo3d}
                  />
                  <div><strong>{asset.symbol}</strong><small>{asset.name}</small></div>
                  <div className={styles.assetContract}><span>{shortAddress(asset.address)}</span><a href={`${ARC_EXPLORER_URL}/address/${asset.address}`} target="_blank" rel="noreferrer">ArcScan <ExternalLinkIcon /></a></div>
                  <strong className={`${styles.assetBalance} ${query.data === undefined ? styles.loadingValue : ""}`}>{query.data === undefined ? <span aria-label={t("walletHome.loadingBalance")} /> : <>{formatAssetAmount(query.data, asset)} {asset.symbol}</>}</strong>
                </article>;
              })}</div>
            </section>

            <section className={styles.lowerGrid}>
              <article className={styles.activityCard} id="activity">
                <header className={styles.sectionHeader}>
                  <div>
                    <p>{t("walletHome.activityEyebrow")}</p>
                    <h2>{t("walletHome.activity")}</h2>
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
                    {t("walletHome.viewAll")}
                  </a>
                </header>

                {!onArc ? (
                  <div className={styles.emptyActivity}><strong>{t("walletHome.activityWrongNetwork")}</strong></div>
                ) : activity.isLoading ? (
                  <div className={styles.activitySkeleton} aria-label={t("walletHome.activityLoading")}>{Array.from({ length: 3 }, (_, index) => <span key={index} />)}</div>
                ) : activity.isError && activities.length === 0 ? (
                  <div className={styles.emptyActivity}><strong>{t("walletHome.activityError")}</strong><button type="button" className={styles.viewButton} onClick={() => void activity.refetch()}>{t("common.tryAgain")}</button></div>
                ) : activities.length === 0 ? (
                  <div className={styles.emptyActivity}>
                    <Image
                      src="/makoto/logo-pro-v2.png"
                      alt=""
                      width={62}
                      height={62}
                    />
                    <strong>{t("walletHome.noActivity")}</strong>
                    <span>{t("walletHome.noActivitySub")}</span>
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
                            {item.kind === "swap" && item.swapReceive ? <>{t("walletHome.swap")} -{formatAssetAmount(item.amount, getAssetById(item.assetId)!)} {item.assetSymbol} → +{formatAssetAmount(item.swapReceive.amount, getAssetById(item.swapReceive.assetId)!)} {item.swapReceive.assetSymbol}</> : <>{item.kind === "bridge" ? t("walletHome.bridge") : item.direction === "receive" ? t("walletHome.receive") : t("walletHome.send")}{" "}{item.direction === "receive" ? "+" : "-"}{formatAssetAmount(item.amount, getAssetById(item.assetId)!)} {item.assetSymbol}</>}
                          </strong>
                          <small>{item.kind === "swap" ? "XyloNet StableSwap" : item.kind === "bridge" ? t("walletHome.bridgeRoute") : <>{item.direction === "receive" ? t("walletHome.from") : t("walletHome.to")}{" "}{shortAddress(item.counterparty)}</>}{" · "}{formatActivityTime(item.confirmedAt, locale)}</small>
                        </div>
                        <span className={styles.activityStatus}>
                          {t("walletHome.confirmed")}
                        </span>
                        <div className={styles.activityActions}><button type="button" onClick={() => setReceiptActivity(item)}>{locale === "vi" ? "Biên nhận" : "Receipt"}</button><a
                            href={arcScanTransactionUrl(item.hash)}
                            target="_blank"
                            rel="noreferrer"
                            className={styles.activityLink}
                          >
                            ArcScan <ExternalLinkIcon />
                          </a></div>
                      </li>
                    ))}
                  </ul>
                )}
              </article>

              <article className={styles.savingsCard}>
                <header className={styles.sectionHeader}>
                  <div>
                    <p>{t("walletHome.penguJar")}</p>
                    <h2>{t("walletHome.savings")}</h2>
                  </div>
                  <Link className={styles.viewButton} href="/savings">
                    {t("walletHome.viewSavings")}
                  </Link>
                </header>

                {jarsLoading ? (
                  <div className={styles.jarSkeleton} aria-label={t("walletHome.loadingSavings")}>{Array.from({ length: 3 }, (_, index) => <span key={index} />)}</div>
                ) : visibleJars.length === 0 ? (
                  <div className={styles.emptyJars}>
                    <p>{t("walletHome.noJars")}</p>
                    <Link href="/savings">{t("walletHome.createJar")}</Link>
                  </div>
                ) : (
                  <><dl className={styles.savingsSummary}>
                    <div><dt>{t("walletHome.totalSaved")}</dt><dd>{formatUsdc(totals.totalSaved)} USDC</dd></div>
                    <div><dt>{t("walletHome.activeJars")}</dt><dd>{totals.active}</dd></div>
                    <div><dt>{t("walletHome.completedJars")}</dt><dd>{totals.completed}</dd></div>
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
                              <strong>{jar.name || t("jar.unnamed", { id: jar.id.toString() })}</strong>
                              <span>{jar.closed ? t("walletHome.confirmed") : `${Math.round(progress)}%`}</span>
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
                    {formatUsdc(totals.totalSaved)} USDC {t("walletHome.saved")}
                  </span>
                  <Link href="/savings">{t("walletHome.createJar")}</Link>
                </footer>
              </article>
            </section>
          </>
        )}

        <footer className={styles.footer} title={t("walletHome.betaInfo")}>
          <span>Makoto Wallet{" · "}{t("walletHome.publicBeta")}{" · "}Arc Testnet</span>
          <span>{t("savings.footerName")}</span>
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
          onViewReceipt={(item) => { setAction(undefined); setReceiptActivity(item); }}
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

      {receiptActivity && connection.address && <TransactionReceiptPanel activity={receiptActivity} walletAddress={connection.address} onClose={() => setReceiptActivity(undefined)} />}
    </main>
  );
}

function formatActivityTime(timestamp: number, locale: "en" | "vi") {
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}
