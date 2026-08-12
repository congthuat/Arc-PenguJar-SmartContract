import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Manrope, Sora } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-body" });
const sora = Sora({ subsets: ["latin"], variable: "--font-display" });

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await cookies()).get("pengujar_locale")?.value === "vi" ? "vi" : "en";
  const title = locale === "vi" ? "PenguJar — Tiết kiệm có mục tiêu trên Arc" : "PenguJar — Save with purpose on Arc";
  const description = locale === "vi"
    ? "Tạo mục tiêu tiết kiệm USDC, mời mọi người đóng góp và mở khóa tiền theo kế hoạch với PenguJar trên Arc."
    : "Create USDC savings goals, invite contributions, and unlock funds on your schedule with PenguJar on Arc.";
  const socialDescription = locale === "vi" ? "Tiết kiệm có mục tiêu trên Arc." : "Save with purpose on Arc.";
  return {
    title,
    description,
    applicationName: "PenguJar",
    openGraph: { type: "website", siteName: "PenguJar", title: "PenguJar", description: socialDescription },
    twitter: { card: "summary", title: "PenguJar", description: socialDescription },
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
