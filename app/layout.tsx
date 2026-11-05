import type { Metadata } from "next";
import "./globals.css";
import { StudioSessionProvider } from "@/components/studio/StudioSession";
import { LearnSessionProvider } from "@/components/learn/LearnSession";
import { AdminSessionProvider } from "@/components/admin/AdminSession";
import { AuthSessionProvider } from "@/components/auth/AuthSession";
import { RouteGuard } from "@/components/auth/RouteGuard";
import "./auth.css";
import { DataModeIndicator } from "@/components/auth/DataModeIndicator";
import { StudioPersistence } from "@/components/studio/StudioPersistence";

export const metadata: Metadata = {
  title: "BI.Society Lab",
  description: "Laboratório interativo de exercícios em planilhas BI.Society",
  icons: { icon: "/images/brand/bi-society-logo.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body><StudioSessionProvider><AdminSessionProvider><AuthSessionProvider><LearnSessionProvider><StudioPersistence><RouteGuard>{children}</RouteGuard><DataModeIndicator /></StudioPersistence></LearnSessionProvider></AuthSessionProvider></AdminSessionProvider></StudioSessionProvider></body></html>;
}
