"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useConnect,
  useConnection,
  useConnectors,
  useDisconnect,
  type Connector,
} from "wagmi";
import { useWalletBalances } from "@/hooks/useWalletBalances";
import { useHydrated } from "@/hooks/useHydrated";
import { useVerifiedWalletChain } from "@/hooks/useVerifiedWalletChain";
import { formatUsdc, shortAddress } from "@/lib/format";
import { ARC_EXPLORER_URL } from "@/lib/config";
import { usePreferences } from "@/hooks/usePreferences";

export function WalletControl() {
  const hydrated = useHydrated();
  const connection = useConnection();
  const connectors = useConnectors();
  const connect = useConnect();
  const disconnect = useDisconnect();
  const verifiedChain = useVerifiedWalletChain();
  const { locale, setLocale, theme, setTheme, t } = usePreferences();
  const [chooserOpen, setChooserOpen] = useState(false);
  const [message, setMessage] = useState<string>();
  const [availableConnectorUids, setAvailableConnectorUids] = useState<ReadonlySet<string>>(new Set());
  const [discoveryComplete, setDiscoveryComplete] = useState(false);
  const [copied, setCopied] = useState(false);
  const onArc = verifiedChain.isArc;
  const balances = useWalletBalances(connection.address, connection.isConnected && onArc);

  const walletChoices = useMemo(() => {
    const sorted = [...connectors].sort((a, b) => {
      return connectorRank(a) - connectorRank(b);
    });
    const seen = new Set<string>();
    return sorted.filter((connector) => {
      if (!availableConnectorUids.has(connector.uid)) return false;
      const key = connector.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [availableConnectorUids, connectors]);

  const okxAvailable = walletChoices.some(isOkxConnector);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    async function probeConnectors() {
      const checks = await Promise.all(connectors.map(async (connector) => {
        try {
          return (await connector.getProvider()) ? connector.uid : undefined;
        } catch {
          return undefined;
        }
      }));
      if (!cancelled) setAvailableConnectorUids(new Set(checks.filter((uid): uid is string => Boolean(uid))));
    }
    void probeConnectors();
    const retry = window.setTimeout(() => void probeConnectors(), 500);
    const finish = window.setTimeout(() => {
      void probeConnectors().finally(() => { if (!cancelled) setDiscoveryComplete(true); });
    }, 1500);
    return () => {
      cancelled = true;
      window.clearTimeout(retry);
      window.clearTimeout(finish);
    };
  }, [connectors, hydrated]);

  async function connectWallet(connector: Connector) {
    setMessage(undefined);
    try {
      await connect.mutateAsync({ connector });
      setChooserOpen(false);
    } catch (error) {
      setMessage(walletErrorMessage(error, connector.name, t));
    }
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
    return (
      <div className="wallet-control">
        <button className="connect-button" onClick={() => { setChooserOpen((open) => !open); setMessage(undefined); }}>
          {hydrated && connection.isConnecting ? t("wallet.connecting") : t("wallet.connect")}
        </button>
        {hydrated && chooserOpen && (
          <div className="wallet-popover" role="dialog" aria-label={t("wallet.choose")}>
            <div className="wallet-popover-heading"><strong>{t("wallet.choose")}</strong><button onClick={() => setChooserOpen(false)} aria-label={t("common.close")}>×</button></div>
            <p>{t("wallet.recommended")}</p>
            <div className={`wallet-discovery-status ${okxAvailable ? "available" : discoveryComplete ? "unavailable" : "detecting"}`}>
              <span />
              {okxAvailable ? t("wallet.okxAvailable") : discoveryComplete ? t("wallet.okxUnavailable") : t("wallet.detecting")}
            </div>
            <div className="wallet-list">
              {walletChoices.map((connector) => (
                <button key={connector.uid} onClick={() => void connectWallet(connector)} disabled={connect.isPending}>
                  <span className="wallet-dot">{connector.name.slice(0, 1)}</span>
                  <span><strong>{connector.name}</strong><small>{/okx/i.test(`${connector.name} ${connector.id}`) ? "OKX Wallet" : t("wallet.injected")}</small></span>
                </button>
              ))}
            </div>
            {discoveryComplete && walletChoices.length === 0 && <p className="wallet-empty">{t("wallet.noWallet")}</p>}
            <PreferenceFields locale={locale} theme={theme} setLocale={setLocale} setTheme={setTheme} t={t} compact />
            {message && <p className="wallet-error" role="alert">{message}</p>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="wallet-control connected">
      <button className={`wallet-summary ${onArc ? "on-arc" : "wrong-chain"}`} onClick={() => setChooserOpen((open) => !open)} aria-expanded={chooserOpen}>
        <span className="wallet-status-dot" />
        <span><strong>{shortAddress(connection.address)}</strong><small>{onArc ? t("network.arc") : t("wallet.wrongNetwork")}</small></span>
      </button>
      {chooserOpen && (
        <div className="wallet-popover connected-popover account-menu" role="dialog" aria-label={t("wallet.connected")}>
          <div className="wallet-popover-heading"><strong>{t("wallet.account")}</strong><button onClick={() => setChooserOpen(false)} aria-label={t("common.close")}>×</button></div>
          <p className="account-address">{shortAddress(connection.address)}</p>
          <div className="account-links"><button onClick={() => void copyAddress()}>{copied ? t("wallet.copied") : t("wallet.copy")}</button><a href={`${ARC_EXPLORER_URL}/address/${connection.address}`} target="_blank" rel="noreferrer">{t("wallet.arcscan")} ↗</a></div>
          <div className="wallet-network-row"><span>{t("wallet.network")}</span><strong><i className={onArc ? "healthy-dot" : "warning-dot"} />{onArc ? t("network.arc") : t("wallet.wrongNetwork")}</strong></div>
          {onArc ? (
            <div className="wallet-balances">
              <div><span>{t("wallet.usdcBalance")}</span><strong>{balances.usdc.data === undefined ? "…" : formatUsdc(balances.usdc.data)} USDC</strong></div>
            </div>
          ) : (
            <button className="switch-button" onClick={() => void switchToArc()} disabled={isSwitchPending(verifiedChain.switchStatus)}>{switchButtonLabel(verifiedChain.switchStatus, t)}</button>
          )}
          {verifiedChain.switchMessage && <p className={verifiedChain.switchStatus === "connected" ? "wallet-success" : "wallet-error"} role="status">{verifiedChain.switchMessage}</p>}
          {message && <p className="wallet-error" role="alert">{message}</p>}
          <PreferenceFields locale={locale} theme={theme} setLocale={setLocale} setTheme={setTheme} t={t} />
          <details className="about-menu"><summary>{t("about.title")}</summary><p>{t("about.copy")}</p></details>
          <button className="disconnect-button" onClick={() => { disconnect.mutate(); setChooserOpen(false); setMessage(undefined); }}>{t("wallet.disconnect")}</button>
        </div>
      )}
    </div>
  );
}

function isSwitchPending(status: string) {
  return status === "waiting" || status === "switching" || status === "missing";
}

function switchButtonLabel(status: string, t: ReturnType<typeof usePreferences>["t"]) {
  if (status === "waiting" || status === "missing") return t("wallet.waiting");
  if (status === "switching") return t("wallet.switching");
  if (status === "connected") return t("wallet.arcConnected");
  return t("wallet.switch");
}

function PreferenceFields({ locale, theme, setLocale, setTheme, t, compact }: { locale: "en" | "vi"; theme: "system" | "light" | "dark"; setLocale(locale: "en" | "vi"): void; setTheme(theme: "system" | "light" | "dark"): void; t: ReturnType<typeof usePreferences>["t"]; compact?: boolean }) {
  return <section className={`preference-fields ${compact ? "compact" : ""}`}><strong>{t("wallet.preferences")}</strong><label><span>{t("preferences.language")}</span><select value={locale} onChange={(event) => setLocale(event.target.value as "en" | "vi")}><option value="en">English</option><option value="vi">Tiếng Việt</option></select></label><label><span>{t("preferences.appearance")}</span><select value={theme} onChange={(event) => setTheme(event.target.value as "system" | "light" | "dark")}><option value="system">{t("preferences.system")}</option><option value="light">{t("preferences.light")}</option><option value="dark">{t("preferences.dark")}</option></select></label></section>;
}

function isOkxConnector(connector: Connector) {
  const rdns = Array.isArray(connector.rdns) ? connector.rdns.join(" ") : connector.rdns ?? "";
  return /okx|okex/i.test(`${connector.name} ${connector.id} ${rdns}`);
}

function connectorRank(connector: Connector) {
  if (!isOkxConnector(connector)) return 2;
  return connector.rdns ? 0 : 1;
}

function walletErrorMessage(error: unknown, action: string, t: ReturnType<typeof usePreferences>["t"]) {
  const message = error instanceof Error ? error.message : "Unknown wallet error";
  if (/rejected|denied|4001/i.test(message)) return t("tx.rejected");
  if (/not found|provider/i.test(message)) return `${action}: ${t("wallet.noWallet")}`;
  if (/chain|network/i.test(message)) return t("wallet.switch");
  return t("tx.failed");
}
