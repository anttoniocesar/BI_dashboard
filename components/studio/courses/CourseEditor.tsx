"use client";
import { labRoute } from "@/lib/navigation/labReturn";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useStudioSession } from "@/components/studio/StudioSession";
import { useImportJourney } from "@/components/studio/import/ImportJourney";
import { createChapter, moveOrdered, ordered, activityLabels } from "@/lib/studio/courseDraft";
import type { ChapterDraft, CourseDraft } from "@/types/course";
import { CourseDetailsForm } from "./CourseDetailsForm";
import { ChapterCard } from "./ChapterCard";
import { ConfirmChapterDelete } from "./ConfirmChapterDelete";
import { CourseStructurePreview } from "./CourseStructurePreview";
import { courseIssues } from "@/lib/courses/authoring";
import {CourseVersionActions,CourseVersionHistory} from "./CourseVersions";
import { CourseJourneyEditor } from "./CourseJourneyEditor";
import { resolvedJourney } from "@/lib/courses/journey";
import {ReplaceActivityExercise} from "./ReplaceActivityExercise";

export function CourseEditor({ courseId }: { courseId: string }) {
  const { courses, exercises, workspace, saveCourse, execute, saveStatus, error, markDirty } = useStudioSession();
  const { loadAuthorDraft } = useImportJourney();
  const router = useRouter();
  const course = courses.find(course => course.id === courseId);
  const [chapterTitle, setChapterTitle] = useState(""), [checked, setChecked] = useState(false), [preview, setPreview] = useState(false);
  const [deleting, setDeleting] = useState<ChapterDraft | null>(null), [notice, setNotice] = useState("");
  const heading = useRef<HTMLHeadingElement>(null), newChapter = useRef<HTMLInputElement>(null), previewButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (!preview) heading.current?.focus(); }, [preview, courseId]);
  if (!course) return <section className="studio-panel"><h1>Curso não disponível nesta sessão</h1><p>Curso inexistente ou sem permissão de acesso.</p><Link className="studio-secondary" href="/studio/courses">Voltar aos cursos</Link></section>;
  function update(next: CourseDraft, message = "Estrutura atualizada.") { void saveCourse(next).then(()=>setNotice(message)).catch(()=>{}); }
  const issues = checked ? courseIssues(course, workspace) : [];
  if (preview) return <CourseStructurePreview course={course} exercises={exercises} exerciseEntries={workspace.exercises} onExit={() => { setPreview(false); requestAnimationFrame(() => previewButton.current?.focus()); }} />;
  if(course.status!=="draft")return <>
    <div className="course-page-heading"><div><h1 ref={heading} tabIndex={-1}>{course.title}</h1><p>{course.status==="published"?"Publicado":"Arquivado"} · Conteúdo imutável. Use Criar nova versão para fazer melhorias.</p></div><Link className="studio-secondary" href="/studio/courses">Voltar aos cursos</Link></div>
    <CourseVersionActions course={course}/><div className="course-actions"><Link className="studio-secondary" href={`/studio/courses/${course.id}/preview`}>Visualizar como aluno</Link><button className="studio-secondary" onClick={()=>setPreview(true)}>Visualizar estrutura do curso</button>{course.status==="published"&&<button className="studio-secondary" onClick={()=>void execute({operation:"archive",id:course.id}).catch(()=>{})}>Arquivar</button>}<Link className="studio-secondary" href={`/learn/${course.id}`}>Abrir como aluno</Link></div>
    <p role="status">{saveStatus} · {course.status==="published"?"Publicado":"Arquivado"}</p>{error&&<p role="alert">{error}</p>}
    <section className="studio-panel"><h2>Conteúdo preservado</h2><p>{course.description}</p><p>{course.objective}</p><p>{course.workload} horas</p>{course.chapters.map(ch=><section key={ch.id}><h3>{ch.title}</h3><p>{ch.description}</p>{ch.activities.map(a=><article className="course-activity" key={a.id}><div><h4>{a.order}. {a.title}</h4><p>{a.required?"Obrigatória":"Opcional"} · {activityLabels[a.type]}</p>{a.type==="spreadsheet-exercise"?<ReplaceActivityExercise courseId={course.id} chapterId={ch.id} activityId={a.id}/>:<p>{"url" in a.content?a.content.url:"text" in a.content?a.content.text:"description" in a.content?a.content.description:""}</p>}</div></article>)}</section>)}</section>
    <CourseVersionHistory course={course}/>
  </>;
  return <>
    <div className="course-page-heading"><div><span className="course-kicker">CURSO AVULSO · RASCUNHO</span><h1 ref={heading} tabIndex={-1}>{course.title}</h1><p>{course.chapters.length} capítulos · {course.chapters.reduce((sum, chapter) => sum + chapter.activities.length, 0)} atividades</p></div>
      <div className="course-actions"><Link className="studio-secondary" href="/studio/courses">Voltar aos cursos</Link><button className="studio-secondary" onClick={() => setChecked(true)}>Validar estrutura</button><button ref={previewButton} className="studio-primary" onClick={() => setPreview(true)}>Visualizar estrutura do curso</button></div></div>
    <CourseVersionActions course={course}/>
    <div className="course-actions"><button className="studio-primary" onClick={()=>document.querySelector<HTMLFormElement>('[aria-label="Dados do curso"]')?.requestSubmit()}>Salvar</button><button className="studio-primary" disabled={saveStatus!=="Salvo"} onClick={()=>{setChecked(true);void execute({operation:"publish",id:course.id}).then(()=>setNotice("Curso publicado.")).catch(()=>{});}}>Publicar</button><Link className="studio-secondary" href={`/studio/courses/${course.id}/preview`}>Visualizar como aluno</Link><button className="studio-secondary" onClick={()=>void execute({operation:"archive",id:course.id}).catch(()=>{})}>Arquivar</button>{!course.basedOnCourseId && <button onClick={()=>void execute({operation:"delete-draft",id:course.id}).then(()=>router.push("/studio/courses")).catch(()=>{})}>Excluir rascunho</button>}<Link className="studio-secondary" href={`/learn/${encodeURIComponent(course.id)}`}>Abrir como aluno</Link></div>
    <p role="status">{saveStatus} · Rascunho</p>{error && <p role="alert">{error}</p>}
    {notice && <p className="course-notice" role="status">{notice}</p>}
    {checked && <section className={`studio-callout ${issues.length ? "is-error" : "is-success"}`} aria-label="Validação da estrutura" role={issues.length ? "alert" : "status"}>{issues.length ? <><strong>Revise a estrutura do curso</strong><ul>{issues.map((issue, index) => <li key={`${index}-${issue}`}>{issue}</li>)}</ul></> : "Estrutura válida. A publicação é controlada pela ação Publicar."}</section>}
    <section className="studio-panel course-details" aria-labelledby="course-details-title"><h2 id="course-details-title">Dados do curso</h2><CourseDetailsForm key={course.id} course={course} onDirty={markDirty} onSave={async details => {await saveCourse({...course,...details});setNotice("Dados do curso salvos.");}} /></section>
    <CourseJourneyEditor course={course} onChange={next => update(next, "Jornada atualizada.")} />
    <section className="course-chapters" aria-labelledby="course-chapters-title"><h2 id="course-chapters-title">Capítulos e atividades</h2>
      <form className="course-new-chapter" aria-label="Novo capítulo" onSubmit={event => { event.preventDefault(); if (!chapterTitle.trim()) return; update({ ...course, chapters: ordered([...resolvedJourney(course.chapters), { ...createChapter(chapterTitle.trim()), ...(course.chapters.length === 0 ? { trailPointId: "P1" } : {}) }]) }, "Capítulo criado nesta sessão."); setChapterTitle(""); newChapter.current?.focus(); }}>
        <div><label htmlFor="new-chapter-title">Título do novo capítulo</label><input ref={newChapter} id="new-chapter-title" required value={chapterTitle} onChange={event => setChapterTitle(event.target.value)} /></div><button className="studio-primary" type="submit">Criar capítulo</button>
      </form>
      {!course.chapters.length && <p>Adicione o primeiro capítulo para começar.</p>}
      <div className="course-chapter-list">{course.chapters.map(chapter => <ChapterCard key={chapter.id} courseId={course.id} chapter={chapter} count={course.chapters.length} exercises={exercises} exerciseEntries={workspace.exercises}
        onChange={next => update({ ...course, chapters: course.chapters.map(item => item.id === next.id ? next : item) })}
        onMove={delta => update({ ...course, chapters: moveOrdered(resolvedJourney(course.chapters), chapter.id, delta) }, "Ordem dos capítulos atualizada. Confira as posições na jornada.")}
        onDelete={() => setDeleting(chapter)} onOpenExercise={(id,version) => {
          const entry = workspace.exercises.find(entry=>entry.id===id && entry.definition.version===version) ?? exercises[id]; if (!entry) return;
          loadAuthorDraft(entry.draft); router.push(labRoute("/studio/editor", `/studio/courses/${course.id}`));
        }} />)}</div>
    </section>
    <ConfirmChapterDelete chapter={deleting} onCancel={() => setDeleting(null)} onConfirm={() => {
      if (!deleting) return;
      update({ ...course, chapters: ordered(resolvedJourney(course.chapters).filter(chapter => chapter.id !== deleting.id)) }, "Capítulo e atividades excluídos."); setDeleting(null); requestAnimationFrame(() => newChapter.current?.focus());
    }} />
    <CourseVersionHistory course={course}/>
  </>;
}
