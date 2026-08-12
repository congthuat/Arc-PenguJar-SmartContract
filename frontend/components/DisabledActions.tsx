"use client";

import { usePreferences } from "@/hooks/usePreferences";

export function DisabledActions({ depositEnabled, contributeEnabled, withdrawEnabled, depositReason, contributeReason, withdrawReason, onDeposit, onContribute, onWithdraw, ownerConnected }: { depositEnabled: boolean; contributeEnabled: boolean; withdrawEnabled: boolean; depositReason: string; contributeReason: string; withdrawReason: string; onDeposit(): void; onContribute(): void; onWithdraw(): void; ownerConnected: boolean }) {
  const { t } = usePreferences();
  return (
    <section className={`actions-card ${ownerConnected ? "owner-actions" : "public-actions"}`}>
      <div>
        <p className="eyebrow">{t("actions.title")}</p>
        <h2>{t("actions.keepMoving")}</h2>
        <p>{ownerConnected ? t("actions.ownerCopy") : t("actions.contributorCopy")}</p>
      </div>
      <div className="disabled-actions" aria-label={t("actions.aria")}>
        <div><button className="deposit-action" disabled={!depositEnabled} onClick={onDeposit} title={depositEnabled ? t("actions.deposit") : depositReason}>{t("actions.deposit")}</button>{!depositEnabled && <small>{depositReason}</small>}</div>
        <div><button className="contribute-action" disabled={!contributeEnabled} onClick={onContribute} title={contributeEnabled ? t("actions.contribute") : contributeReason}>{t("actions.contribute")}</button>{!contributeEnabled && <small>{contributeReason}</small>}</div>
        <div><button className="withdraw-action" disabled={!withdrawEnabled} onClick={onWithdraw} title={withdrawEnabled ? t("actions.withdraw") : withdrawReason}>{t("actions.withdraw")}</button>{!withdrawEnabled && <small>{withdrawReason}</small>}</div>
      </div>
    </section>
  );
}
