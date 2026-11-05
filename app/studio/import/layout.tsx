import type { Metadata } from "next";
import { BrandLogo } from "@/components/brand/BrandLogo";
import Link from "next/link";

export const metadata: Metadata = { title: "Importar Excel | BI.Society Studio", description: "Análise e revisão de planilhas Excel no BI.Society Studio." };
export default function ImportLayout({ children }: { children: React.ReactNode }) {
  return <div className="studio-shell">
    <header className="lab-header studio-header"><Link href="/studio/courses"><BrandLogo environment="Studio" /></Link><span className="studio-professor-label">AMBIENTE DO PROFESSOR</span></header>
    <main className="studio-main">{children}</main>
  </div>;
}
