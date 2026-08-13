"use client";

import Link from "next/link";
import { parseUnits } from "viem";
import { formatDate, formatUsdc, jarStatus, progressPercent } from "@/lib/format";
import type { Jar } from "@/lib/types";
import { ProgressBar } from "./ProgressBar";
import { usePreferences } from "@/hooks/usePreferences";
import { usePrivateJarMetadata } from "@/hooks/usePrivateJarMetadata";

export function JarCard({ jar }: { jar: Jar }) {
  const { t } = usePreferences();
  const privateMetadata = usePrivateJarMetadata(jar);
  const displayTarget = privateMetadata.metadata ? parseUnits(privateMetadata.metadata.targetAmount, 6) : jar.targetAmount;
  const displayName = privateMetadata.metadata?.name || (privateMetadata.isPrivate ? "Private Jar" : jar.name);
  const progress = progressPercent(jar.balance, displayTarget);
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
        <h3>{privateMetadata.isPrivate ? `🔒 ${displayName}` : displayName}</h3>
        {privateMetadata.isPrivate && !privateMetadata.metadata && <div className="private-metadata-state"><span>{privateMetadata.available ? "Metadata encrypted on this device" : "Private metadata unavailable on this device"}</span>{privateMetadata.available && privateMetadata.isOwner && <button onClick={() => void privateMetadata.decrypt()} disabled={privateMetadata.isDecrypting}>{privateMetadata.isDecrypting ? "Waiting for signature…" : "Decrypt metadata"}</button>}{privateMetadata.error && <small>{privateMetadata.error}</small>}</div>}
        {privateMetadata.metadata?.note && <p className="private-note">{privateMetadata.metadata.note}</p>}
      </div>
      <div className="amount-row">
        <strong>{formatUsdc(jar.balance)}</strong>
        <span>/ {privateMetadata.isPrivate && !privateMetadata.metadata ? "—" : formatUsdc(displayTarget)} USDC</span>
      </div>
      <div className="progress-label"><span>{privateMetadata.isPrivate && !privateMetadata.metadata ? "Private metadata" : t("jar.percentSaved", { percent: progress.toFixed(progress % 1 ? 1 : 0) })}</span><span>{t("jar.target")} {privateMetadata.isPrivate && !privateMetadata.metadata ? "—" : formatUsdc(displayTarget)} USDC</span></div>
      <ProgressBar value={progress} />
      <div className="jar-card-unlock"><span>{status === "Locked" ? t("jar.unlocks") : statusLabel}</span><strong>{formatDate(jar.unlockTime)}</strong></div>
      <div className="card-footer">
        <span>{jar.totalContributed > 0n ? t("jar.sharedAmount", { amount: formatUsdc(jar.totalContributed) }) : t("jar.personalGoal")}</span>
        <Link href={detailUrl}>{t("jar.view")} <span aria-hidden="true">→</span></Link>
      </div>
    </article>
  );
}
