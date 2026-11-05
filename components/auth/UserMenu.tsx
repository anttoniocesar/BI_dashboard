"use client";
import Link from "next/link";
import { useAuthSession } from "./AuthSession";
import { roleLabels } from "@/components/admin/AdminShared";

export function UserMenu() {
  const { currentUser, logout } = useAuthSession();
  if (!currentUser) return null;
  return <details className="auth-user-menu"><summary>Minha conta</summary><div className="auth-user-popover"><strong>{currentUser.name}</strong><p>{currentUser.roles.map(role => roleLabels[role]).join(", ")}</p><Link href="/home" onClick={event => event.currentTarget.closest("details")?.removeAttribute("open")}>Meus ambientes</Link><button type="button" onClick={logout}>Sair</button></div></details>;
}
