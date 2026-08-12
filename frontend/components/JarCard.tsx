import Link from "next/link";
import { formatDate, formatUsdc, jarStatus, progressPercent } from "@/lib/format";
import type { Jar } from "@/lib/types";
import { ProgressBar } from "./ProgressBar";
import { usePreferences } from "@/hooks/usePreferences";

export function JarCard({ jar }: { jar: Jar }) {
  const { t } = usePreferences();
  const progress = progressPercent(jar.balance, jar.targetAmount);
  const status = jarStatus(jar.unlockTime, jar.closed);
  const detailUrl = `/jars/${jar.id}`;
  const statusLabel = status === "Locked" ? t("status.locked") : status === "Unlocked" ? t("status.unlocked") : t("status.closed");

  return (
    <article className="jar-card">
      <div className="card-topline">
        <span className={`status-pill ${status.toLowerCase()}`}>{statusLabel}</span>
        <span className="jar-number">{t("jar.number", { id: jar.id.toString() })}</span>
      </div>
      <div className="jar-card-heading">
        <p className="eyebrow">{jar.totalContributed > 0n ? `✦ ${t("jar.sharedActivity")}` : t("jar.personal")}</p>
        <h3>{jar.name}</h3>
      </div>
      <div className="amount-row">
        <strong>{formatUsdc(jar.balance)}</strong>
        <span>/ {formatUsdc(jar.targetAmount)} USDC</span>
      </div>
      <div className="progress-label"><span>{t("jar.percentSaved", { percent: progress.toFixed(progress % 1 ? 1 : 0) })}</span><span>{t("jar.target")} {formatUsdc(jar.targetAmount)} USDC</span></div>
      <ProgressBar value={progress} />
      <div className="jar-card-unlock"><span>{status === "Locked" ? t("jar.unlocks") : statusLabel}</span><strong>{formatDate(jar.unlockTime)}</strong></div>
      <div className="card-footer">
        <span>{jar.totalContributed > 0n ? t("jar.sharedAmount", { amount: formatUsdc(jar.totalContributed) }) : t("jar.personalGoal")}</span>
        <Link href={detailUrl}>{t("jar.view")} <span aria-hidden="true">→</span></Link>
      </div>
    </article>
  );
}
