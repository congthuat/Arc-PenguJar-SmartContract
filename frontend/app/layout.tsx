import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Manrope, Sora } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-body" });
const sora = Sora({ subsets: ["latin"], variable: "--font-display" });

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await cookies()).get("pengujar_locale")?.value === "vi" ? "vi" : "en";
  const title = locale === "vi" ? "Makoto Wallet — Ví đơn giản cho Arc" : "Makoto Wallet — Simple wallet for Arc";
  const description = locale === "vi"
    ? "Gửi, nhận và quản lý USDC trên Arc, với PenguJar cho các mục tiêu tiết kiệm."
    : "Send, receive, and manage USDC on Arc, with PenguJar for goal-based savings.";
  const socialDescription = locale === "vi" ? "Trải nghiệm ví đơn giản cho Arc." : "Simple wallet experience for Arc.";
  return {
    title,
    description,
    applicationName: "Makoto Wallet",
    icons: { icon: "/makoto/logo.png", apple: "/makoto/logo.png" },
    openGraph: { type: "website", siteName: "Makoto Wallet", title: "Makoto Wallet", description: socialDescription },
    twitter: { card: "summary", title: "Makoto Wallet", description: socialDescription },
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const locale = cookieStore.get("pengujar_locale")?.value === "vi" ? "vi" : "en";
  const rawTheme = cookieStore.get("pengujar_theme")?.value;
  const theme = rawTheme === "light" || rawTheme === "dark" ? rawTheme : "system";
  return (
    <html lang={locale} data-theme={theme}>
      <body className={`${manrope.variable} ${sora.variable}`}>
        <Providers initialLocale={locale} initialTheme={theme}>{children}</Providers>
      </body>
    </html>
  );
}
