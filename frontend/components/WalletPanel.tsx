"use client";

import { useState, type ReactNode } from "react";

export function WalletPanel({ title, onClose, children }: { title: string; onClose(): void; children: ReactNode }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="create-modal wallet-action-modal" role="dialog" aria-modal="true" aria-label={title}><header className="modal-header"><div><p className="eyebrow">Makoto Wallet</p><h2>{title}</h2></div><button type="button" onClick={onClose} aria-label="Close">×</button></header>{children}</section></div>;
}

export function CopyButton({ value, idle, copiedLabel }: { value: string; idle: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() { await navigator.clipboard.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }
  return <button type="button" className="secondary-button" onClick={() => void copy()}>{copied ? copiedLabel : idle}</button>;
}
