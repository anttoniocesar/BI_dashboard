"use client";
import Link from "next/link";
import { useAdminWorkspace } from "./useAdminWorkspace";
import { Status } from "./AdminShared";

export function EnrollmentList() {
  const { state, courses } = useAdminWorkspace();
  return <><div className="admin-page-heading"><div><p className="admin-eyebrow">VÍNCULOS EDUCACIONAIS</p><h1>Matrículas</h1><p>Serviços e cursos relacionados a cada matrícula.</p></div><Link className="admin-button primary" href="/admin/users">Gerenciar usuários</Link></div><section className="admin-panel"><div className="admin-table-wrap"><table><caption>Matrículas da sessão</caption><thead><tr>{["Matrícula", "Usuário", "Status", "Serviço", "Curso"].map(title => <th scope="col" key={title}>{title}</th>)}</tr></thead><tbody>{state.enrollments.map(enrollment => {
    const user = state.users.find(item => item.id === enrollment.userId);
    const links = state.userServices.filter(item => item.userId === enrollment.userId);
    const access = state.courseAccess.filter(item => links.some(link => link.id === item.userServiceId));
    return <tr key={enrollment.id}><th scope="row">{enrollment.registrationCode}</th><td><Link href={`/admin/users/${enrollment.userId}`}>{user?.name ?? "Usuário indisponível"}</Link></td><td><Status value={enrollment.status} /></td><td>{links.map(link => `${state.services.find(item => item.id === link.serviceId)?.title} (${link.status === "active" ? "Ativo" : "Inativo"})`).join(", ") || "Sem serviço"}</td><td>{[...new Set(access.map(item => item.courseId))].map(id => courses.find(course => course.id === id)?.title ?? "Curso indisponível").join(", ") || "Sem curso"}</td></tr>;
  })}</tbody></table></div></section></>;
}
