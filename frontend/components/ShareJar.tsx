"use client";

import { useState } from "react";
import { formatUsdc } from "@/lib/format";
import type { Jar } from "@/lib/types";
import { usePreferences } from "@/hooks/usePreferences";

export function ShareJar({ jar }: { jar: Jar }) {
  const { locale, t } = usePreferences();
  const [feedback, setFeedback] = useState<string>();

  function canonicalUrl() {
    return `${window.location.origin}/jars/${jar.id}`;
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(canonicalUrl());
      setFeedback(t("share.copied"));
    } catch {
      setFeedback(t("share.copyFailed"));
    }
    window.setTimeout(() => setFeedback(undefined), 2200);
  }

  async function share() {
    const url = canonicalUrl();
    const text = locale === "vi"
      ? `Cùng mình hoàn thành mục tiêu Makoto Vault:\n${jar.name}\n${formatUsdc(jar.balance)} / ${formatUsdc(jar.targetAmount)} USDC`
      : `Help me reach my Makoto Vault goal:\n${jar.name}\n${formatUsdc(jar.balance)} / ${formatUsdc(jar.targetAmount)} USDC`;
    try {
      if (navigator.share) await navigator.share({ title: jar.name, text, url });
      else await copyLink();
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      await copyLink();
    }
  }

  return <div className="share-controls">
    <button className="share-button" onClick={() => void share()} aria-label={t("share.jar")} title={t("share.jar")}>↗ <span>{t("share.jar")}</span></button>
    <button className="copy-link-button" onClick={() => void copyLink()} aria-label={t("share.copy")} title={t("share.copy")}>⧉ <span>{t("share.copy")}</span></button>
    <span className="share-feedback" role="status" aria-live="polite">{feedback}</span>
  </div>;
}
