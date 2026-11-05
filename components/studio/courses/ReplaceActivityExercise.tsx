"use client";
import { labRoute } from "@/lib/navigation/labReturn";
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ActivityDraft, CourseDraft, StudioExercise } from "@/types/course";
import { exerciseKey } from "@/lib/repositories/CourseRepository";
import { isValidStudioExercise } from "@/lib/courses/exerciseReplacement";
import { exerciseUsages } from "@/lib/courses/exerciseDeletion";
import { useStudioSession } from "../StudioSession";

type LabActivity = Extract<ActivityDraft,{type:"spreadsheet-exercise"}>;
type Snapshot = {course:CourseDraft; activity:LabActivity};

export function ReplaceActivityExercise({courseId,chapterId,activityId}:{courseId:string;chapterId:string;activityId:string}) {
  const studio = useStudioSession();
  const [snapshot,setSnapshot] = useState<Snapshot | null>(null), [notice,setNotice] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const course = studio.courses.find(c=>c.id===courseId), activity = course?.chapters.find(ch=>ch.id===chapterId)?.activities.find(a=>a.id===activityId);
  if (!course || activity?.type !== "spreadsheet-exercise") return null;
  const current = studio.workspace.exercises.find(e=>e.id===activity.content.exerciseId && (!activity.content.exerciseVersion || e.definition.version===activity.content.exerciseVersion));
  return <div className="activity-exercise-control">
    <p>Exercício atual: {current?.definition.title ?? "Não disponível"} · {activity.content.exerciseVersion ?? current?.definition.version ?? "Versão não definida"}</p>
    <button type="button" className="studio-secondary" ref={trigger} disabled={studio.saveStatus !== "Salvo"} onClick={()=>{setNotice("");setSnapshot({course:structuredClone(course),activity:structuredClone(activity)});}}>Substituir exercício</button>
    {notice && <p role="status">{notice}</p>}
    {snapshot && <ReplacementDialog snapshot={snapshot} chapterId={chapterId} entries={studio.workspace.exercises} 
      onClose={()=>{setSnapshot(null);requestAnimationFrame(()=>trigger.current?.focus());}}
      onReplace={async entry=>{
        await studio.execute({operation:"replace-activity-exercise",id:courseId,chapterId,activityId,expectedUpdatedAt:snapshot.course.updatedAt,
          previousExerciseId:snapshot.activity.content.exerciseId,previousExerciseVersion:snapshot.activity.content.exerciseVersion ?? null,nextExerciseId:entry.id,nextExerciseVersion:entry.definition.version});
        setNotice("Exercício substituído com sucesso.");
      }} usages={studio.workspace.courses} />}
  </div>;
}

function ReplacementDialog({snapshot,entries,onReplace,onClose,usages}:{snapshot:Snapshot;chapterId:string;entries:StudioExercise[];onReplace:(entry:StudioExercise)=>Promise<void>;onClose:()=>void;usages:CourseDraft[]}) {
  const id = useId(), dialog = useRef<HTMLDialogElement>(null), cancel = useRef<HTMLButtonElement>(null), busy = useRef(false);
  const [query,setQuery] = useState(""), [selected,setSelected] = useState(""), [pending,setPending] = useState(false), [error,setError] = useState("");
  const candidates = useMemo(()=>entries.map(entry=>({entry,valid:isValidStudioExercise(entry)})),[entries]);
  const isCurrent = (entry:StudioExercise) => entry.id===snapshot.activity.content.exerciseId && (!snapshot.activity.content.exerciseVersion || entry.definition.version===snapshot.activity.content.exerciseVersion);
  const current = entries.find(isCurrent), next = entries.find(entry=>exerciseKey(entry.id,entry.definition.version)===selected);
  const blocked = snapshot.course.status !== "draft";
  const available = candidates.some(({entry,valid})=>valid && !isCurrent(entry));
  const filtered = candidates.filter(({entry})=>`${entry.definition.title} ${entry.definition.version}`.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR")));
  useEffect(()=>{dialog.current?.showModal();cancel.current?.focus();},[]);
  async function replace() {
    if (busy.current || blocked || !next || isCurrent(next) || !isValidStudioExercise(next)) return;
    busy.current=true;setPending(true);setError("");
    try {await onReplace(next);dialog.current?.close();}
    catch(cause) {setError(`Não foi possível substituir o exercício. ${cause instanceof Error ? cause.message : "Tente novamente."}`);}
    finally {busy.current=false;setPending(false);}
  }
  const priorUsages = exerciseUsages(usages,snapshot.activity.content.exerciseId,snapshot.activity.content.exerciseVersion ?? current?.definition.version ?? "");
  return <dialog className="course-delete-dialog exercise-replacement-dialog" ref={dialog} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} aria-busy={pending}
    onClose={onClose} onCancel={event=>{if(busy.current)event.preventDefault();}}
    onKeyDown={event=>{
      if(event.key!=="Tab")return;
      const controls=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),a[href]'));
      const first=controls[0],last=controls.at(-1);
      if(!first||!last){event.preventDefault();return;}
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }}>
    <h2 id={`${id}-title`}>Substituir exercício</h2>
    <p id={`${id}-description`}>Escolha outro exercício salvo. O vínculo só será trocado após a confirmação e o salvamento bem-sucedido. Respostas, tentativas e progresso existentes são preservados.</p>
    <p>Exercício atual: {current?.definition.title ?? snapshot.activity.content.exerciseId} · {snapshot.activity.content.exerciseVersion ?? "Versão não definida"}</p>
    {blocked ? <p role="alert">Este curso está {snapshot.course.status==="published"?"publicado":"arquivado"}. A atividade publicada deve ser preservada. Crie uma nova versão do curso para usar outro Lab e manter o histórico dos alunos.</p> : <>
      <label htmlFor={`${id}-search`}>Buscar exercício</label><input id={`${id}-search`} type="search" value={query} disabled={pending} onChange={event=>setQuery(event.target.value)} />
      <fieldset className="replacement-options" disabled={pending}><legend>Biblioteca de exercícios</legend>
        {filtered.map(({entry,valid})=><label className="replacement-option" key={exerciseKey(entry.id,entry.definition.version)}>
          <input type="radio" name={`${id}-exercise`} value={exerciseKey(entry.id,entry.definition.version)} checked={selected===exerciseKey(entry.id,entry.definition.version)} disabled={isCurrent(entry)||!valid} onChange={event=>setSelected(event.target.value)} />
          <span><strong>{entry.definition.title} · {entry.definition.version}</strong>{isCurrent(entry)&&<span className="studio-draft-tag"> Atual</span>}{!valid&&<span> · Indisponível</span>}
            <small>{entry.definition.workbook.worksheets.length} abas{entry.updatedAt&&<> · Última alteração: <time dateTime={entry.updatedAt}>{new Date(entry.updatedAt).toLocaleString("pt-BR")}</time></>}</small></span>
        </label>)}
        {!filtered.length&&<p>Nenhum exercício encontrado para esta busca.</p>}
      </fieldset>
      {!available&&<p>Nenhum outro exercício disponível para substituição.</p>}
      {!pending&&<Link className="studio-secondary" href={labRoute("/studio/import", `/studio/courses/${snapshot.course.id}`)}>Importar novo exercício</Link>}
      {next&&<div className="replacement-confirmation" role="status"><p>Substituir “{current?.definition.title ?? snapshot.activity.content.exerciseId}” ({snapshot.activity.content.exerciseVersion ?? "sem versão"}) por “{next.definition.title}” ({next.definition.version})?</p>
        {current&&current.definition.workbook.worksheets.map(s=>s.name).join("\0")!==next.definition.workbook.worksheets.map(s=>s.name).join("\0")&&<p>As abas dos exercícios são diferentes. A troca não migra respostas entre planilhas.</p>}
        {priorUsages.length>1&&<p>O exercício anterior continuará em uso por outras atividades e permanecerá protegido contra exclusão.</p>}
      </div>}
    </>}
    {error&&<p role="alert">{error}</p>}
    <div className="course-actions"><button className="studio-secondary" type="button" ref={cancel} disabled={pending} onClick={()=>dialog.current?.close()}>Cancelar</button>
      {!blocked&&<button className="studio-primary" type="button" disabled={!next||pending||isCurrent(next)||!isValidStudioExercise(next)} onClick={()=>void replace()}>{pending?"Substituindo...":"Substituir"}</button>}</div>
  </dialog>;
}
