"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { WalletControl } from "./WalletControl";
import { LanguageMenu } from "./LanguageMenu";
import { usePreferences } from "@/hooks/usePreferences";
import styles from "./MakotoWallet.module.css";

type HeaderIconName = "wallet" | "activity" | "pay" | "savings" | "settings" | "network" | "language" | "theme" | "sun" | "address";

const navItems: ReadonlyArray<{ href: string; icon: HeaderIconName; en: string; vi: string; active?: boolean }> = [
  { href: "/", icon: "wallet", en: "Wallet", vi: "Ví", active: true },
  { href: "/pay", icon: "pay", en: "Pay", vi: "Thanh toán" },
  { href: "#activity", icon: "activity", en: "Activity", vi: "Hoạt động" },
  { href: "/savings", icon: "savings", en: "Savings", vi: "Tiết kiệm" },
];

function HeaderIcon({ name, className }: { name: HeaderIconName; className: string }) {
  let glyph: ReactNode;
  switch (name) {
    case "wallet": glyph = <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M16 10h5v5h-5a2.5 2.5 0 0 1 0-5Z" /><path d="M5 6V5a2 2 0 0 1 2-2h10" /><circle cx="16.5" cy="12.5" r=".5" /></>; break;
    case "activity": glyph = <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M12 2v3M22 12h-3M12 22v-3M2 12h3" /></>; break;
    case "pay": glyph = <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3 9h18M7 15h4" /><path d="m16 13 2 2 3-4" /></>; break;
    case "savings": glyph = <><path d="M7 4h10M8 4 7 8v9a3 3 0 0 0 3 3h4a3 3 0 0 0 3-3V8l-1-4" /><path d="M7 9h10M10 13h4" /></>; break;
    case "settings": glyph = <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1v.1h-4v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1-.4h-.1v-4H3a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1v-.1h4V3a1.7 1.7 0 0 0 1.1 1.6 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.12.36.33.7.6 1 .27.27.62.48 1 .6h.1v4H21a1.7 1.7 0 0 0-1.6.4Z" /></>; break;
    case "network": glyph = <><circle cx="6" cy="7" r="2" /><circle cx="18" cy="7" r="2" /><circle cx="12" cy="18" r="2" /><path d="m7.7 8.1 3.2 7.8M16.3 8.1l-3.2 7.8M8 7h8" /></>; break;
    case "language": glyph = <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></>; break;
    case "theme": glyph = <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z" />; break;
    case "sun": glyph = <><circle cx="12" cy="12" r="3.5" /><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" /></>; break;
    case "address": glyph = <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 9h18M7 14h4" /><circle cx="17" cy="14" r="1" /></>; break;
  }
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{glyph}</svg>;
}

export function AppHeader() {
  const { locale, theme, setTheme, t } = usePreferences();
  const pathname = usePathname();

  function toggleTheme() {
    if (theme === "light") return setTheme("dark");
    if (theme === "dark") return setTheme("light");
    const systemIsDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(systemIsDark ? "light" : "dark");
  }

  const toggleLabel =
    theme === "light"
      ? t("preferences.switchDark")
      : theme === "dark"
        ? t("preferences.switchLight")
        : t("preferences.systemMode");
  const betaInfo = t("walletHome.betaInfo");
  const betaLabel = `${t("walletHome.publicBeta")} · Arc Testnet`;

  return (
    <header className={styles.header}>
      <Link className={styles.brand} href="/" aria-label="Makoto Wallet home">
        <Image
          src="/makoto/logo-pro-v2.png"
          width={52}
          height={52}
          alt=""
          className={styles.brandLogo}
          priority
        />
        <span className={styles.brandWords}>
          <strong>Makoto</strong>
          <small>WALLET</small>
        </span>
      </Link>

      <nav className={styles.nav} aria-label="Primary">
        {navItems.map((item) =>
          item.href.startsWith("#") ? (
            <a
              key={item.en}
              className={pathname === "/" ? styles.navActive : undefined}
              href={item.href}
            >
              <HeaderIcon name={item.icon} className={styles.headerGlyph} />
              <span>{locale === "vi" ? item.vi : item.en}</span>
            </a>
          ) : (
            <Link
              key={item.en}
              className={pathname === item.href || (item.href === "/pay" && pathname.startsWith("/pay/")) ? styles.navActive : undefined}
              href={item.href}
            >
              <HeaderIcon name={item.icon} className={styles.headerGlyph} />
              <span>{locale === "vi" ? item.vi : item.en}</span>
            </Link>
          ),
        )}

        <Link className={pathname === "/settings" ? styles.navActive : undefined} href="/settings">
          <HeaderIcon name="settings" className={styles.headerGlyph} />
          <span>{locale === "vi" ? "Cài đặt" : "Settings"}</span>
        </Link>
      </nav>

      <div className={styles.headerActions}>
        <span className={styles.networkPill} title={betaInfo} aria-label={`${betaLabel}. ${betaInfo}`}>
          <HeaderIcon name="network" className={`${styles.pillGlyph} ${styles.networkGlyph}`} />
          <span>{betaLabel}</span>
        </span>

        <LanguageMenu icon={<HeaderIcon name="language" className={`${styles.pillGlyph} ${styles.languageGlyph}`} />} />

        <button
          className={styles.themeButton}
          type="button"
          onClick={toggleTheme}
          aria-label={toggleLabel}
          title={toggleLabel}
        >
          <HeaderIcon name={theme === "dark" ? "sun" : "theme"} className={`${styles.pillGlyph} ${styles.themeGlyph}`} />
        </button>

        <div className={styles.walletControlWrap}>
          <HeaderIcon name="address" className={`${styles.pillGlyph} ${styles.addressGlyph}`} />
          <WalletControl />
        </div>
      </div>
    </header>
  );
}
