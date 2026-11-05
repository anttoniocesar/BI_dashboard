"use client";
import {CourseVersionActions} from "@/components/studio/courses/CourseVersions";
import Link from "next/link";
import { useState } from "react";
import { useAdminWorkspace } from "./useAdminWorkspace";
import { hasRole } from "@/lib/admin/permissions";
import { useCurrentUser } from "@/components/auth/AuthSession";
import { requireCourseAccess } from "@/lib/auth/access";

export function AdminDashboard() {
  const { state, courses, configuration, resetDemo } = useAdminWorkspace();
  const [resetting, setResetting] = useState(false), [resetMessage, setResetMessage] = useState("");
  const user = useCurrentUser();
  const cards = [
    { label: "Usuários", value: state.users.length, href: "/admin/users" },
    { label: "Alunos", value: state.users.filter(user => hasRole(user, "student")).length, href: "/admin/users" },
    { label: "Professores", value: state.users.filter(user => hasRole(user, "teacher")).length, href: "/admin/users" },
    { label: "Cursos", value: courses.length, href: "#admin-courses" },
    { label: "Matrículas ativas", value: state.enrollments.filter(item => item.status === "active").length, href: "/admin/enrollments" },
  ];
  return <><div className="admin-page-heading"><div><p className="admin-eyebrow">VISÃO DA SESSÃO</p><h1>Painel Administrativo</h1><p>Gerencie pessoas e vínculos educacionais.</p></div><Link className="admin-button primary" href="/admin/users/new">Criar usuário</Link></div>
    <div className="admin-metrics">{cards.map(card => <Link href={card.href} className="admin-metric" key={card.label}><span>{card.label}</span><strong>{card.value}</strong><small>{card.label === "Alunos" || card.label === "Professores" ? "Com perfil ativo" : "Nesta sessão"}</small></Link>)}</div>
    <section className="admin-panel" id="admin-courses"><h2>Cursos da sessão</h2><p>Catálogo compartilhado com o Studio e o ambiente do aluno.</p><div className="admin-table-wrap"><table><caption>Cursos e professores responsáveis</caption><thead><tr><th scope="col">Curso</th><th scope="col">Capítulos</th><th scope="col">Professor responsável</th><th scope="col">Ações</th></tr></thead><tbody>{courses.map(course => <tr key={course.id}><th scope="row">{course.title}</th><td>{course.chapters.length}</td><td>{state.courseTeachers.filter(item => item.courseId === course.id).flatMap(item => { const user = state.users.find(user => user.id === item.userId && hasRole(user, "teacher")); return user ? [user.name] : []; }).join(", ") || "Não associado"}</td><td>{requireCourseAccess(state, user, course.id) ? <Link href={`/learn/${course.id}`}>Ver curso</Link> : "Requer acesso como aluno"}{course.status==="published"&&<CourseVersionActions course={course} navigate={false}/>}</td></tr>)}</tbody></table></div></section>
    {configuration.mode === "demo" && <section className="admin-panel"><h2>Ambiente de demonstração</h2>
      <p>Dados administrativos ficam salvos neste navegador. localStorage demo não é backend nem segurança real.</p>
      <button className="admin-button" disabled={resetting} onClick={async () => {
        if (!window.confirm("Restaurar dados administrativos de demonstração? Usuários e vínculos locais voltarão às fixtures originais. Cursos salvos no Studio e respostas do Lab serão preservados.")) return;
        setResetting(true); setResetMessage("");
        try { await resetDemo(); setResetMessage("Dados administrativos de demonstração restaurados."); }
        catch (cause) { setResetMessage(cause instanceof Error ? cause.message : "Não foi possível restaurar a demonstração."); }
        finally { setResetting(false); }
      }}>Restaurar dados de demonstração</button>
      {resetMessage && <p role="status">{resetMessage}</p>}
    </section>}
  </>;
}
