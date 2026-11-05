"use client";
import Link from "next/link";
import { useAdminWorkspace } from "./useAdminWorkspace";
import { roleLabels, Status } from "./AdminShared";

export function UserList() {
  const { state } = useAdminWorkspace();
  return <><div className="admin-page-heading"><div><p className="admin-eyebrow">PESSOAS</p><h1>Usuários</h1><p>Perfis e vínculos da sessão administrativa.</p></div><Link className="admin-button primary" href="/admin/users/new">Criar usuário</Link></div>
    <section className="admin-panel"><div className="admin-table-wrap"><table><caption>Usuários cadastrados</caption><thead><tr>{["Nome", "Email", "Matrícula", "Perfis", "Status", "Serviços", "Ações"].map(title => <th scope="col" key={title}>{title}</th>)}</tr></thead><tbody>{state.users.map(user => <tr key={user.id}>
      <th scope="row">{user.name}</th><td>{user.email}</td><td>{state.enrollments.find(item => item.userId === user.id)?.registrationCode ?? "Sem matrícula"}</td><td>{user.roles.map(role => roleLabels[role]).join(", ")}</td><td><Status value={user.status} /></td><td>{state.userServices.filter(item => item.userId === user.id).map(link => `${state.services.find(item => item.id === link.serviceId)?.title ?? "Serviço indisponível"} (${link.status === "active" ? "Ativo" : "Inativo"})`).join(", ") || "Sem serviços"}</td><td><Link href={`/admin/users/${user.id}`} aria-label={`Ver detalhes de ${user.name}`}>Ver detalhes</Link></td>
    </tr>)}</tbody></table></div></section></>;
}
