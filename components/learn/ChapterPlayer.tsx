"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { courseProgress, initialProgress } from "@/lib/learn/progress";
import { useLearnSession } from "./LearnSession";
import { MissingCourse } from "./CourseOverview";
import { CourseProgress } from "./CourseProgress";
import { chapterUrl } from "./CourseJourney";
import { ChapterSidebar } from "./ChapterSidebar";
import { ActivityRenderer } from "./ActivityRenderer";
import { ChapterActivitySection } from "./ChapterActivitySection";
import { ChapterNavigation } from "./ChapterNavigation";
import { chapterNavigation } from "@/lib/learn/chapter-navigation";
import { ChapterLaboratorySection } from "./ChapterLaboratorySection";

export function ChapterPlayer({ courseId, chapterId }: { courseId: string; chapterId: string }) {
  return <ChapterContent key={JSON.stringify([courseId, chapterId])} courseId={courseId} chapterId={chapterId} />;
}
function ChapterContent({ courseId, chapterId }: { courseId: string; chapterId: string }) {
  const { courses, progress, visit } = useLearnSession();
  const course = courses.find(item => item.id === courseId);
  const chapter = course?.chapters.find(item => item.id === chapterId);
  const student = progress[courseId] ?? initialProgress(courseId);
  const state = course ? courseProgress(course, student) : null;
  const current = state?.chapters.find(item => item.id === chapterId);
  const navigation = chapterNavigation(chapter?.activities ?? []);
  const activities = navigation.map(item => item.activity);
  const [selectedId, setSelectedId] = useState<string | undefined>(() => activities.find(item => !student.completedActivities.includes(item.id))?.id ?? activities[0]?.id);
  const index = Math.max(0, activities.findIndex(item => item.id === selectedId));
  const activity = activities[index];
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => activity ? { [activity.id]: true } : {});
  const [laboratoryExpanded, setLaboratoryExpanded] = useState(true);
  const [focusRequest, setFocusRequest] = useState(0);
  function selectActivity(id: string) {
    setSelectedId(id);
    setExpanded(previous => ({ ...previous, [id]: true }));
    if (navigation.find(item => item.activity.id === id)?.group === "laboratory") setLaboratoryExpanded(true);
    setFocusRequest(value => value + 1);
  }
  function toggleActivity(id: string) {
    if (expanded[id]) setExpanded(previous => ({ ...previous, [id]: false }));
    else selectActivity(id);
  }
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (current?.available) visit(courseId, chapterId, activity?.id); }, [courseId, chapterId, activity?.id, current?.available, visit]);
  useEffect(() => { heading.current?.focus(); }, [activity?.id, focusRequest]);
  if (!course) return <MissingCourse />;
  if (!chapter || !current) return <section className="learn-card"><h1>Capítulo não disponível</h1><p>O capítulo solicitado não existe neste curso.</p><Link className="learn-button" href={`/learn/${encodeURIComponent(courseId)}`}>Voltar à visão geral</Link></section>;
  if (!current.available) return <section className="learn-card"><h1>Capítulo bloqueado</h1><p>Conclua as atividades obrigatórias dos capítulos anteriores para continuar.</p><Link className="learn-button" href={`/learn/${encodeURIComponent(courseId)}`}>Voltar à visão geral</Link></section>;
  const nextChapter = state?.chapters[(state?.chapters.findIndex(item => item.id === chapterId) ?? -1) + 1];
  const previousChapter = state?.chapters[(state?.chapters.findIndex(item => item.id === chapterId) ?? -1) - 1];
  const labs = navigation.filter(item => item.group === "laboratory");
  const renderActivity = (item: typeof navigation[number]) => <ChapterActivitySection key={item.activity.id} activity={item.activity} index={navigation.indexOf(item)} navigationPrefix={item.prefix} nested={item.group === "laboratory"} active={item.activity.id === activity?.id} expanded={!!expanded[item.activity.id]} completed={student.completedActivities.includes(item.activity.id)} onSelect={() => toggleActivity(item.activity.id)} headingRef={item.activity.id === activity?.id ? heading : undefined}>
    {Object.hasOwn(expanded, item.activity.id) && <ActivityRenderer course={course} chapterId={chapterId} activity={item.activity} summary={chapter.description} completed={student.completedActivities.includes(item.activity.id)} />}
  </ChapterActivitySection>;
  return <div className="learn-study"><ChapterSidebar course={course} chapters={state!.chapters} chapterId={chapterId} activityId={activity?.id} completedActivities={student.completedActivities} onActivity={selectActivity} />
      <div className="learn-study-main">
        <div className="learn-chapter-heading"><p className="learn-kicker">SUA JORNADA DE APRENDIZADO</p><h1 id="chapter-heading" tabIndex={-1}>Capítulo {chapter.order} — {chapter.title}</h1><p>{chapter.description}</p></div>
        <div className="chapter-progress-strip"><CourseProgress label="Progresso do capítulo" completed={current.completedCount} total={current.requiredCount} percent={current.percent} /></div>
        <div className="chapter-activity-sections">{navigation.map(item => item.group === "laboratory" ? item === labs[0] && <ChapterLaboratorySection key="laboratory" expanded={laboratoryExpanded} onToggle={() => setLaboratoryExpanded(value => !value)} completed={labs.filter(item => student.completedActivities.includes(item.activity.id)).length} total={labs.length}>{labs.map(renderActivity)}</ChapterLaboratorySection> : renderActivity(item))}</div>
        {activity ? <div className="learn-activity-navigation">{index > 0 && <button className="learn-button learn-secondary" onClick={() => selectActivity(activities[index - 1].id)}>Atividade anterior</button>}{index < activities.length - 1 && <button className="learn-button learn-secondary" onClick={() => selectActivity(activities[index + 1].id)}>Próxima atividade →</button>}</div> : <p>Este capítulo ainda não possui atividades.</p>}
      {current.completed && <section className="learn-card learn-chapter-complete" role="status"><h2>Capítulo concluído ✓</h2><p>Todas as atividades obrigatórias foram concluídas.</p>{nextChapter?.available ? <Link className="learn-button" href={chapterUrl(courseId, nextChapter.id)}>Continuar para o próximo capítulo</Link> : <Link className="learn-button" href={`/learn/${encodeURIComponent(courseId)}`}>{state?.completed ? "Curso concluído — ver progresso" : "Voltar à visão geral"}</Link>}</section>}
      <ChapterNavigation courseId={courseId} previous={previousChapter} next={nextChapter} />
      </div>
    </div>;
}
