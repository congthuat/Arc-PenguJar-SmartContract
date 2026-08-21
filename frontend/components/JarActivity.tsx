"use client";

import { useEffect, useState } from "react";
import { ARC_EXPLORER_URL } from "@/lib/config";
import { formatDate, formatUsdc, shortAddress } from "@/lib/format";
import type { JarActivityItem } from "@/lib/types";
import { usePreferences } from "@/hooks/usePreferences";

export function JarActivity({ items, isLoading, isError, onRetry }: { items: JarActivityItem[]; isLoading: boolean; isError: boolean; onRetry(): void }) {
  const { t } = usePreferences();
  return <section className="activity-card" aria-labelledby="activity-heading">
    <div className="activity-heading"><div><p className="eyebrow">{t("activity.onchain")}</p><h2 id="activity-heading">{t("activity.title")}</h2></div></div>
    {isLoading ? <ActivityLoading />
      : isError ? <div className="activity-state"><p>{t("activity.error")}</p><button className="secondary-button" onClick={onRetry}>{t("common.tryAgain")}</button></div>
        : items.length === 0 ? <p className="activity-state">{t("activity.empty")}</p>
          : <ol className="activity-list">{items.map((item) => <ActivityRow key={item.id} item={item} />)}</ol>}
  </section>;
}

function ActivityLoading() {
  const { t } = usePreferences();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 4_000);
    return () => window.clearTimeout(timer);
  }, []);
  return <div className="activity-state" role="status"><p>{t("activity.loading")}</p>{slow && <small>{t("activity.slow")}</small>}</div>;
}

function ActivityRow({ item }: { item: JarActivityItem }) {
  const { t } = usePreferences();
  const label = item.type === "created" ? t("activity.created") : item.type === "deposit" ? t("activity.deposited") : item.type === "contribution" ? t("activity.contributed") : item.type === "unlocked" ? t("activity.unlocked") : t("activity.withdrawn");
  return <li className="activity-row">
    <span className={`activity-icon ${item.type}`} aria-hidden="true">{item.type === "created" ? "+" : item.type === "withdrawal" ? "↑" : "↓"}</span>
    <div className="activity-main"><strong>{label}</strong><span title={item.actor}>{shortAddress(item.actor)}</span></div>
    <div className="activity-meta">{item.amount !== undefined && <strong>{formatUsdc(item.amount)} USDC</strong>}<time>{formatDate(item.timestamp)}</time></div>
    {item.transactionHash ? <a href={`${ARC_EXPLORER_URL}/tx/${item.transactionHash}`} target="_blank" rel="noreferrer" aria-label={`${t("activity.viewTransaction")}: ${label}`}>{t("activity.viewTransaction")} ↗</a> : <span className="activity-milestone">{t("activity.milestone")}</span>}
  </li>;
}
