"use client";

import { FormEvent, useCallback, useMemo, useState } from "react";
import { getAddress, isAddress, type Address } from "viem";
import { useConnection, useReadContract } from "wagmi";
import { AppHeader } from "./AppHeader";
import { CreateJarFlow } from "./CreateJarFlow";
import { JarCard } from "./JarCard";
import { StatePanel } from "./StatePanel";
import { useOwnerJars } from "@/hooks/useOwnerJars";
import { useHydrated } from "@/hooks/useHydrated";
import { useVerifiedWalletChain } from "@/hooks/useVerifiedWalletChain";
import { penguJarV2Abi } from "@/lib/abi/penguJarV2";
import { contractAddress, contractAddressError, EXPECTED_USDC_ADDRESS } from "@/lib/config";
import { formatUsdc, jarStatus } from "@/lib/format";
import { usePreferences } from "@/hooks/usePreferences";

export function Dashboard({ initialOwner }: { initialOwner?: string }) {
  const { t } = usePreferences();
  const normalizedInitialOwner = initialOwner && isAddress(initialOwner) ? getAddress(initialOwner) : undefined;
  const [input, setInput] = useState(normalizedInitialOwner ?? "");
  const [manualOwner, setManualOwner] = useState<Address | undefined>(normalizedInitialOwner);
  const [inputError, setInputError] = useState<string>();
  const [createOpen, setCreateOpen] = useState(false);
  const hydrated = useHydrated();
  const connection = useConnection();
  const verifiedChain = useVerifiedWalletChain();
  const walletConnected = hydrated && connection.isConnected;
  const isWrongNetwork = walletConnected && !verifiedChain.isArc;
  const owner = walletConnected
    ? (isWrongNetwork ? undefined : connection.address)
    : manualOwner;
  const { jars, isLoading, error, refetch } = useOwnerJars(owner);
  const refetchAfterCreate = useCallback(async () => { await refetch(); }, [refetch]);
  const usdcQuery = useReadContract({
    address: contractAddress,
    abi: penguJarV2Abi,
    functionName: "USDC",
    query: { enabled: Boolean(contractAddress) },
  });

  const totals = useMemo(() => ({
    balance: jars.reduce((sum, jar) => sum + jar.balance, 0n),
    active: jars.filter((jar) => jarStatus(jar.unlockTime, jar.closed) === "Locked").length,
  }), [jars]);

  function submitAddress(event: FormEvent) {
    event.preventDefault();
    if (!isAddress(input.trim())) {
      setInputError(t("validation.address"));
      return;
    }
    const normalized = getAddress(input.trim());
    setManualOwner(normalized);
    setInputError(undefined);
    window.history.replaceState({}, "", `/?owner=${normalized}`);
  }

  const usdcMismatch = usdcQuery.data && usdcQuery.data.toLowerCase() !== EXPECTED_USDC_ADDRESS.toLowerCase();

  return (
    <main>
      <div className="shell">
        <AppHeader />
        <section className={`hero ${walletConnected ? "hero-connected" : ""}`}>
          <div className="hero-copy">
            <span className="kicker">{walletConnected ? t("dashboard.connectedKicker") : t("dashboard.kicker")}</span>
            <h1>{walletConnected ? t("dashboard.connectedHero") : t("dashboard.hero")}</h1>
            <p>{walletConnected ? t("dashboard.syncedCopy") : t("dashboard.heroCopy")}</p>
          </div>
          <div className="penguin-scene" aria-hidden="true">
            <span className="sun-dot" />
            <div className="hero-jar"><span>•ᴗ•</span><i /></div>
            <span className="spark spark-one">✦</span><span className="spark spark-two">✦</span>
          </div>
        </section>

        {walletConnected ? (
          <section className={`address-panel connected-address-panel ${isWrongNetwork ? "network-warning" : ""}`} aria-labelledby="address-title">
            <div><p className="eyebrow">{isWrongNetwork ? t("dashboard.networkCheck") : t("dashboard.allSynced")}</p><h2 id="address-title">{isWrongNetwork ? t("dashboard.switchTitle") : t("dashboard.yourSavings")}</h2><p>{isWrongNetwork ? t("dashboard.switchCopy") : t("dashboard.upToDate")}</p></div>
            <div className="connection-assurance"><span>{isWrongNetwork ? "!" : "✓"}</span><div><strong>{isWrongNetwork ? t("wallet.wrongNetwork") : t("dashboard.synced")}</strong>{isWrongNetwork && <button className="switch-button" onClick={() => void verifiedChain.switchToArc()} disabled={["waiting", "switching", "missing"].includes(verifiedChain.switchStatus)}>{verifiedChain.switchStatus === "waiting" || verifiedChain.switchStatus === "missing" ? t("wallet.waiting") : verifiedChain.switchStatus === "switching" ? t("wallet.switching") : t("wallet.switch")}</button>}{verifiedChain.switchMessage && <small>{verifiedChain.switchMessage}</small>}</div></div>
          </section>
        ) : (
          <section className="address-panel" aria-labelledby="address-title">
            <div><p className="eyebrow">{t("dashboard.find")}</p><h2 id="address-title">{t("dashboard.connectOrLook")}</h2><p>{t("dashboard.lookupCopy")}</p></div>
            <form onSubmit={submitAddress}>
              <label htmlFor="owner-address">{t("dashboard.walletAddress")}</label>
              <div className="address-controls">
                <input id="owner-address" value={input} onChange={(event) => setInput(event.target.value)} placeholder="0x…" spellCheck={false} />
                <button type="submit">{t("dashboard.viewSavings")}</button>
              </div>
              {inputError && <p className="field-error">{inputError}</p>}
            </form>
          </section>
        )}

        {owner && <section className="summary-section" aria-label="Savings summary">
          <div className="summary-primary"><p>{t("dashboard.yourSavings")}</p><strong>{owner ? formatUsdc(totals.balance) : "—"}</strong><span>{t("dashboard.acrossJars")}</span></div>
          <div className="summary-stat"><span className="summary-icon lavender">◒</span><div><strong>{owner ? jars.length : "—"}</strong><span>{t("dashboard.totalJars")}</span></div></div>
          <div className="summary-stat"><span className="summary-icon mint">⌁</span><div><strong>{owner ? totals.active : "—"}</strong><span>{t("dashboard.activeLocked")}</span></div></div>
          <button className="create-button enabled" onClick={() => setCreateOpen(true)} disabled={!walletConnected || isWrongNetwork || !contractAddress}><span>＋</span> {t("dashboard.create")}<small>{!walletConnected ? t("dashboard.connectToCreate") : isWrongNetwork ? t("wallet.switch") : t("dashboard.startGoal")}</small></button>
        </section>}

        <section className="jars-section">
          <div className="section-heading"><div><p className="eyebrow">{t("dashboard.goals")}</p><h2>{t("dashboard.myJars")}</h2></div>{owner && <button className="refresh-button" onClick={() => void refetch()} disabled={isLoading} aria-busy={isLoading}>{isLoading ? t("common.refreshing") : t("common.refresh")}</button>}</div>
          {contractAddressError ? (
            <StatePanel icon="!" title={t("dashboard.configNeeded")}><p>{contractAddressError}</p></StatePanel>
          ) : usdcMismatch ? (
            <StatePanel icon="!" title={t("dashboard.safetyFailed")}><p>{t("validation.reverted")}</p></StatePanel>
          ) : usdcQuery.error ? (
            <StatePanel icon="↻" title={t("dashboard.arcBreak")}><p>{t("tx.rpc")}</p></StatePanel>
          ) : isWrongNetwork ? (
            <StatePanel icon="!" title={t("wallet.switch")}><p>{t("dashboard.switchCopy")}</p></StatePanel>
          ) : !owner ? (
            <StatePanel icon="⌕" title={t("dashboard.enterAddress")}><p>{t("dashboard.lookupCopy")}</p></StatePanel>
          ) : isLoading ? (
            <div className="card-grid" aria-label="Loading jars"><div className="skeleton-card" /><div className="skeleton-card" /></div>
          ) : error ? (
            <StatePanel icon="↻" title={t("dashboard.loadFailed")}><p>{t("dashboard.loadFailedCopy")}</p><button className="secondary-button" onClick={() => void refetch()}>{t("common.tryAgain")}</button></StatePanel>
          ) : jars.length === 0 ? (
            <StatePanel icon="✦" title={t("dashboard.noJars")}><p>{t("dashboard.noJarsCopy")}</p></StatePanel>
          ) : (
            <div className="card-grid">{jars.map((jar) => <JarCard key={jar.id.toString()} jar={jar} />)}</div>
          )}
        </section>
        <footer><span>PenguJar · Arc Testnet</span><span>{t("footer.rule")}</span></footer>
        <CreateJarFlow open={createOpen} onClose={() => setCreateOpen(false)} onConfirmed={refetchAfterCreate} />
      </div>
    </main>
  );
}
