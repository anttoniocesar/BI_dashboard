import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import "./monitoring.css";
export const metadata = { title:"Acompanhamento | BI.Society Studio" };
export default function MonitoringLayout({ children }: { children:React.ReactNode }) {
  return <div className="monitoring-shell"><a className="monitoring-skip" href="#monitoring-main">Ir para o acompanhamento</a><header><Link href="/studio/courses"><BrandLogo environment="Studio" /></Link><nav aria-label="Navegação do acompanhamento"><Link href="/studio/courses">Meus cursos</Link><Link href="/studio/monitoring" aria-current="page">Acompanhamento</Link><Link href="/home">Meus ambientes</Link></nav></header><main id="monitoring-main">{children}</main></div>;
}
