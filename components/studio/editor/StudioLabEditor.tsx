"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useImportJourney } from "@/components/studio/import/ImportJourney";
import { SpreadsheetEditor } from "@/components/spreadsheet/SpreadsheetEditor";
import { LabView } from "@/components/spreadsheet/LabView";
import { buildDefinition } from "@/lib/studio/exerciseDraft";
import type { ExerciseDefinition } from "@/types/exercise";
import type { Workbook } from "@/types/spreadsheet";
import { CellConfigPanel } from "./CellConfigPanel";
import { StudioToolbar } from "./StudioToolbar";
import { ExercisePreview } from "./ExercisePreview";
import { useStudioSession } from "@/components/studio/StudioSession";

import { labReturnLabel } from "@/lib/navigation/labReturn";

const ignoreSaveStatus = () => {};
export function StudioLabEditor() {
  const { authorInstance } = useImportJourney();
  return <StudioEditorSession key={authorInstance} />;
}
function StudioEditorSession() {
  const { authorDraft: draft, setAuthorDraft: setDraft, savedAuthorDraft, setSavedAuthorDraft, returnTo, importUrl } = useImportJourney();
  const { saveExercise } = useStudioSession();
  const [selection, setSelection] = useState<{ sheet: string; address: string } | null>(null);
  const [preview, setPreview] = useState<{ definition: ExerciseDefinition; test: boolean } | null>(null);
  const [error, setError] = useState("");
  const main = useRef<HTMLElement>(null);
  const workbookSnapshot = useRef<Workbook>(null);
  const definition = useMemo(() => draft ? buildDefinition(draft) : null, [draft]);
  const onWorkbook = useCallback((workbook: Workbook) => {
    setDraft(previous => !previous || JSON.stringify(previous.workbook) === JSON.stringify(workbook) ? previous : { ...previous, workbook });
  }, [setDraft]);
  const onSelection = useCallback((sheet: string, address: string) => setSelection(previous => previous?.sheet === sheet && previous.address === address ? previous : { sheet, address }), []);
  useEffect(() => { if (!preview) main.current?.focus(); }, [preview]);
  if (!draft || !definition) return <main className="studio-editor-shell"><h1>Nenhum rascunho aberto</h1><p>Importe uma planilha e abra o Studio Editor pela pré-visualização.</p><Link href={importUrl}>Importar Excel</Link> <Link href={returnTo}>← {labReturnLabel(returnTo)}</Link></main>;
  const selected = selection ?? { sheet: draft.ui?.initialSheet ?? draft.workbook.worksheets[0].id, address: "A1" };
  function openPreview(test: boolean) {
    try {
      const current = { ...draft!, workbook: workbookSnapshot.current ?? draft!.workbook };
      const student = buildDefinition(current, true);
      setDraft(current); setPreview({ definition: student, test }); setError("");
    }
    catch { setError("Revise a configuração antes de visualizar o exercício."); }
  }
  if (preview) return <main className="studio-editor-shell"><ExercisePreview definition={preview.definition} test={preview.test} onExit={() => setPreview(null)} /></main>;
  return <main className="studio-editor-shell" ref={main} tabIndex={-1} aria-label="Editor do professor">
    <StudioToolbar returnTo={returnTo} title={draft.title} points={draft.validationRules.reduce((sum, rule) => sum + (rule.points ?? 1), 0)} saved={!!savedAuthorDraft && JSON.stringify(savedAuthorDraft) === JSON.stringify(draft)}
      onSave={async () => { try {
        const current = { ...draft, workbook: workbookSnapshot.current ?? draft.workbook };
        buildDefinition(current); await saveExercise(current); try { localStorage.setItem("bi-society:last-editor",JSON.stringify([current.id,current.version])); } catch { /* Optional navigation preference. */ } setDraft(current); setSavedAuthorDraft(structuredClone(current)); setError("");
      } catch (cause) { setError(cause instanceof Error ? cause.message : "O rascunho não é válido."); } }} onPreview={() => openPreview(false)} onTest={() => openPreview(true)} />
    <p className="studio-editor-help">Salvar persiste o exercício e sua versão na biblioteca. Versões publicadas são preservadas; para alterar o Lab, salve uma nova versão e crie outra atividade.</p>
    <label>Versão do exercício<input defaultValue={draft.version} onBlur={event=>{const version=event.target.value.trim();if(version){setDraft({...draft,version});setError("");}else{event.target.value=draft.version;setError("Informe uma versão não vazia para o exercício.");}}} onKeyDown={event=>{if(event.key==="Enter")event.currentTarget.blur();}} /></label>
    {error && <p role="alert">{error}</p>}
    <div className="studio-editor-columns"><LabView><SpreadsheetEditor definition={definition} mode="author" authorSnapshotRef={workbookSnapshot} initialSession={null} initialSaveState={{ status: "idle", lastSavedAt: null }} onSaveStatus={ignoreSaveStatus} onWorkbookChange={onWorkbook} onSelectionChange={onSelection} /></LabView>
      <CellConfigPanel key={`${selected.sheet}-${selected.address}`} draft={draft} sheet={selected.sheet} address={selected.address} onChange={setDraft} />
    </div>
  </main>;
}
