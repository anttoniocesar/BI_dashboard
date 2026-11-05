"use client";
import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthSession } from "./AuthSession";
import { useAdminSession } from "@/components/admin/AdminSession";
import { canEnterArea, requireCourseAccess, routeTarget } from "@/lib/auth/access";

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { ready, currentUser, session, loggedOut, error, retry } = useAuthSession();
  const { state } = useAdminSession();
  const target = routeTarget(pathname);
  const protectedRoute = !!target || pathname === "/home" || pathname === "/unauthorized";
  const areaDenied = !!target && !!currentUser && !canEnterArea(currentUser, target.area);
  const courseDenied = !!target?.courseId && !!currentUser && !requireCourseAccess(state, currentUser, target.courseId);
  useEffect(() => {
    if (!ready || !protectedRoute || error) return;
    if (!currentUser) router.replace(loggedOut || session ? "/login" : `/login?returnTo=${encodeURIComponent(pathname + window.location.search)}`);
    else if (areaDenied) router.replace(`/unauthorized?area=${target?.area}`);
  }, [ready, protectedRoute, currentUser, areaDenied, pathname, router, target?.area, session, loggedOut, error]);
  if (!protectedRoute) return children;
  if (error) return <main className="auth-screen"><section className="auth-card"><h1>Dados indisponíveis</h1><p role="alert">{error}</p><button className="auth-primary" onClick={retry}>Tentar novamente</button></section></main>;
  if (!ready || !currentUser || areaDenied) return <main className="auth-loading" role="status">Carregando sessão...</main>;
  if (courseDenied) return <main className="auth-screen"><section className="auth-card"><h1>Acesso não autorizado</h1><p>Este curso não está liberado para o usuário autenticado.</p><Link className="auth-primary" href="/learn">Voltar aos cursos</Link><Link href="/home">Meus ambientes</Link></section></main>;
  return children;
}
