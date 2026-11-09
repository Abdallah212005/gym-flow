import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-ibm-plex-sans-arabic",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "GymFlow | إدارة ناديك بسهولة",
  description: "لوحة تحكم GymFlow لإدارة الأعضاء والاشتراكات والحضور.",
};

export const instant = false;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl">
      <body className={ibmPlexSansArabic.variable}><AppShell>{children}</AppShell></body>
    </html>
  );
}
