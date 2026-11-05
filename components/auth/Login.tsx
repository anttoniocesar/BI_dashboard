"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { useAdminSession } from "@/components/admin/AdminSession";
import { useAuthSession } from "./AuthSession";
import { authorizedDestination } from "@/lib/auth/access";

export function Login() {
  const { ready, currentUser, login, storageNotice, error: sessionError, retry } = useAuthSession();
  const { state, configuration } = useAdminSession();
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  useEffect(() => {
    if (ready && currentUser) router.replace(authorizedDestination(state, currentUser, new URLSearchParams(window.location.search).get("returnTo")));
  }, [ready, currentUser, router, state]);
  if (sessionError) return <main className="auth-screen"><section className="auth-card"><h1>Sessão indisponível</h1><p role="alert">{sessionError}</p><button className="auth-primary" onClick={retry}>Tentar novamente</button></section></main>;
  if (!ready || currentUser) return <main className="auth-loading" role="status">Carregando sessão...</main>;
  return <main className="auth-screen"><section className="auth-card auth-login"><BrandLogo environment="ACADEMY" /><p className="auth-eyebrow">CONHECIMENTO APLICADO</p><h1>Entre na BI.Society</h1><p>Acesse seus cursos e ambientes de trabalho.</p>
    <form onSubmit={async event => { event.preventDefault(); if (pending) return; const data = new FormData(event.currentTarget); setPending(true); try { await login(String(data.get("identifier") ?? ""), String(data.get("password") ?? "")); setError(""); } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível entrar."); } finally { setPending(false); } }}>
      <label htmlFor="login-identifier">Matrícula ou email</label><input id="login-identifier" name="identifier" autoComplete="username" autoCapitalize="none" spellCheck={false} required />
      <label htmlFor="login-password">Senha</label><input id="login-password" name="password" type="password" autoComplete="current-password" required />
      {error && <p role="alert">{error}</p>}<button className="auth-primary" type="submit" disabled={pending}>{pending ? "Entrando..." : "Entrar"}</button>
    </form>
    {configuration.mode === "supabase" && <p><Link href="/auth/forgot-password">Esqueci minha senha</Link></p>}
    {storageNotice && <p role="status">{storageNotice}</p>}
    <p className="auth-demo-note">{configuration.mode === "demo" ? "Ambiente de demonstração local. Utilize as credenciais de desenvolvimento documentadas." : "Entre com sua matrícula ou email cadastrado e sua senha."}</p>
  </section></main>;
}
