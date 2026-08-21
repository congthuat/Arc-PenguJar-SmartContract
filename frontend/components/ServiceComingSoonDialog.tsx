"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { usePreferences } from "@/hooks/usePreferences";
import styles from "./MakotoPay.module.css";

export function ServiceComingSoonDialog({ service, onClose }: { service: string; onClose(): void }) {
  const { t } = usePreferences();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") return onClose();
      if (event.key !== "Tab") return;
      const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button,[href],[tabindex]:not([tabindex="-1"])');
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); document.body.style.overflow = previousOverflow; };
  }, [onClose]);

  return createPortal(<div className={styles.dialogBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialogRef} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="pay-coming-title">
      <span className={styles.dialogIcon} aria-hidden="true">◇</span>
      <p className={styles.eyebrow}>{service}</p>
      <h2 id="pay-coming-title">{t("pay.comingTitle")}</h2>
      <p>{t("pay.comingCopy")}</p>
      <p>{t("pay.comingDemoCopy")}</p>
      <p className={styles.dialogDisclosure}>{t("pay.comingNoProvider")}</p>
      <button type="button" onClick={onClose}>{t("pay.gotIt")}</button>
    </div>
  </div>, document.body);
}
