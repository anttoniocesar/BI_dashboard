"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { useAdminWorkspace } from "./useAdminWorkspace";
import { UserMenu } from "@/components/auth/UserMenu";
import { canEnterArea } from "@/lib/auth/access";

const navigation = [["/admin", "Painel"], ["/admin/users", "Usuários"], ["/admin/enrollments", "Matrículas"], ["/admin/services", "Serviços"]];
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { state, actorId, configuration, storageNotice } = useAdminWorkspace();
  const actor = state.users.find(user => user.id === actorId);
  return <div className="admin-shell">
    <a className="admin-skip" href="#admin-main">Ir ao conteúdo</a>
    <aside className="admin-sidebar">
      <Link className="admin-brand" href="/admin"><BrandLogo environment="ADMIN" /></Link>
      <p className="admin-eyebrow">GESTÃO ACADÊMICA</p>
      <nav aria-label="Administração">{navigation.map(([href, label]) => <Link key={href} href={href} aria-current={(href === "/admin" ? pathname === href : pathname.startsWith(href)) ? "page" : undefined}>{label}</Link>)}</nav>
      <div className="admin-sidebar-links">{canEnterArea(actor ?? null, "studio") && <Link href="/studio/courses">Abrir Studio</Link>}{canEnterArea(actor ?? null, "learn") && <Link href="/learn">Ambiente do aluno</Link>}<Link href="/home">Meus ambientes</Link></div>
    </aside>
    <div className="admin-workspace"><header className="admin-topbar"><span>BI.Society · Administração</span><span>{actor?.name} · Administrador</span><UserMenu /></header>
      <main id="admin-main" tabIndex={-1}>{storageNotice && <p role="status">{storageNotice}</p>}{children}</main>
      <footer className="admin-footer">{configuration.mode === "demo" ? "Dados administrativos salvos neste navegador. localStorage demo não é backend nem segurança real. Autenticação local demonstrativa." : "Dados administrativos persistentes. Cursos em autoria no Studio continuam temporários nesta etapa."}</footer>
    </div>
  </div>;
}
