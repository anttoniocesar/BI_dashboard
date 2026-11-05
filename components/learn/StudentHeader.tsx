"use client";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { useParams } from "next/navigation";
import type { StudentIdentity } from "@/types/admin";
import { courseProgress, initialProgress } from "@/lib/learn/progress";
import { useLearnSession } from "./LearnSession";
import { UserMenu } from "@/components/auth/UserMenu";

export function StudentHeader({ identity }: { identity: StudentIdentity | null }) {
  const { courseId, chapterId } = useParams<{ courseId: string; chapterId?: string }>();
  const { courses, progress } = useLearnSession();
  const course = courses.find(item => item.id === courseId);
  const state = course ? courseProgress(course, progress[courseId] ?? initialProgress(courseId)) : null;
  return <header className={`learn-header ${chapterId ? "" : "overview-header"}`}>
    <Link className="learn-brand" href="/learn"><BrandLogo environment="ACADEMY" /></Link>
    <div className="student-header-course"><strong>{!chapterId && course ? <><span className="header-course-prefix">Curso: </span><span>{course.title}</span></> : course?.title ?? "Ambiente de aprendizagem"}</strong><small>Conhecimento aplicado à prática</small></div>
    {state && <div className="student-header-progress"><div><label htmlFor="student-course-progress">Progresso do curso</label><strong>{state.percent}%</strong></div><progress id="student-course-progress" max={100} value={state.percent} /><small>{state.completedCount} de {state.requiredCount} atividades obrigatórias</small></div>}
    <div className="learn-profile"><span aria-hidden="true">{identity?.initials ?? "?"}</span><div><strong>{identity ? `Olá, ${identity.name}` : "Identidade indisponível"}</strong><small>Matrícula: {identity?.enrollment ?? "Sem matrícula ativa"}</small><UserMenu /></div></div>
  </header>;
}

export function StudentSessionHeader() {
  const { identity } = useLearnSession();
  return <StudentHeader identity={identity} />;
}
