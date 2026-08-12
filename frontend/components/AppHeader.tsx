"use client";

import Link from "next/link";
import { WalletControl } from "./WalletControl";
import { usePreferences } from "@/hooks/usePreferences";

export function AppHeader() {
  const { locale, setLocale, theme, setTheme, t } = usePreferences();

  function toggleTheme() {
    if (theme === "light") return setTheme("dark");
    if (theme === "dark") return setTheme("light");
    const systemIsDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(systemIsDark ? "light" : "dark");
  }

  const toggleLabel = theme === "light"
    ? t("preferences.switchDark")
    : theme === "dark"
      ? t("preferences.switchLight")
      : t("preferences.systemMode");
  return (
    <header className="app-header">
      <Link className="brand" href="/" aria-label="PenguJar home">
        <span className="brand-mark" aria-hidden="true">
          <span className="penguin-face">•ᴗ•</span>
        </span>
        <span>PenguJar</span>
      </Link>
      <div className="header-actions">
        <span className="network-badge"><i /> {t("network.arc")}</span>
        <label className="language-quick"><span aria-hidden="true">◎</span><select aria-label={t("preferences.language")} value={locale} onChange={(event) => setLocale(event.target.value as "en" | "vi")}><option value="en">EN</option><option value="vi">VI</option></select></label>
        <button className="theme-quick" type="button" onClick={toggleTheme} aria-label={toggleLabel} title={toggleLabel}><span aria-hidden="true">{theme === "light" ? "☾" : theme === "dark" ? "☀" : "◐"}</span></button>
        <WalletControl />
      </div>
    </header>
  );
}
