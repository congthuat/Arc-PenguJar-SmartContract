"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePreferences } from "@/hooks/usePreferences";
import styles from "./MakotoWallet.module.css";

export function LanguageMenu({ icon }: { icon?: ReactNode }) {
  const { locale, setLocale, t } = usePreferences();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const closeEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => { document.removeEventListener("pointerdown", closeOutside); document.removeEventListener("keydown", closeEscape); };
  }, [open]);

  return <div className={styles.languageMenu} ref={root}>
    <button type="button" className={styles.languageTrigger} aria-label={t("preferences.language")} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      {icon}<span>{locale.toUpperCase()}</span><i aria-hidden="true">⌄</i>
    </button>
    {open && <div className={styles.languageDropdown} role="menu" aria-label={t("preferences.language")}>
      {(["en", "vi"] as const).map((option) => <button key={option} type="button" role="menuitemradio" aria-checked={locale === option} className={locale === option ? styles.languageActive : undefined} onClick={() => { setLocale(option); setOpen(false); }}><span>{option === "en" ? t("preferences.english") : t("preferences.vietnamese")}</span><strong>{option.toUpperCase()}</strong></button>)}
    </div>}
  </div>;
}
