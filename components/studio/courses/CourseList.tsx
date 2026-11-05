"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useStudioSession } from "../StudioSession";
import { useAdminSession } from "@/components/admin/AdminSession";
import { useCurrentUser } from "@/components/auth/AuthSession";
import { canEditCourse } from "@/lib/courses/authoring";
import { ExerciseLibrary } from "./ExerciseLibrary";
import {courseFamilies,courseVersion,latestPublished,courseFamilyId} from "@/lib/courses/versions";

const labels = {draft:"Rascunho",published:"Publicado",archived:"Arquivado"};
export function CourseList() {
  const {courses,error,saveStatus} = useStudioSession(), admin = useAdminSession(), user = useCurrentUser();
  const [filter,setFilter] = useState("all");
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const owned = courses.filter(course=>canEditCourse(course,user,admin.state));
  return <>
    <div className="course-page-heading"><div><span className="course-kicker">CURSO AVULSO</span><h1 ref={heading} tabIndex={-1}>Meus cursos</h1><p>Organize e salve capítulos e atividades para continuar depois.</p></div><Link className="studio-primary" href="/studio/courses/new">Novo curso</Link></div>
    <label htmlFor="course-status-filter">Status</label><select id="course-status-filter" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Todos</option><option value="draft">Rascunhos</option><option value="published">Publicados</option><option value="archived">Arquivados</option></select>
    <p role="status">{saveStatus}</p>{error && <p role="alert">{error}</p>}
    {!owned.length && <section className="studio-panel"><h2>Nenhum curso nesta sessão</h2><p>Crie um curso para começar sua estrutura pedagógica.</p></section>}
    <div className="course-cards">{courseFamilies(owned).filter(versions=>versions.some(c=>filter==="all"||c.status===filter)).map(versions=>{
      const course=versions.find(c=>filter==="all"||c.status===filter)!,published=latestPublished(versions,courseFamilyId(course));
      return <article className="course-card" key={courseFamilyId(course)}><div className="course-cover" role="img" aria-label={course.image.label}>{course.image.label}</div><div className="course-card-body"><span className="studio-draft-tag">{labels[course.status]} · v{courseVersion(course)}</span><h2><Link href={`/studio/courses/${course.id}`}>{course.title}</Link></h2><p>{course.description||"Sem descrição."}</p><p>{course.chapters.length} capítulos · {course.chapters.reduce((sum,ch)=>sum+ch.activities.length,0)} atividades</p><p>Professor: {admin.state.users.find(u=>u.id===course.createdBy)?.name??course.createdByName??"Catálogo institucional"}</p><small>Última alteração: <time dateTime={course.updatedAt}>{new Date(course.updatedAt).toLocaleString("pt-BR")}</time></small><p>Atual publicada: {published?`v${courseVersion(published)}`:"Nenhuma"}</p><Link className="studio-secondary" href={`/studio/courses/${course.id}`}>{course.status==="draft"?"Continuar editando":"Editar curso"}</Link>{course.status==="published"&&<Link className="studio-secondary" href={`/studio/courses/${course.id}/preview`}>Visualizar</Link>}<ul className="course-family-versions">{versions.map(v=><li key={v.id}><Link href={`/studio/courses/${v.id}`}>Abrir v{courseVersion(v)} · {labels[v.status]} · {v.title}</Link></li>)}</ul></div></article>;
    })}</div>
    <ExerciseLibrary />
  </>;
}
