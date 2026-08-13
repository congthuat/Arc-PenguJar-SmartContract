"use client";

import { parseUnits } from "viem";
import { formatUsdc } from "@/lib/format";
import type { Jar } from "@/lib/types";
import { usePrivateJarMetadata } from "@/hooks/usePrivateJarMetadata";

export function PrivateMetadataPanel({ jar }: { jar: Jar }) {
  const state = usePrivateJarMetadata(jar);
  if (!state.isPrivate) return null;

  return (
    <article className="private-metadata-panel">
      <div><span aria-hidden="true">🔒</span><div><strong>Private metadata</strong><small>Metadata encrypted on this device. Onchain addresses, balances, transfers, and timestamps remain public.</small></div></div>
      {state.metadata ? (
        <dl>
          <div><dt>Name</dt><dd>{state.metadata.name}</dd></div>
          <div><dt>Target</dt><dd>{formatUsdc(parseUnits(state.metadata.targetAmount, 6))} USDC</dd></div>
          <div><dt>Note</dt><dd>{state.metadata.note || "—"}</dd></div>
        </dl>
      ) : (
        <div className="private-metadata-state">
          <span>{state.available ? "Encrypted metadata is available locally." : "Private metadata unavailable on this device"}</span>
          {state.available && state.isOwner && <button onClick={() => void state.decrypt()} disabled={state.isDecrypting}>{state.isDecrypting ? "Waiting for signature…" : "Decrypt metadata"}</button>}
          {state.error && <small>{state.error}</small>}
        </div>
      )}
    </article>
  );
}
