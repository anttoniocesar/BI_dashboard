"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { ExerciseLab } from "@/components/storage/ExerciseLab";
import { useImportJourney } from "./ImportJourney";
import { ImportStepper } from "./ImportStepper";
import { labReturnLabel } from "@/lib/navigation/labReturn";

export function ImportLabPreview() {
  const { draft, repository, reset, setStep, openEditor, returnTo, importUrl } = useImportJourney();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  if (!draft) return <section className="studio-panel studio-empty-preview"><h1 ref={heading} tabIndex={-1}>Não há uma importação nesta sessão</h1><p>Selecione e analise um arquivo para abrir uma pré-visualização.</p><Link className="studio-primary" href={importUrl}>Selecionar arquivo Excel</Link> <Link href={returnTo}>← {labReturnLabel(returnTo)}</Link></section>;
  return <>
    <ImportStepper step={4} />
    <section className="studio-preview-banner" aria-labelledby="studio-preview-title"><div><span className="studio-draft-tag">Rascunho · {draft.definition.version}</span><h2 ref={heading} tabIndex={-1} id="studio-preview-title">Pré-visualização da importação</h2><p>Disponível apenas nesta jornada. Sair ou atualizar a página descarta a importação. Nada foi publicado.</p></div>
      <nav aria-label="Ações da pré-visualização"><Link href={importUrl} onClick={() => setStep(3)}>← Voltar à revisão</Link><Link href={importUrl} onClick={reset}>Cancelar importação</Link><Link href={returnTo}>← {labReturnLabel(returnTo)}</Link><button type="button" className="studio-primary" onClick={openEditor}>Abrir no Studio Editor</button></nav>
    </section>
    <section className="studio-lab-preview" aria-labelledby="lab-title"><ExerciseLab definition={draft.definition} repository={repository} /></section>
  </>;
}
