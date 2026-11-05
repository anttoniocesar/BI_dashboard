"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAdminSession } from "@/components/admin/AdminSession";
import { useCurrentUser } from "@/components/auth/AuthSession";
import { useLearnSession } from "@/components/learn/LearnSession";
import { hasRole } from "@/lib/admin/permissions";
import { InMemoryMonitoringRepository } from "@/lib/repositories/InMemoryMonitoringRepository";
import { HttpMonitoringRepository } from "@/lib/repositories/HttpMonitoringRepository";
import { demoMonitoringState, demoMonitoringRows } from "@/data/monitoring/demo";
import { filterMonitoringStudents, formatLearningDate, learningStatusLabels, monitoredStudents, monitoringSummary } from "@/lib/learn/monitoring";
import { chapterNavigation } from "@/lib/learn/chapter-navigation";
import type { MonitoringCourseData } from "@/types/monitoring";
import type { CourseDraft } from "@/types/course";
import {courseVersion} from "@/lib/courses/versions";
import {canEditCourse} from "@/lib/courses/authoring";

const courseUrl = (id:string) => `/studio/monitoring/${encodeURIComponent(id)}`;
export function MonitoringPage({ courseId,userId }: { courseId?:string; userId?:string }) {
  const { state,courses:allCourses,configuration } = useAdminSession();
  const courses=allCourses.filter(course=>course.status==="published");
  const user = useCurrentUser();
  const { getDemoProgressRows } = useLearnSession();
  const [result,setResult] = useState<{ key:string; data?:MonitoringCourseData[]; error?:string }>({ key:"" });
  const [version,setVersion] = useState(0);
  const key = JSON.stringify([user?.id,courseId,userId,version]);
  // Demo queries stay reactive to both administrative changes and Learn writes.
  const demo = useMemo(() => configuration.mode === "demo" && user ? new InMemoryMonitoringRepository(() => ({...demoMonitoringState(state),courseTeachers:[...state.courseTeachers,...allCourses.filter(c=>canEditCourse(c,user,state)).map(c=>({userId:user.id,courseId:c.id}))]}),user.id,id => demoMonitoringRows(id) ?? getDemoProgressRows(id)) : null,[configuration.mode,user,state,getDemoProgressRows,allCourses]);
  useEffect(() => {
    let cancelled=false;
    const repository = demo ?? new HttpMonitoringRepository();
    const request = courseId ? (userId ? repository.getStudentDetail(courseId,userId) : repository.getCourseStudents(courseId)).then(data => [data]) : repository.listTeacherCourses();
    request.then(data => { if (!cancelled) setResult({ key,data }); }).catch(() => { if (!cancelled) setResult({ key,error:"Não foi possível carregar o acompanhamento. Verifique sua associação ao curso ou tente novamente." }); });
    return () => { cancelled=true; };
  },[demo,key,courseId,userId]);
  if (!hasRole(user,"teacher")) return <section><h1>Acesso não autorizado</h1><p>O acompanhamento exige perfil Professor e associação ao curso.</p></section>;
  if (result.key !== key) return <p role="status">Carregando acompanhamento...</p>;
  if (result.error) return <section><h1>Acompanhamento indisponível</h1><p role="alert">{result.error}</p><button onClick={() => setVersion(value => value+1)}>Tentar novamente</button><p><Link href="/studio/monitoring">Voltar ao acompanhamento</Link></p></section>;
  const data = result.data ?? [];
  const course = courses.find(item => item.id === courseId);
  if (courseId && !course) return <section><h1>Curso não disponível</h1><p>A definição deste curso não está disponível no catálogo atual.</p><Link href="/studio/monitoring">Voltar ao acompanhamento</Link></section>;
  if (course && data[0]) return userId ? <StudentDetail course={course} data={data[0]} /> : <CourseReport key={courseId} course={course} data={data[0]} />;
  return <section><h1>Acompanhamento</h1><p>Acompanhe os alunos dos cursos associados a você.</p><div className="monitoring-course-grid">{data.flatMap(item => {
    const course = courses.find(course => course.id === item.courseId);
    if (!course) return [];
    const summary = monitoringSummary(course,item.students);
    return [<article className="monitoring-card" key={course.id}><h2><Link href={courseUrl(course.id)}>{course.title}</Link></h2><p>Versão v{courseVersion(course)}</p><p>{summary.total} alunos · {summary.started} iniciados · {summary.completed} concluídos</p><p>Progresso médio: {summary.average}%</p><p>{summary.inactive} sem atividade recente</p></article>];
  })}</div>{!data.some(item => courses.some(course => course.id === item.courseId)) && <p>Nenhum curso associado disponível para acompanhamento.</p>}</section>;
}
function CourseReport({ course,data }: { course:CourseDraft; data:MonitoringCourseData }) {
  const [status,setStatus] = useState("all");
  const [search,setSearch] = useState("");
  const [sort,setSort] = useState("name");
  const summary = monitoringSummary(course,data.students);
  const students = filterMonitoringStudents(monitoredStudents(course,data.students),status,search,sort);
  return <section><Link href="/studio/monitoring">← Acompanhamento</Link><h1>{course.title}</h1><p>Versão v{courseVersion(course)} · Progresso desta versão</p><div className="monitoring-metrics">{[["Total de alunos",summary.total],["Média de progresso",`${summary.average}%`],["Concluíram",summary.completed],["Em andamento",summary.inProgress]].map(([label,value]) => <div className="monitoring-card" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    <p>{summary.inactive} alunos sem atividade recente. Considera ausência de registro ou mais de 7 dias sem atualização.</p>
    <div className="monitoring-filters"><div><label htmlFor="monitoring-status">Situação</label><select id="monitoring-status" value={status} onChange={event => setStatus(event.target.value)}><option value="all">Todos</option><option value="not-started">Não iniciados</option><option value="in-progress">Em andamento</option><option value="completed">Concluídos</option></select></div><div><label htmlFor="monitoring-search">Buscar por nome ou matrícula</label><input id="monitoring-search" type="search" value={search} onChange={event => setSearch(event.target.value)} /></div><div><label htmlFor="monitoring-sort">Ordenar por</label><select id="monitoring-sort" value={sort} onChange={event => setSort(event.target.value)}><option value="name">Nome</option><option value="progress">Progresso (maior primeiro)</option><option value="recent">Última atividade (mais recente)</option></select></div></div>
    <p role="status">{students.length} alunos encontrados</p>
    {!data.students.length ? <p>Ainda não há alunos com acesso a este curso.</p> : <div className="monitoring-table-scroll" tabIndex={0} role="region" aria-label="Tabela de alunos"><table><caption>Alunos do curso</caption><thead><tr>{["Nome","Matrícula","Progresso","Capítulo atual","Atividades concluídas","Última atividade","Última atualização","Status"].map(title => <th key={title} scope="col">{title}</th>)}</tr></thead><tbody>{students.map(student => <tr key={student.userId}><th scope="row"><Link href={`${courseUrl(course.id)}/student/${encodeURIComponent(student.userId)}`}>{student.name}</Link></th><td>{student.registrationCode}</td><td>{student.learning.percent}%</td><td>{student.learning.currentChapter?.title ?? "Sem registro"}</td><td>{student.learning.completedCount} de {student.learning.requiredCount} obrigatórias</td><td>{student.learning.lastActivity?.title ?? "Sem registro"}</td><td>{formatLearningDate(student.learning.updatedAt)}</td><td>{learningStatusLabels[student.learning.status]}{student.learning.noRecentActivity && <small>Sem atividade recente</small>}</td></tr>)}</tbody></table>{!students.length && <p>Nenhum aluno corresponde aos filtros.</p>}</div>}
  </section>;
}
function StudentDetail({ course,data }: { course:CourseDraft; data:MonitoringCourseData }) {
  const student = monitoredStudents(course,data.students)[0];
  if (!student) return <p>Aluno não disponível neste curso.</p>;
  return <section><Link href={courseUrl(course.id)}>← Alunos do curso</Link><h1>{student.name}</h1><p>Matrícula: {student.registrationCode}</p><h2>{course.title}</h2><p>Versão v{courseVersion(course)}</p><p>Progresso geral: <strong>{student.learning.percent}%</strong> · {learningStatusLabels[student.learning.status]}</p><p>{student.learning.completedChapters.length} de {course.chapters.length} capítulos concluídos · {student.learning.completedCount} de {student.learning.requiredCount} atividades obrigatórias concluídas</p>
    {student.learning.chaptersDetail.map(({ chapter,status,activities }) => <section className="monitoring-card" key={chapter.id}><h3>Capítulo {chapter.order} — {chapter.title}</h3><p>{learningStatusLabels[status]}</p><ol>{chapterNavigation(chapter.activities).map(item => {
      const activity = activities.find(entry => entry.activity.id === item.activity.id)!;
      return <li key={item.activity.id}><strong>{item.prefix}. {item.activity.title}</strong> · {item.activity.required ? "Obrigatória" : "Opcional"} · {learningStatusLabels[activity.status]}{activity.status === "completed" && <> · Concluída em {formatLearningDate(activity.completedAt)}</>}</li>;
    })}</ol></section>)}
  </section>;
}
