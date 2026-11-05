"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAdminWorkspace } from "./useAdminWorkspace";
import { RolesField, StatusField, useAdminFeedback } from "./AdminShared";
import type { AdminStatus, Role } from "@/types/admin";

export function NewUser() {
  const { execute } = useAdminWorkspace();
  const router = useRouter();
  const { run, feedback } = useAdminFeedback();
  return <><div className="admin-page-heading"><div><p className="admin-eyebrow">PESSOAS</p><h1>Criar usuário</h1><p>Cadastre os dados e escolha um ou mais perfis. A matrícula é gerada depois.</p></div></div>
    <form className="admin-panel admin-form" onSubmit={event => {
      event.preventDefault(); const data = new FormData(event.currentTarget);
      run(async () => { const id = `user-${crypto.randomUUID()}`; const result = await execute({ type: "create-user", id, name: String(data.get("name") ?? ""), email: String(data.get("email") ?? ""), roles: data.getAll("roles") as Role[], status: data.get("status") as AdminStatus, createdAt: new Date().toISOString() }); router.push(`/admin/users/${result.userId ?? id}`); }, "Usuário criado.");
    }}><label>Nome<input name="name" required autoComplete="name" maxLength={160} /></label><label>Email<input name="email" type="email" required autoComplete="email" maxLength={254} /></label><RolesField /><StatusField />{feedback}<div className="admin-actions"><button className="admin-button primary" type="submit">Criar usuário</button><Link href="/admin/users">Cancelar</Link></div></form></>;
}
