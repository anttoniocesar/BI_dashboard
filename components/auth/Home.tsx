"use client";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { useCurrentUser } from "./AuthSession";
import { UserMenu } from "./UserMenu";
import { areaDestinations, availableAreas } from "@/lib/auth/access";
import type { AuthArea } from "@/types/auth";

const areas: Record<AuthArea, { title: string; description: string }> = {
  learn: { title: "Ambiente do Aluno", description: "Estude os cursos liberados e acompanhe seu progresso." },
  studio: { title: "BI.Society Studio", description: "Organize cursos, capítulos e exercícios." },
  admin: { title: "Administração", description: "Gerencie usuários, matrículas e serviços." },
};
export function Home() {
  const user = useCurrentUser();
  const permitted = availableAreas(user);
  return <div className="auth-home"><header className="auth-topbar"><BrandLogo environment="BI.SOCIETY" /><UserMenu /></header><main><p className="auth-eyebrow">BEM-VINDO À BI.SOCIETY</p><h1>Meus ambientes</h1><p>Olá, {user?.name}. Escolha onde deseja continuar.</p><div className="auth-area-grid">{permitted.map(area => <Link className="auth-area-card" key={area} href={areaDestinations[area]}><h2>{areas[area].title}</h2><p>{areas[area].description}</p><span>Acessar →</span></Link>)}</div>{!permitted.length && <p>Nenhum ambiente disponível para os perfis atuais. Solicite a revisão do cadastro.</p>}</main></div>;
}
