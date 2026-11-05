"use client";
import { useRef, useState } from "react";
import type { ChapterDraft, ExerciseLibrary, StudioExercise } from "@/types/course";
import { activityLabels, moveOrdered, ordered, upsertActivity } from "@/lib/studio/courseDraft";
import { ActivityForm } from "./ActivityForm";
import { ReplaceActivityExercise } from "./ReplaceActivityExercise";

export function ChapterCard({ courseId, chapter, count, exercises, exerciseEntries, onChange, onMove, onDelete, onOpenExercise }: {
  courseId: string; chapter: ChapterDraft; count: number; exercises: ExerciseLibrary; exerciseEntries:StudioExercise[]; onChange: (chapter: ChapterDraft) => void;
  onMove: (delta: -1 | 1) => void; onDelete: () => void; onOpenExercise: (id: string,version?:string) => void;
}) {
  const [editing, setEditing] = useState(false), [title, setTitle] = useState(chapter.title), [description, setDescription] = useState(chapter.description ?? "");
  const [activityId, setActivityId] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null), add = useRef<HTMLButtonElement>(null);
  function closeActivity() { setActivityId(null); requestAnimationFrame(() => add.current?.focus()); }
  return <section className="course-chapter" aria-labelledby={`${chapter.id}-title`}>
    <header className="course-chapter-heading"><div><span className="course-kicker">CAPÍTULO {chapter.order}</span><h3 ref={heading} tabIndex={-1} id={`${chapter.id}-title`}>{chapter.title}</h3><p>{chapter.description || "Sem descrição."}</p><small>{chapter.activities.length} atividades · Todas as atividades obrigatórias</small></div>
      <div className="course-actions"><button className="studio-secondary" disabled={chapter.order === 1} aria-label={`Subir capítulo ${chapter.title}`} onClick={() => { onMove(-1); requestAnimationFrame(() => heading.current?.focus()); }}>Subir</button><button className="studio-secondary" disabled={chapter.order === count} aria-label={`Descer capítulo ${chapter.title}`} onClick={() => { onMove(1); requestAnimationFrame(() => heading.current?.focus()); }}>Descer</button><button className="studio-secondary" onClick={() => setEditing(!editing)}>Editar capítulo</button><button className="studio-secondary" onClick={onDelete}>Excluir capítulo</button></div>
    </header>
    {editing && <form className="course-chapter-form" aria-label="Editar capítulo" onSubmit={event => { event.preventDefault(); if (!title.trim()) return; onChange({ ...chapter, title: title.trim(), description }); setEditing(false); requestAnimationFrame(() => heading.current?.focus()); }}>
      <label htmlFor={`${chapter.id}-name`}>Título do capítulo</label><input autoFocus id={`${chapter.id}-name`} required value={title} onChange={event => setTitle(event.target.value)} />
      <label htmlFor={`${chapter.id}-description`}>Descrição do capítulo</label><textarea id={`${chapter.id}-description`} value={description} onChange={event => setDescription(event.target.value)} rows={2} />
      <button className="studio-primary" type="submit">Salvar capítulo</button>
    </form>}
    <ol className="course-activities" aria-label={`Atividades de ${chapter.title}`}>{chapter.activities.map(activity => <li key={activity.id}>
      <article className="course-activity" aria-labelledby={`${activity.id}-title`}>
        <div><h4 id={`${activity.id}-title`} tabIndex={-1}>{activity.order}. {activity.title}</h4><p><span className="course-type">{activityLabels[activity.type]}</span> · {activity.required ? "Obrigatória" : "Opcional"}</p>
          {activity.type === "spreadsheet-exercise" && <ReplaceActivityExercise courseId={courseId} chapterId={chapter.id} activityId={activity.id} />}
        </div>
        <div className="course-actions"><button className="studio-secondary" aria-label={`Subir atividade ${activity.title}`} disabled={activity.order === 1} onClick={() => { onChange({ ...chapter, activities: moveOrdered(chapter.activities, activity.id, -1) }); requestAnimationFrame(() => document.getElementById(`${activity.id}-title`)?.focus()); }}>Subir</button><button className="studio-secondary" aria-label={`Descer atividade ${activity.title}`} disabled={activity.order === chapter.activities.length} onClick={() => { onChange({ ...chapter, activities: moveOrdered(chapter.activities, activity.id, 1) }); requestAnimationFrame(() => document.getElementById(`${activity.id}-title`)?.focus()); }}>Descer</button>
          <button className="studio-secondary" onClick={() => setActivityId(activity.id)}>Editar atividade</button><button className="studio-secondary" onClick={() => { onChange({ ...chapter, activities: ordered(chapter.activities.filter(item => item.id !== activity.id)) }); closeActivity(); }}>Excluir atividade</button>
          {activity.type === "spreadsheet-exercise" && <button className="studio-secondary" disabled={!exercises[activity.content.exerciseId]} onClick={() => onOpenExercise(activity.content.exerciseId,activity.content.exerciseVersion)}>Editar exercício</button>}
        </div>
      </article>
    </li>)}</ol>
    {activityId !== null && <ActivityForm key={activityId} activity={chapter.activities.find(activity => activity.id === activityId)} exercises={exercises} exerciseEntries={exerciseEntries} onSave={activity => { onChange(upsertActivity(chapter, activity)); closeActivity(); }} onCancel={closeActivity} />}
    <button className="studio-secondary" ref={add} onClick={() => setActivityId("new")}>Nova atividade</button>
  </section>;
}
