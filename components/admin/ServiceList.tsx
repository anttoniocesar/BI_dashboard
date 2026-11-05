"use client";
import Link from "next/link";
import { useAdminWorkspace } from "./useAdminWorkspace";
import { Status } from "./AdminShared";

export function ServiceList() {
  const { state, courses } = useAdminWorkspace();
  return <><div className="admin-page-heading"><div><p className="admin-eyebrow">SERVIÇOS EDUCACIONAIS</p><h1>Serviços</h1><p>Oferta e vínculos de Curso Avulso.</p></div><Link className="admin-button primary" href="/admin/users">Atribuir a um usuário</Link></div>{state.services.map(service => <section className="admin-panel" key={service.id}><h2>{service.title}</h2><p>{state.userServices.filter(item => item.serviceId === service.id).length} vínculos nesta sessão</p><div className="admin-table-wrap"><table><caption>Vínculos de {service.title}</caption><thead><tr><th scope="col">Usuário</th><th scope="col">Status do vínculo</th><th scope="col">Cursos relacionados</th><th scope="col">Ações</th></tr></thead><tbody>{state.userServices.filter(item => item.serviceId === service.id).map(link => <tr key={link.id}><th scope="row">{state.users.find(user => user.id === link.userId)?.name}</th><td><Status value={link.status} /></td><td>{state.courseAccess.filter(item => item.userServiceId === link.id).map(item => courses.find(course => course.id === item.courseId)?.title ?? "Curso indisponível").join(", ") || "Sem curso"}</td><td><Link href={`/admin/users/${link.userId}`}>Gerenciar vínculo</Link></td></tr>)}</tbody></table></div></section>)}</>;
}
