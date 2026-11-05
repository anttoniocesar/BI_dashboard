import Link from "next/link";
import { StudioImportLink } from "@/components/navigation/StudioImportLink";
import { BrandLogo } from "@/components/brand/BrandLogo";
import "./courses.css";

export const metadata = { title: "Cursos | BI.Society Studio" };
export default function CoursesLayout({ children }: { children: React.ReactNode }) {
  return <div className="studio-shell course-shell"><header className="course-topbar"><Link href="/studio/courses" className="course-brand"><BrandLogo environment="Studio" /></Link><span>Ambiente do professor</span><nav aria-label="Navegação do Studio"><Link href="/studio/courses">Meus cursos</Link><Link href="/studio/monitoring">Acompanhamento</Link><StudioImportLink>Importar Excel</StudioImportLink><Link href="/">Lab</Link><Link href="/home">Meus ambientes</Link></nav></header>
    <main className="course-main">{children}</main><footer className="course-footer">Cursos e exercícios salvos ficam disponíveis para continuar depois. Aguarde Salvo antes de sair. Publique o curso e libere acesso pelo Admin para disponibilizá-lo ao aluno.</footer></div>;
}
