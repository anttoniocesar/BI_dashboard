"use client";
import Link from "next/link";
import { useLearnSession } from "./LearnSession";
import { courseProgress, initialProgress } from "@/lib/learn/progress";
import { chapterUrl } from "./CourseJourney";
import { CourseOverviewSidebar } from "./CourseOverviewSidebar";
import { CourseSummaryCards } from "./CourseSummaryCards";
import { CourseJourneyBoard } from "./CourseJourneyBoard";
import { CourseIntroVideo } from "./CourseIntroVideo";
import { learningProjection, learningStatusLabels } from "@/lib/learn/monitoring";

export function MissingCourse() {
  return <section className="learn-card"><h1>Curso não disponível</h1><p>Curso inexistente, não publicado ou sem acesso disponível.</p><Link className="learn-button" href="/learn">Voltar aos cursos</Link></section>;
}
export function CourseOverview({ courseId }: { courseId: string }) {
  const { courses, progress, teachers, progressRows } = useLearnSession();
  const course = courses.find(item => item.id === courseId);
  if (!course) return <MissingCourse />;
  const student = progress[course.id] ?? initialProgress(course.id);
  const state = courseProgress(course, student);
  const learningStatuses = Object.fromEntries(learningProjection(course,progressRows,student).chaptersDetail.map(item => [item.chapter.id,learningStatusLabels[item.status]]));
  const destination = state.currentChapterId ?? state.chapters[0]?.id;
  return <div className="course-overview-shell"><CourseOverviewSidebar course={course} chapters={state.chapters} completedActivities={student.completedActivities} /><div className="course-overview-content">
    <section className="course-overview-hero"><div><span>SEU APRENDIZADO COMEÇA AQUI</span><h1>Visão Geral do Treinamento</h1><p>{course.description || "Explore os capítulos, acompanhe sua evolução e pratique o conhecimento nas atividades do curso."}</p></div>{destination && <Link className="learn-button" href={chapterUrl(course.id, destination)}>{state.completed ? "Revisitar curso" : state.completedCount ? "Continuar estudos" : "Começar curso"}</Link>}</section>
    <CourseSummaryCards course={course} chapters={state.chapters} percent={state.percent} completedCount={state.completedCount} requiredCount={state.requiredCount} nextId={state.currentChapterId} />
    {state.completed && <p className="course-overview-completed" role="status">Curso concluído ✓</p>}
    <CourseJourneyBoard course={course} chapters={state.chapters} learningStatuses={learningStatuses} />
    <p className="learn-card">Professor responsável: {teachers.filter(item => item.courseId === courseId).map(item => item.name).join(", ") || "Não associado"}</p>
    <CourseIntroVideo objective={course.objective} />
  </div></div>;
}
