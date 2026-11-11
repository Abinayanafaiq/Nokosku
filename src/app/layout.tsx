import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, Bricolage_Grotesque } from "next/font/google";
import { BottomNav } from "@/components/BottomNav";
import { SiteHeader } from "@/components/SiteHeader";
import { getUser, isAdmin } from "@/lib/auth";
import { config } from "@/lib/config";
import "./globals.css";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-bricolage" });
const atkinson = Atkinson_Hyperlegible({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-atkinson" });

export const metadata: Metadata = {
  title: { default: `${config.siteName} — Nomor virtual untuk OTP`, template: `%s · ${config.siteName}` },
  description: "Beli nomor virtual untuk menerima kode OTP WhatsApp, Telegram, Shopee, dan ratusan layanan lain. Saldo kembali kalau SMS tidak masuk.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1f3f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1424" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser().catch(() => null);
  return (
    <html lang="id" className={`${bricolage.variable} ${atkinson.variable}`}>
      <body className="min-h-dvh antialiased">
        <SiteHeader user={user ? { name: user.name, balance: user.balance } : null} admin={isAdmin(user)} siteName={config.siteName} />
        <main className={user ? "pb-24 md:pb-10" : "pb-10"}>{children}</main>
        {user && <BottomNav admin={isAdmin(user)} />}
      </body>
    </html>
  );
}
