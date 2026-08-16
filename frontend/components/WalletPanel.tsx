"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export function WalletPanel({ title, onClose, children, closeDisabled = false }: { title: string; onClose(): void; children: ReactNode; closeDisabled?: boolean }) {
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    panelRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !closeDisabled) closeRef.current(); };
    document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("keydown", handleKey); previous?.focus(); };
  }, [closeDisabled]);
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !closeDisabled) onClose(); }}><section ref={panelRef} tabIndex={-1} className="create-modal wallet-action-modal" role="dialog" aria-modal="true" aria-label={title}><header className="modal-header"><div><p className="eyebrow">Makoto Wallet</p><h2>{title}</h2></div><button type="button" onClick={onClose} aria-label="Close Makoto Wallet panel" disabled={closeDisabled}>×</button></header>{children}</section></div>;
}

export function CopyButton({ value, idle, copiedLabel }: { value: string; idle: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() { await navigator.clipboard.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }
  return <button type="button" className="secondary-button" onClick={() => void copy()}>{copied ? copiedLabel : idle}</button>;
}
