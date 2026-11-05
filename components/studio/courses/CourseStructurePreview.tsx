"use client";
import { useEffect, useRef } from "react";
import type { CourseDraft, ExerciseLibrary, StudioExercise } from "@/types/course";
import { activityLabels } from "@/lib/studio/courseDraft";

export function CourseStructurePreview({ course, exercises, exerciseEntries = Object.values(exercises), onExit }: { course: CourseDraft; exercises: ExerciseLibrary; exerciseEntries?: StudioExercise[]; onExit: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  return <section className="studio-panel course-structure" aria-labelledby="course-structure-title">
    <div className="course-page-heading"><div><span className="course-kicker">PRÉVIA · CURSO AVULSO</span><h1 ref={heading} tabIndex={-1} id="course-structure-title">Estrutura do curso</h1><h2>{course.title}</h2></div><button className="studio-secondary" onClick={onExit}>Voltar à edição do curso</button></div>
    <p>{course.description}</p><p>{course.objective}</p><p>Carga horária: {course.workload} horas</p><p>Prévia da organização; não representa progresso ou acesso de um aluno.</p>
    {!course.chapters.length && <p>Nenhum capítulo adicionado.</p>}
    <ol>{course.chapters.map(chapter => <li key={chapter.id}><h3>Capítulo {chapter.order} – {chapter.title}</h3>{chapter.description && <p>{chapter.description}</p>}<ol>{chapter.activities.map(activity => <li key={activity.id}><strong>{activity.order}. {activity.title}</strong> — {activityLabels[activity.type]} · {activity.required ? "Obrigatória" : "Opcional"}
      {activity.type === "spreadsheet-exercise" && <p>Exercício: {exerciseEntries.find(entry=>entry.id===activity.content.exerciseId && (!activity.content.exerciseVersion || entry.definition.version===activity.content.exerciseVersion))?.definition.title ?? "Não disponível"} · {activity.content.exerciseVersion}</p>}
    </li>)}</ol>{!chapter.activities.length && <p>Nenhuma atividade adicionada.</p>}</li>)}</ol>
  </section>;
}
