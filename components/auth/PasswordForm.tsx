"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { dataRequest } from "@/lib/data/http";
import { BrandLogo } from "@/components/brand/BrandLogo";
export function PasswordForm({ update = false }: { update?: boolean }) {
  const [tokenHash, setTokenHash] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(location.hash.slice(1) || location.search);
    setTokenHash(params.get("type") === "recovery" ? params.get("token_hash") ?? "" : "");
    if (update) history.replaceState(null, "", location.pathname);
  }, [update]);
  return <main className="auth-screen"><section className="auth-card auth-login"><BrandLogo environment="ACADEMY" /><h1>{update ? "Definir nova senha" : "Recuperar senha"}</h1>
    {update && !tokenHash && <p role="alert">Link inválido ou expirado. Solicite outro link de recuperação.</p>}
    {!done && (!update || tokenHash) && <form onSubmit={async event => {
      event.preventDefault(); if (pending) return; const data = new FormData(event.currentTarget);
      if (update && data.get("password") !== data.get("confirmation")) { setError("As senhas devem ser iguais."); return; }
      setPending(true); setError("");
      try { const result = await dataRequest<{ message: string }>("/api/auth/password", update ? { operation: "update", tokenHash, password: String(data.get("password")) } : { operation: "request", email: String(data.get("email")) }); setMessage(result.message); setDone(true); }
      catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível concluir. Tente novamente."); }
      finally { setPending(false); }
    }}>
      {update ? <><label htmlFor="new-password">Nova senha</label><input id="new-password" name="password" type="password" minLength={12} maxLength={256} autoComplete="new-password" required /><label htmlFor="confirm-password">Confirmar senha</label><input id="confirm-password" name="confirmation" type="password" minLength={12} maxLength={256} autoComplete="new-password" required /></> : <><label htmlFor="recovery-email">Email cadastrado</label><input id="recovery-email" name="email" type="email" autoComplete="email" required maxLength={254} /></>}
      <button className="auth-primary" disabled={pending}>{pending ? "Enviando..." : update ? "Definir senha" : "Enviar instruções"}</button>
    </form>}
    {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
    <p><Link href="/login">Voltar ao login</Link></p>{update && <p><Link href="/auth/forgot-password">Solicitar outro link</Link></p>}
  </section></main>;
}
