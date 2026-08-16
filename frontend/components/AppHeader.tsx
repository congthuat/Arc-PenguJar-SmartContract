"use client";

import Image from "next/image";
import Link from "next/link";
import { WalletControl } from "./WalletControl";
import { usePreferences } from "@/hooks/usePreferences";
import styles from "./MakotoWallet.module.css";

const navItems = [
  { href: "/", icon: "/makoto/nav/wallet.png", en: "Wallet", vi: "Ví", active: true },
  { href: "#activity", icon: "/makoto/nav/activity.png", en: "Activity", vi: "Hoạt động" },
  { href: "/savings", icon: "/makoto/nav/savings.png", en: "Savings", vi: "Tiết kiệm" },
];

export function AppHeader() {
  const { locale, setLocale, theme, setTheme, t } = usePreferences();

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
  const betaInfo = locale === "vi"
    ? "Makoto Wallet hiện đang chạy trên Arc Testnet. Tài sản testnet chỉ dùng để thử nghiệm và không có giá trị thực dự kiến."
    : "Makoto Wallet is currently running on Arc Testnet. Testnet assets are for testing and have no intended real-world value.";

  return (
    <header className={styles.header}>
      <Link className={styles.brand} href="/" aria-label="Makoto Wallet home">
        <Image
          src="/makoto/logo.png"
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
              className={item.active ? styles.navActive : undefined}
              href={item.href}
            >
              <Image src={item.icon} alt="" width={30} height={30} className={styles.navImageIcon} />
              <span>{locale === "vi" ? item.vi : item.en}</span>
            </a>
          ) : (
            <Link
              key={item.en}
              className={item.active ? styles.navActive : undefined}
              href={item.href}
            >
              <Image src={item.icon} alt="" width={30} height={30} className={styles.navImageIcon} />
              <span>{locale === "vi" ? item.vi : item.en}</span>
            </Link>
          ),
        )}

        <span className={styles.navMuted} title={locale === "vi" ? "Sắp có" : "Coming soon"}>
          <Image src="/makoto/nav/settings.png" alt="" width={30} height={30} className={styles.navImageIcon} />
          <span>{locale === "vi" ? "Cài đặt" : "Settings"}</span>
        </span>
      </nav>

      <div className={styles.headerActions}>
        <span className={styles.networkPill} title={betaInfo} aria-label={`Public Beta · Arc Testnet. ${betaInfo}`}>
          <Image src="/makoto/nav/network.png" alt="" width={24} height={24} className={styles.pillIcon} />
          <span>Public Beta · Arc Testnet</span>
        </span>

        <label className={styles.languagePill}>
          <Image src="/makoto/nav/language.png" alt="" width={24} height={24} className={styles.pillIcon} />
          <select
            aria-label={t("preferences.language")}
            value={locale}
            onChange={(event) => setLocale(event.target.value as "en" | "vi")}
          >
            <option value="en">EN</option>
            <option value="vi">VI</option>
          </select>
        </label>

        <button
          className={styles.themeButton}
          type="button"
          onClick={toggleTheme}
          aria-label={toggleLabel}
          title={toggleLabel}
        >
          <Image src="/makoto/nav/theme.png" alt="" width={25} height={25} className={styles.pillIcon} />
        </button>

        <div className={styles.walletControlWrap}>
          <Image src="/makoto/nav/address.png" alt="" width={27} height={27} className={styles.walletControlIcon} />
          <WalletControl />
        </div>
      </div>
    </header>
  );
}
