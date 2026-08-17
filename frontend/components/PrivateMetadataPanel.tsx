"use client";

import { parseUnits } from "viem";
import { formatUsdc } from "@/lib/format";
import type { Jar } from "@/lib/types";
import { usePrivateJarMetadata } from "@/hooks/usePrivateJarMetadata";
import { usePreferences } from "@/hooks/usePreferences";

export function PrivateMetadataPanel({ jar }: { jar: Jar }) {
  const { t } = usePreferences();
  const state = usePrivateJarMetadata(jar);
  if (!state.isPrivate) return null;

  return (
    <article className="private-metadata-panel">
      <div><span aria-hidden="true">🔒</span><div><strong>{t("jar.privateMetadata")}</strong><small>{t("private.description")}</small></div></div>
      {state.metadata ? (
        <dl>
          <div><dt>{t("private.name")}</dt><dd>{state.metadata.name}</dd></div>
          <div><dt>{t("private.target")}</dt><dd>{formatUsdc(parseUnits(state.metadata.targetAmount, 6))} USDC</dd></div>
          <div><dt>{t("private.note")}</dt><dd>{state.metadata.note || "—"}</dd></div>
        </dl>
      ) : (
        <div className="private-metadata-state">
          <span>{state.available ? t("private.available") : t("jar.metadataUnavailable")}</span>
          {state.available && state.isOwner && <button onClick={() => void state.decrypt()} disabled={state.isDecrypting}>{state.isDecrypting ? t("jar.waitingSignature") : t("jar.decryptMetadata")}</button>}
          {state.error && <small>{state.error}</small>}
        </div>
      )}
    </article>
  );
}
