"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useConnection, useDisconnect } from "wagmi";
import { useWalletBalances } from "@/hooks/useWalletBalances";
import { useHydrated } from "@/hooks/useHydrated";
import { useVerifiedWalletChain } from "@/hooks/useVerifiedWalletChain";
import { formatUsdc, shortAddress } from "@/lib/format";
import { ARC_EXPLORER_URL } from "@/lib/config";
import { usePreferences } from "@/hooks/usePreferences";
import { getAppKit, isReownConfigured } from "@/lib/wagmi";

export function WalletControl() {
  const hydrated = useHydrated();
  const connection = useConnection();
  const disconnect = useDisconnect();
  const verifiedChain = useVerifiedWalletChain();
  const { t } = usePreferences();
  const [accountOpen, setAccountOpen] = useState(false);
  const [message, setMessage] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [isMobileAccountSheet, setIsMobileAccountSheet] = useState(false);
  const onArc = verifiedChain.isArc;
  const balances = useWalletBalances(connection.address, connection.isConnected && onArc);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 620px)");
    const sync = () => setIsMobileAccountSheet(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!accountOpen || !isMobileAccountSheet) return;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousBodyOverflow; };
  }, [accountOpen, isMobileAccountSheet]);

  async function openWalletModal() {
    const appKit = getAppKit();
    if (!appKit) return;
    setMessage(undefined);
    await appKit.open({ view: "Connect" });
  }

  async function switchToArc() {
    setMessage(undefined);
    await verifiedChain.switchToArc();
  }

  async function copyAddress() {
    if (!connection.address) return;
    await navigator.clipboard.writeText(connection.address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  if (!hydrated || connection.status !== "connected") {
    return <div className="wallet-control">
      <button
        className="connect-button"
        onClick={() => void openWalletModal()}
        disabled={!isReownConfigured}
        title={!isReownConfigured ? "Set NEXT_PUBLIC_REOWN_PROJECT_ID to enable wallet connections." : undefined}
      >
        {hydrated && connection.isConnecting ? t("wallet.connecting") : t("wallet.connect")}
      </button>
    </div>;
  }

  const accountPanel = <div className="wallet-popover connected-popover account-menu" role="dialog" aria-modal={isMobileAccountSheet ? "true" : undefined} aria-label={t("wallet.connected")}>
    <div className="wallet-popover-heading"><strong>{t("wallet.account")}</strong><button onClick={() => setAccountOpen(false)} aria-label={t("common.close")}>×</button></div>
    <p className="account-address">{shortAddress(connection.address)}</p>
    <div className="account-links"><button onClick={() => void copyAddress()}>{copied ? t("wallet.copied") : t("wallet.copy")}</button><a href={`${ARC_EXPLORER_URL}/address/${connection.address}`} target="_blank" rel="noreferrer">{t("wallet.arcscan")} ↗</a></div>
    <div className="wallet-network-row"><span>{t("wallet.network")}</span><strong><i className={onArc ? "healthy-dot" : "warning-dot"} />{onArc ? t("network.arc") : t("wallet.wrongNetwork")}</strong></div>
    {onArc ? <div className="wallet-balances"><div><span>{t("wallet.usdcBalance")}</span><strong>{balances.usdc.data === undefined ? "…" : formatUsdc(balances.usdc.data)} USDC</strong></div></div> : <button className="switch-button" onClick={() => void switchToArc()} disabled={isSwitchPending(verifiedChain.switchStatus)}>{switchButtonLabel(verifiedChain.switchStatus, t)}</button>}
    {verifiedChain.switchMessage && <p className={verifiedChain.switchStatus === "connected" ? "wallet-success" : "wallet-error"} role="status">{verifiedChain.switchMessage}</p>}
    {message && <p className="wallet-error" role="alert">{message}</p>}
    <button className="disconnect-button" onClick={() => { disconnect.mutate(); setAccountOpen(false); setMessage(undefined); }}>{t("wallet.disconnect")}</button>
  </div>;

  const mobileAccountOverlay = accountOpen && isMobileAccountSheet && typeof document !== "undefined"
    ? createPortal(<>
        <button className="account-sheet-backdrop" type="button" onClick={() => setAccountOpen(false)} aria-label={t("common.close")} />
        {accountPanel}
      </>, document.body)
    : null;

  return <div className="wallet-control connected">
    <button className={`wallet-summary ${onArc ? "on-arc" : "wrong-chain"}`} onClick={() => setAccountOpen((open) => !open)} aria-expanded={accountOpen}>
      <span className="wallet-status-dot" />
      <span><strong>{shortAddress(connection.address)}</strong><small>{onArc ? t("network.arc") : t("wallet.wrongNetwork")}</small></span>
    </button>
    {accountOpen && !isMobileAccountSheet && accountPanel}
    {mobileAccountOverlay}
  </div>;
}

function isSwitchPending(status: string) { return status === "waiting" || status === "switching" || status === "missing"; }

function switchButtonLabel(status: string, t: ReturnType<typeof usePreferences>["t"]) {
  if (status === "waiting" || status === "missing") return t("wallet.waiting");
  if (status === "switching") return t("wallet.switching");
  if (status === "connected") return t("wallet.arcConnected");
  return t("wallet.switch");
}
