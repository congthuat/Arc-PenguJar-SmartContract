"use client";

import { useState, type ReactNode } from "react";
import { useConnection } from "wagmi";
import { arcTestnet } from "viem/chains";
import { AppHeader } from "./AppHeader";
import { usePreferences } from "@/hooks/usePreferences";
import { useVerifiedWalletChain } from "@/hooks/useVerifiedWalletChain";
import { SUPPORTED_ASSETS } from "@/lib/assets";
import { ARC_EXPLORER_URL } from "@/lib/config";
import { shortAddress } from "@/lib/format";
import styles from "./MakotoWallet.module.css";

export function SettingsPage() {
  const { locale, setLocale, theme, setTheme, resetPreferences } = usePreferences();
  const connection = useConnection();
  const chain = useVerifiedWalletChain();
  const [copied, setCopied] = useState(false);
  const vi = locale === "vi";
  async function copyAddress() { if (!connection.address) return; await navigator.clipboard.writeText(connection.address); setCopied(true); window.setTimeout(() => setCopied(false), 1600); }
  return <main className={styles.page}><div className={styles.shell}>
    <AppHeader />
    <section className={styles.settingsHero}><p>{vi ? "TÙY CHỈNH MAKOTO" : "YOUR MAKOTO"}</p><h1>{vi ? "Cài đặt" : "Settings"}</h1><span>{vi ? "Tùy chỉnh giao diện và xem thông tin an toàn về mạng, tài sản và ví của bạn." : "Personalize the interface and review safe network, asset, and wallet information."}</span></section>
    <div className={styles.settingsGrid}>
      <SettingsCard title={vi ? "Giao diện" : "Appearance"}><ChoiceGroup label={vi ? "Chủ đề" : "Theme"} value={theme} onChange={setTheme} options={[["system", vi ? "Hệ thống" : "System"], ["light", vi ? "Sáng" : "Light"], ["dark", vi ? "Tối" : "Dark"]]} /></SettingsCard>
      <SettingsCard title={vi ? "Ngôn ngữ" : "Language"}><ChoiceGroup label={vi ? "Ngôn ngữ hiển thị" : "Display language"} value={locale} onChange={setLocale} options={[["en", "English"], ["vi", "Tiếng Việt"]]} /></SettingsCard>
      <SettingsCard title={vi ? "Mạng" : "Network"}><InfoRow label={vi ? "Mạng" : "Network"} value="Arc Testnet" /><InfoRow label="Chain ID" value={String(arcTestnet.id)} /><InfoRow label={vi ? "Token gas" : "Gas token"} value="USDC" /><a className={styles.settingsLink} href={ARC_EXPLORER_URL} target="_blank" rel="noreferrer">ArcScan ↗</a></SettingsCard>
      <SettingsCard title={vi ? "Tài sản hỗ trợ" : "Supported assets"}>{SUPPORTED_ASSETS.map((asset) => <div className={styles.settingsAsset} key={asset.id}><span><strong>{asset.symbol}</strong><small>{shortAddress(asset.address)}</small></span><a href={`${ARC_EXPLORER_URL}/address/${asset.address}`} target="_blank" rel="noreferrer">ArcScan ↗</a></div>)}</SettingsCard>
      <SettingsCard title={vi ? "Ví đang kết nối" : "Connected wallet"}>{connection.isConnected && connection.address ? <><InfoRow label={vi ? "Địa chỉ" : "Address"} value={shortAddress(connection.address)} /><InfoRow label={vi ? "Trạng thái mạng" : "Verified network"} value={chain.isArc ? "Arc Testnet ✓" : (vi ? "Sai mạng" : "Wrong network")} /><div className={styles.settingsActions}><button type="button" onClick={() => void copyAddress()}>{copied ? (vi ? "Đã sao chép" : "Copied") : (vi ? "Sao chép địa chỉ" : "Copy address")}</button><a href={`${ARC_EXPLORER_URL}/address/${connection.address}`} target="_blank" rel="noreferrer">{vi ? "Xem trên ArcScan" : "View on ArcScan"} ↗</a></div></> : <p className={styles.settingsMuted}>{vi ? "Kết nối ví từ thanh điều hướng để xem địa chỉ và trạng thái mạng." : "Connect from the header to view your address and verified network state."}</p>}</SettingsCard>
      <SettingsCard title={vi ? "Bảo mật / Thử nghiệm" : "Security / Beta"} wide><ul className={styles.settingsDisclosure}><li>{vi ? "Makoto không lưu ký và không bao giờ lưu khóa riêng của bạn." : "Makoto is non-custodial and never stores your private key."}</li><li>{vi ? "Bạn ký mọi giao dịch trong ví đang kết nối." : "You sign every transaction in your connected wallet."}</li><li>{vi ? "Đây là bản thử nghiệm trên Arc Testnet; tài sản testnet không có giá trị thực dự kiến." : "This is an Arc Testnet Public Beta; testnet assets have no intended real-world monetary value."}</li><li>{vi ? "PenguJar chưa được kiểm toán bảo mật chuyên nghiệp độc lập." : "PenguJar has not had an independent professional security audit."}</li></ul></SettingsCard>
    </div>
    <section className={styles.settingsReset}><div><strong>{vi ? "Đặt lại tùy chọn giao diện" : "Reset interface preferences"}</strong><p>{vi ? "Chỉ đặt lại ngôn ngữ và giao diện. Không ngắt kết nối ví hoặc thay đổi dữ liệu blockchain." : "Resets only language and theme. It does not disconnect your wallet or change blockchain data."}</p></div><button type="button" onClick={resetPreferences}>{vi ? "Đặt lại" : "Reset"}</button></section>
  </div></main>;
}

function SettingsCard({ title, children, wide = false }: { title: string; children: ReactNode; wide?: boolean }) { return <section className={`${styles.settingsCard} ${wide ? styles.settingsWide : ""}`}><h2>{title}</h2>{children}</section>; }
function InfoRow({ label, value }: { label: string; value: string }) { return <div className={styles.settingsInfo}><span>{label}</span><strong>{value}</strong></div>; }
function ChoiceGroup<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange(value: T): void; options: readonly (readonly [T, string])[] }) { return <fieldset className={styles.settingsChoices}><legend>{label}</legend>{options.map(([option, text]) => <label key={option}><input type="radio" name={label} value={option} checked={value === option} onChange={() => onChange(option)} /><span>{text}</span></label>)}</fieldset>; }
