"use client";
import "@/app/studio/courses/courses.css";
import Link from "next/link";
import {useEffect,useRef,useState,useId} from "react";
import {useRouter} from "next/navigation";
import type {CourseDraft} from "@/types/course";
import {courseFamilyId,courseVersion,latestPublished} from "@/lib/courses/versions";
import {useStudioSession} from "../StudioSession";

export function CourseVersionActions({course,navigate=true}:{course:CourseDraft;navigate?:boolean}){
 const {courses,execute}=useStudioSession(),router=useRouter();const [action,setAction]=useState<"create"|"discard"|null>(null),[notice,setNotice]=useState("");const trigger=useRef<HTMLButtonElement>(null);
 const draft=courses.find(c=>courseFamilyId(c)===courseFamilyId(course)&&c.status==="draft");
 if(!courses.some(c=>c.id===course.id))return <p>Catálogo de demonstração · v{courseVersion(course)}</p>;
 return <div className="course-version-actions"><p>Versão atual: v{courseVersion(course)}</p>
  {course.status==="published"&&(draft?<p>Rascunho v{courseVersion(draft)} em edição {navigate&&<Link className="studio-secondary" href={`/studio/courses/${draft.id}`}>Abrir rascunho</Link>}</p>:<button type="button" ref={trigger} className="studio-primary" onClick={()=>setAction("create")}>Criar nova versão</button>)}
  {course.status==="draft"&&course.basedOnCourseId&&<button type="button" className="studio-secondary" ref={trigger} onClick={()=>setAction("discard")}>Descartar rascunho</button>}
  {notice&&<p role="status">{notice}</p>}
  {action&&<VersionConfirmation action={action} course={course} onClose={()=>{setAction(null);requestAnimationFrame(()=>trigger.current?.focus());}} onConfirm={async()=>{
    if(action==="discard"){await execute({operation:"delete-draft",id:course.id});router.push(`/studio/courses/${course.basedOnCourseId}`);return;}
    const data=await execute({operation:"create-course-revision",sourceCourseId:course.id,expectedUpdatedAt:course.updatedAt});
    const next=data.courses.find(c=>courseFamilyId(c)===courseFamilyId(course)&&c.status==="draft")!;
    if(navigate)router.push(`/studio/courses/${next.id}`);else setNotice(`Rascunho v${courseVersion(next)} criado para edição pelo professor.`);
  }}/>}
 </div>;
}
function VersionConfirmation({action,course,onClose,onConfirm}:{action:"create"|"discard";course:CourseDraft;onClose:()=>void;onConfirm:()=>Promise<void>}){
 const id=useId(),dialog=useRef<HTMLDialogElement>(null),cancel=useRef<HTMLButtonElement>(null),busy=useRef(false);const[pending,setPending]=useState(false),[error,setError]=useState("");
 useEffect(()=>{dialog.current?.showModal();cancel.current?.focus();},[]);
 return <dialog ref={dialog} className="course-delete-dialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onClose={onClose} onCancel={e=>{if(busy.current)e.preventDefault();}} onKeyDown={e=>{if(e.key!=="Tab")return;const buttons=Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")),first=buttons[0],last=buttons.at(-1);if(!first||!last){e.preventDefault();return;}if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}>
  <h2 id={`${id}-title`}>{action==="create"?"Criar nova versão":"Descartar rascunho"} de “{course.title}”?</h2><p id={`${id}-description`}>{action==="create"?`Será criada uma cópia em rascunho de v${courseVersion(course)}, com novos IDs de capítulos e atividades. Exercícios serão referenciados sem duplicação. A publicação e os acessos dos alunos atuais serão preservados.`:"O rascunho será removido. As versões publicadas, os exercícios e o histórico dos alunos serão preservados."}</p>
  {error&&<p role="alert">{error}</p>}<div className="course-actions"><button type="button" className="studio-secondary" ref={cancel} disabled={pending} onClick={()=>dialog.current?.close()}>Cancelar</button><button type="button" className="studio-primary" disabled={pending} onClick={async()=>{if(busy.current)return;busy.current=true;setPending(true);try{await onConfirm();dialog.current?.close();}catch(cause){setError(cause instanceof Error?cause.message:"Não foi possível concluir.");}finally{busy.current=false;setPending(false);}}}>{pending?"Salvando...":action==="create"?"Confirmar nova versão":"Confirmar descarte"}</button></div>
 </dialog>;
}
export function CourseVersionHistory({course}:{course:CourseDraft}){
 const {courses}=useStudioSession(),family=courseFamilyId(course),latest=latestPublished(courses,family),versions=courses.filter(c=>courseFamilyId(c)===family).sort((a,b)=>courseVersion(b)-courseVersion(a));
 const labels={draft:"Rascunho",published:"Publicado",archived:"Arquivado"};
 return <section className="studio-panel course-version-history" aria-label="Histórico de versões"><h2>Histórico de versões</h2><p>Atual publicada: {latest?`v${courseVersion(latest)}`:"Nenhuma"}</p><ul>{versions.map(v=><li key={v.id}>v{courseVersion(v)} · {labels[v.status]}{latest?.id===v.id?" · Atual":""} · {v.title}<small>Criada: {new Date(v.createdAt??v.updatedAt).toLocaleString("pt-BR")}{v.publishedAt&&` · Publicada: ${new Date(v.publishedAt).toLocaleString("pt-BR")}`}{v.basedOnCourseId&&` · Origem: v${courseVersion(courses.find(c=>c.id===v.basedOnCourseId)??course)}`}</small><div className="course-actions"><Link className="studio-secondary" href={`/studio/courses/${v.id}`}>Abrir v{courseVersion(v)}</Link><Link className="studio-secondary" href={`/studio/courses/${v.id}/preview`}>Preview v{courseVersion(v)}</Link></div></li>)}</ul></section>;
}
