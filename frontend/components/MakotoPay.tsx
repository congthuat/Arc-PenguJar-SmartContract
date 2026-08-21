"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { AppHeader } from "./AppHeader";
import { ServiceComingSoonDialog } from "./ServiceComingSoonDialog";
import { usePreferences } from "@/hooks/usePreferences";
import styles from "./MakotoPay.module.css";
import walletStyles from "./MakotoWallet.module.css";

const services = ["mobile", "data", "electricity", "water", "internet", "television", "movies", "games", "giftCards", "shopping", "food", "transport", "travel", "hotels", "education", "otherBills", "merchant", "subscriptions"] as const;
const popular = ["mobile", "electricity", "internet", "movies", "giftCards", "merchant"] as const;
const icons: Record<(typeof services)[number], string> = { mobile: "▣", data: "⌁", electricity: "ϟ", water: "◒", internet: "◎", television: "▤", movies: "▷", games: "✣", giftCards: "◇", shopping: "□", food: "○", transport: "→", travel: "✦", hotels: "⌂", education: "△", otherBills: "≡", merchant: "▱", subscriptions: "↻" };

export function MakotoPay() {
  const { t } = usePreferences();
  const [comingSoon, setComingSoon] = useState<string>();
  const openerRef = useRef<HTMLButtonElement | null>(null);
  function openComingSoon(service: string, button: HTMLButtonElement) { openerRef.current = button; setComingSoon(service); }
  function closeComingSoon() { setComingSoon(undefined); window.setTimeout(() => openerRef.current?.focus(), 0); }

  return <main className={`${walletStyles.page} ${styles.page}`}><div className={styles.shell}>
    <AppHeader />
    <section className={styles.hero} aria-labelledby="pay-title"><div>
      <span className={styles.badge}>{t("pay.badge")}</span><p className={styles.eyebrow}>MAKOTO PAY</p>
      <h1 id="pay-title">{t("pay.heroTitle")}</h1><p className={styles.heroCopy}>{t("pay.heroCopy")}</p>
    </div><div className={styles.heroMark} aria-hidden="true"><span>USDC</span><i>→</i><strong>PAY</strong></div></section>
    <aside className={styles.notice} aria-label={t("pay.prototypeNoticeTitle")}><strong>{t("pay.prototypeNoticeTitle")}</strong><span>{t("pay.prototypeNotice")}</span></aside>
    <ServiceSection title={t("pay.popular")} entries={popular} t={t} onComingSoon={openComingSoon} featured />
    <ServiceSection title={t("pay.allServices")} entries={services} t={t} onComingSoon={openComingSoon} />
    <section className={styles.story}><p className={styles.eyebrow}>{t("pay.storyEyebrow")}</p><h2>{t("pay.storyTitle")}</h2><div><p>{t("pay.storyWallet")}</p><p>{t("pay.storyPay")}</p><p>{t("pay.storySavings")}</p></div></section>
  </div>{comingSoon && <ServiceComingSoonDialog service={comingSoon} onClose={closeComingSoon} />}</main>;
}

function ServiceSection({ title, entries, t, onComingSoon, featured = false }: { title: string; entries: readonly (typeof services)[number][]; t: ReturnType<typeof usePreferences>["t"]; onComingSoon(service: string, button: HTMLButtonElement): void; featured?: boolean }) {
  return <section className={styles.catalog} aria-labelledby={`services-${featured ? "popular" : "all"}`}><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>MAKOTO PAY</p><h2 id={`services-${featured ? "popular" : "all"}`}>{title}</h2></div><span>{featured ? t("pay.popularHint") : t("pay.catalogHint")}</span></div><div className={`${styles.serviceGrid} ${featured ? styles.popularGrid : ""}`}>{entries.map((id) => {
    const demo = id === "mobile"; const name = t(`pay.service.${id}` as Parameters<typeof t>[0]);
    return demo ? <Link key={id} href="/pay/mobile-topup" className={`${styles.serviceCard} ${styles.demoCard}`}><ServiceCardContent icon={icons[id]} name={name} description={t(`pay.service.${id}.description` as Parameters<typeof t>[0])} status={t("pay.demoAvailable")} /></Link>
      : <button key={id} type="button" className={styles.serviceCard} onClick={(event) => onComingSoon(name, event.currentTarget)}><ServiceCardContent icon={icons[id]} name={name} description={t(`pay.service.${id}.description` as Parameters<typeof t>[0])} status={t("pay.comingSoon")} /></button>;
  })}</div></section>;
}

function ServiceCardContent({ icon, name, description, status }: { icon: string; name: string; description: string; status: string }) { return <><span className={styles.serviceIcon} aria-hidden="true">{icon}</span><span className={styles.serviceText}><strong>{name}</strong><small>{description}</small></span><span className={styles.status}>{status}</span></>; }
