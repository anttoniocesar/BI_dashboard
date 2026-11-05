"use client";
import { labRoute } from "@/lib/navigation/labReturn";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { StudioExercise } from "@/types/course";
import { exerciseKey } from "@/lib/repositories/CourseRepository";
import { exerciseUsages, ExerciseInUseError, type ExerciseUsage } from "@/lib/courses/exerciseDeletion";
import { useAdminSession } from "@/components/admin/AdminSession";
import { useStudioSession } from "../StudioSession";
import { useImportJourney } from "../import/ImportJourney";

export function ExerciseLibrary() {
  const { workspace, execute } = useStudioSession();
  const { configuration } = useAdminSession();
  const { loadAuthorDraft } = useImportJourney();
  const router = useRouter();
  const [selected, setSelected] = useState<StudioExercise | null>(null);
  const [notice, setNotice] = useState("");
  const trigger = useRef<HTMLButtonElement | null>(null), heading = useRef<HTMLHeadingElement>(null);
  const close = () => {
    setSelected(null);
    requestAnimationFrame(() => (trigger.current?.isConnected ? trigger.current : heading.current)?.focus());
  };
  return <section className="studio-panel course-library" aria-labelledby="course-library-title">
    <h2 id="course-library-title" ref={heading} tabIndex={-1}>Exercícios da sessão</h2>
    <p>Exercícios salvos ficam disponíveis para vincular atividades Lab.</p>
    {notice && <p role="status">{notice}</p>}
    {workspace.exercises.length ? <ul className="exercise-library-list">{workspace.exercises.map(entry => <li key={exerciseKey(entry.id,entry.definition.version)}>
      <span>{entry.definition.title} · {entry.definition.version}</span>
      <div className="course-actions">
        <button className="studio-secondary" onClick={() => { loadAuthorDraft(entry.draft); router.push(labRoute("/studio/editor", "/studio/courses")); }}>Abrir</button>
        <button className="studio-secondary exercise-delete" onClick={event => { trigger.current = event.currentTarget; setNotice(""); setSelected(entry); }}>Excluir</button>
      </div>
    </li>)}</ul> : <p>Nenhum exercício salvo nesta sessão.</p>}
    <Link className="studio-secondary" href="/studio/import">Importar exercício Excel</Link>
    {selected && <DeleteExerciseDialog entry={selected} usages={exerciseUsages(workspace.courses,selected.id,selected.definition.version)}
      supported={configuration.mode === "demo"} onClose={close} onDelete={async () => {
        await execute({operation:"delete-exercise",id:selected.id,version:selected.definition.version});
        setNotice("Exercício excluído.");
      }} />}
  </section>;
}

function DeleteExerciseDialog({ entry, usages, supported, onClose, onDelete }: {
  entry: StudioExercise; usages: ExerciseUsage[]; supported: boolean; onClose: () => void; onDelete: () => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null), cancel = useRef<HTMLButtonElement>(null), busy = useRef(false);
  const [pending,setPending] = useState(false), [error,setError] = useState("");
  const [foundUsages,setFoundUsages] = useState<ExerciseUsage[]>([]);
  const links = foundUsages.length ? foundUsages : usages;
  useEffect(() => { dialog.current?.showModal(); cancel.current?.focus(); },[]);
  async function confirm() {
    if (busy.current || links.length || !supported) return;
    busy.current = true; setPending(true); setError("");
    try { await onDelete(); dialog.current?.close(); }
    catch (cause) {
      if (cause instanceof ExerciseInUseError) { setFoundUsages(cause.usages); setError(cause.message); }
      else setError("Não foi possível excluir o exercício. Tente novamente.");
    } finally { busy.current = false; setPending(false); }
  }
  return <dialog ref={dialog} className="course-delete-dialog" aria-labelledby="delete-exercise-title" aria-describedby="delete-exercise-description" aria-busy={pending}
    onKeyDown={event => {
      if (event.key !== "Tab") return;
      const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}
    onCancel={event => { if (busy.current) event.preventDefault(); }} onClose={onClose}>
    <h2 id="delete-exercise-title">Deseja excluir o exercício “{entry.definition.title}”?</h2>
    <p id="delete-exercise-description">A ação remove esta versão do exercício salvo do Studio. Não remove cursos, atividades ou respostas de alunos.</p>
    <dl><dt>Nome</dt><dd>{entry.definition.title}</dd><dt>Versão</dt><dd>{entry.definition.version}</dd><dt>Abas</dt><dd>{entry.definition.workbook.worksheets.length}</dd>
      {entry.updatedAt && <><dt>Última alteração</dt><dd><time dateTime={entry.updatedAt}>{new Date(entry.updatedAt).toLocaleString("pt-BR")}</time></dd></>}</dl>
    {!!links.length && <div role="alert"><p>Este exercício está sendo utilizado por {links.length} {links.length === 1 ? "atividade" : "atividades"} e não pode ser excluído.</p>
      <ul>{links.map(link => <li key={JSON.stringify([link.courseId,link.chapterId,link.activityId])}>{link.course} → {link.chapter} → {link.activity}</li>)}</ul>
      <p>Remova ou substitua o vínculo na atividade antes de excluir. Atividades publicadas preservam o histórico e não permitem essa troca.</p></div>}
    {!supported && <p role="status">A exclusão de exercícios no Supabase ainda não está disponível. Nenhum dado será removido.</p>}
    {error && <p role="alert">{error}</p>}
    <div className="course-actions"><button ref={cancel} className="studio-secondary" disabled={pending} onClick={() => dialog.current?.close()}>Cancelar</button>
      {!links.length && supported && <button className="studio-primary" disabled={pending} onClick={() => void confirm()}>{pending ? "Excluindo..." : "Confirmar exclusão"}</button>}</div>
  </dialog>;
}
