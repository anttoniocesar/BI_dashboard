"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthSession } from "./AuthSession";

export function Unauthorized() {
  const { logout } = useAuthSession();
  const [area, setArea] = useState("Ambiente protegido");
  useEffect(() => { const requested = new URLSearchParams(window.location.search).get("area"); setArea(requested === "admin" ? "Administração" : requested === "studio" ? "BI.Society Studio" : requested === "learn" ? "Ambiente do Aluno" : "Ambiente protegido"); }, []);
  return <main className="auth-screen"><section className="auth-card"><p className="auth-eyebrow">{area}</p><h1>Acesso não autorizado</h1><p>Seus perfis atuais não permitem acessar este ambiente.</p><Link className="auth-primary" href="/home">Meus ambientes</Link><button className="auth-secondary" onClick={logout}>Sair</button></section></main>;
}
