"use client";
import Link from "next/link";
import { useLearnSession } from "./LearnSession";
import { learningProjection, learningStatusLabels } from "@/lib/learn/monitoring";
import {courseVersion} from "@/lib/courses/versions";

export function LearnCourses() {
  const { courses,progress,progressRows } = useLearnSession();
  return <section className="learn-course-list"><h1>Meus cursos</h1><p>Continue seus estudos nos cursos liberados para você.</p><div className="auth-area-grid">{courses.map(course => {
    const state = learningProjection(course,progressRows,progress[course.id]);
    const next = course.chapters.find(chapter => chapter.id === state.currentChapterId);
    return <Link className="auth-area-card" key={course.id} href={`/learn/${encodeURIComponent(course.id)}`}><h2>{course.title}</h2><p>Versão v{courseVersion(course)}</p><p>{course.description}</p><span>{course.workload} horas · {course.chapters.length} capítulos</span><p><strong>{state.percent}% concluído</strong> · {learningStatusLabels[state.status]}</p><p>{state.completedCount} de {state.requiredCount} atividades obrigatórias concluídas</p><p>Capítulo atual: {state.currentChapter?.title ?? "Ainda não iniciado"}</p><p>Próximo capítulo: {state.completed ? "Curso concluído" : next?.title ?? "Não disponível"}</p><p>Última atividade: {state.lastActivity?.title ?? "Sem registro"}</p></Link>;
  })}</div>{!courses.length && <div role="status"><p>Nenhum curso foi liberado para você ainda.</p><p>Quando um curso for disponibilizado, ele aparecerá aqui.</p></div>}</section>;
}
