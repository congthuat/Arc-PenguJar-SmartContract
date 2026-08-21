"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { usePreferences } from "@/hooks/usePreferences";
import { HOME_PAY_SERVICE_IDS, PAY_SERVICE_ART, type PayServiceId } from "@/lib/makotoPayCatalog";
import { ServiceComingSoonDialog } from "./ServiceComingSoonDialog";
import styles from "./MakotoWallet.module.css";

export function MakotoPayHomeSection() {
  const { t } = usePreferences();
  const [comingSoon, setComingSoon] = useState<string>();
  const openerRef = useRef<HTMLButtonElement | null>(null);
  function close() { setComingSoon(undefined); window.setTimeout(() => openerRef.current?.focus(), 0); }
  return <section className={styles.payHome} aria-labelledby="home-pay-title">
    <header className={styles.payHomeHeader}><div><span>{t("pay.badge")}</span><p>MAKOTO PAY</p><h2 id="home-pay-title">{t("pay.homeTitle")}</h2><small>{t("pay.homeCopy")}</small></div><Link href="/pay">{t("pay.viewAll")} <b aria-hidden="true">→</b></Link></header>
    <div className={styles.payHomeGrid}>{HOME_PAY_SERVICE_IDS.map((id) => id === "mobile" ? <Link key={id} href="/pay/mobile-topup" className={styles.payShortcut}><Shortcut id={id} t={t} /></Link> : <button key={id} type="button" className={styles.payShortcut} onClick={(event) => { openerRef.current = event.currentTarget; setComingSoon(t(`pay.service.${id}` as Parameters<typeof t>[0])); }}><Shortcut id={id} t={t} /></button>)}</div>
    {comingSoon && <ServiceComingSoonDialog service={comingSoon} onClose={close} />}
  </section>;
}

function Shortcut({ id, t }: { id: PayServiceId; t: ReturnType<typeof usePreferences>["t"] }) { return <><span className={styles.payShortcutArt}><Image src={PAY_SERVICE_ART[id]} alt="" width={88} height={88} /></span><strong>{t(`pay.service.${id}` as Parameters<typeof t>[0])}</strong><small>{id === "mobile" ? t("pay.demoAvailable") : t("pay.comingSoon")}</small></>; }
