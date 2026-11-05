"use client";
import { useEffect, useId, useRef, useState } from "react";
import type { CourseDraft } from "@/types/course";
import type { CourseDetails } from "@/lib/studio/courseDraft";

export function CourseDetailsForm({ course, onSave, onDirty }: { course?: CourseDraft; onSave: (details: CourseDetails) => void | Promise<void>; onDirty?:()=>void }) {
  const id = useId();
  const [title, setTitle] = useState(course?.title ?? "");
  const [description, setDescription] = useState(course?.description ?? "");
  const [objective, setObjective] = useState(course?.objective ?? "");
  const [workload, setWorkload] = useState(String(course?.workload ?? 0));
  const [image, setImage] = useState(course?.image.label ?? "Capa do curso");
  const [error, setError] = useState("");
  const snapshot=JSON.stringify({title:title.trim(),description,objective,workload:Number(workload),image:{kind:"placeholder",label:image.trim()||"Capa do curso"}});
  const confirmed=useRef(snapshot), callbacks=useRef({onSave,onDirty}), timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  callbacks.current={onSave,onDirty};
  useEffect(()=>{
    if (!course || snapshot===confirmed.current)return;
    callbacks.current.onDirty?.();
    if (!title.trim() || !workload.trim() || !Number.isFinite(Number(workload)) || Number(workload)<0)return;
    timer.current=setTimeout(()=>{void Promise.resolve(callbacks.current.onSave(JSON.parse(snapshot))).then(()=>{confirmed.current=snapshot;setError("");}).catch(cause=>setError(cause.message));},800);
    return ()=>{if(timer.current)clearTimeout(timer.current);};
  },[snapshot,course?.id,title,workload]);
  return <form className="course-form" aria-label="Dados do curso" onSubmit={async event => {
    event.preventDefault();
    if(timer.current)clearTimeout(timer.current);
    if (!title.trim() || !workload.trim() || !Number.isFinite(Number(workload)) || Number(workload) < 0) { setError("Informe título e carga horária válida."); return; }
    try { setError(""); await onSave(JSON.parse(snapshot));confirmed.current=snapshot; } catch(cause) { setError(cause instanceof Error ? cause.message : "Não foi possível salvar."); }
  }}>
    <div><label htmlFor={`${id}-title`}>Título do curso</label><input id={`${id}-title`} required value={title} onChange={event => setTitle(event.target.value)} /></div>
    <div><label htmlFor={`${id}-hours`}>Carga horária (horas)</label><input id={`${id}-hours`} required type="number" min="0" step="any" value={workload} onChange={event => setWorkload(event.target.value)} /></div>
    <div className="course-full"><label htmlFor={`${id}-description`}>Descrição do curso</label><textarea id={`${id}-description`} rows={3} value={description} onChange={event => setDescription(event.target.value)} /></div>
    <div className="course-full"><label htmlFor={`${id}-objective`}>Objetivo do curso</label><textarea id={`${id}-objective`} rows={2} value={objective} onChange={event => setObjective(event.target.value)} /></div>
    <div className="course-full"><label htmlFor={`${id}-image`}>Descrição da imagem de capa (placeholder)</label><input id={`${id}-image`} value={image} onChange={event => setImage(event.target.value)} /><small>A capa é um placeholder; nenhum arquivo é enviado.</small></div>
    {error && <p role="alert" className="course-full">{error}</p>}
    <div className="course-full"><button className="studio-primary" type="submit">{course ? "Salvar dados do curso" : "Criar curso"}</button><small>Confirme os dados para persistir as alterações.</small></div>
  </form>;
}
