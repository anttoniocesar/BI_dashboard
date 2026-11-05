"use client";
import { useState } from "react";
import type { AdminStatus, Role } from "@/types/admin";

export const roleLabels: Record<Role, string> = { student: "Aluno", teacher: "Professor", admin: "Administrador" };
export function Status({ value }: { value: AdminStatus }) {
  return <span className={`admin-status ${value}`}>{value === "active" ? "Ativo" : "Inativo"}</span>;
}
export function StatusField({ value = "active", label = "Status" }: { value?: AdminStatus; label?: string }) {
  return <label>{label}<select name="status" defaultValue={value}><option value="active">Ativo</option><option value="inactive">Inativo</option></select></label>;
}
export function RolesField({ roles = [] }: { roles?: Role[] }) {
  return <fieldset><legend>Perfis</legend><div className="admin-roles">{(Object.keys(roleLabels) as Role[]).map(role => <label key={role}><input type="checkbox" name="roles" value={role} defaultChecked={roles.includes(role)} />{roleLabels[role]}</label>)}</div></fieldset>;
}
export function useAdminFeedback() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function run(action: () => unknown | Promise<unknown>, success: string) {
    if (pending) return;
    setPending(true);
    try { await action(); setError(""); setMessage(success); }
    catch (cause) { setMessage(""); setError(cause instanceof Error ? cause.message : "Não foi possível concluir a operação."); }
    finally { setPending(false); }
  }
  return { run, feedback: <div className="admin-feedback" aria-busy={pending}><p role="status">{pending ? "Salvando..." : message}</p>{error && <p role="alert">{error}</p>}</div> };
}
