"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { labRoute, safeLabReturn } from "@/lib/navigation/labReturn";
import type { ExerciseDraft } from "@/types/exercise-draft";
import { createDraft } from "@/lib/studio/exerciseDraft";
import type { ExerciseDefinition } from "@/types/exercise";
import type { ImportResult, NormalizedWorkbook } from "@/lib/excel-import/types";
import { IMPORT_LIMITS } from "@/lib/excel-import/limits";
import { DEFAULT_IMPORT_OPTIONS, reviewImport, type ImportOptions } from "@/lib/excel-import/reviewImport";
import { createExerciseDefinitionFromImport } from "@/lib/excel-import/createExerciseDefinitionFromImport";
import { VolatileExerciseRepository } from "@/lib/storage/VolatileExerciseRepository";
import { useStudioSession } from "@/components/studio/StudioSession";

function useJourneyState() {
  const router = useRouter();
  const { workspace, ready } = useStudioSession();
  const params = useSearchParams();
  const explicitReturn = params.getAll("returnTo").length === 1 ? safeLabReturn(params.get("returnTo")) : null;
  const returnTo = explicitReturn ?? "/studio/courses";
  const importUrl = explicitReturn ? labRoute("/studio/import", returnTo) : "/studio/import";
  const previewUrl = explicitReturn ? labRoute("/studio/import/preview", returnTo) : "/studio/import/preview";
  const [authorInstance, setAuthorInstance] = useState(0);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [previewSheet, setPreviewSheet] = useState("");
  const [options, setOptions] = useState<ImportOptions>({ ...DEFAULT_IMPORT_OPTIONS });
  const [draft, setDraft] = useState<{ definition: ExerciseDefinition; workbook: NormalizedWorkbook } | null>(null);
  const [authorDraft, setAuthorDraft] = useState<ExerciseDraft | null>(null);
  const [savedAuthorDraft, setSavedAuthorDraft] = useState<ExerciseDraft | null>(null);
  const repository = useMemo(() => new VolatileExerciseRepository(), []);
  const operation = useRef(0), inFlight = useRef(false), abort = useRef<AbortController | null>(null);
  const opening = useRef(false);
  useEffect(() => {
    if (!ready || authorDraft) return;
    try { const raw = localStorage.getItem("bi-society:last-editor"); const selected = raw ? JSON.parse(raw) as [string,string] : null; const entry = selected ? workspace.exercises.find(entry=>entry.id===selected[0] && entry.definition.version===selected[1]) : undefined;
      if (entry) { setAuthorDraft(structuredClone(entry.draft)); setSavedAuthorDraft(structuredClone(entry.draft)); setAuthorInstance(value=>value+1); }
    } catch { /* UI preference only; the saved draft is available in the library. */ }
  },[ready,workspace.exercises,authorDraft]);

  function invalidate() { operation.current++; abort.current?.abort(); abort.current = null; inFlight.current = false; }
  useEffect(() => () => { invalidate(); repository.discard(); }, [repository]);
  function reset() {
    invalidate(); repository.discard(); opening.current = false;
    setFile(null); setResult(null); setError(""); setBusy(false); setStep(1); setDraft(null); setAuthorDraft(null); setSavedAuthorDraft(null);
    setSelected([]); setPreviewSheet(""); setOptions({ ...DEFAULT_IMPORT_OPTIONS });
  }
  function choose(files: File[]) {
    reset();
    const candidate = files[0];
    if (files.length !== 1 || !candidate) { setError("Selecione um único arquivo Excel para analisar."); return; }
    if (!/\.xlsx$/i.test(candidate.name)) { setError("Formato não suportado. Selecione um arquivo .xlsx."); return; }
    if (!candidate.size) { setError("O arquivo está vazio. Selecione outro arquivo."); return; }
    if (candidate.size > IMPORT_LIMITS.fileBytes) { setError("O arquivo excede o tamanho máximo de 2 MiB."); return; }
    setFile(candidate);
  }
  async function analyze() {
    if (inFlight.current) return;
    if (!file) { setError("Selecione um arquivo Excel para analisar."); return; }
    const current = ++operation.current;
    const controller = new AbortController();
    abort.current = controller; inFlight.current = true;
    setBusy(true); setError(""); setResult(null); setDraft(null); setStep(2);
    try {
      const response = await fetch("/api/studio/import", { method: "POST", body: file, signal: controller.signal,
        headers: { "X-File-Name": encodeURIComponent(file.name), "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }, cache: "no-store" });
      const analysis = await response.json() as ImportResult;
      if (current !== operation.current) return;
      if (!analysis || typeof analysis.ok !== "boolean" || !analysis.report || !Array.isArray(analysis.report.items) || (analysis.ok && (!analysis.workbook || !Array.isArray(analysis.workbook.worksheets) || !analysis.workbook.worksheets.length))) throw new Error("Resposta inválida.");
      setResult(analysis);
      if (analysis.ok) { setSelected(analysis.workbook.worksheets.map(sheet => sheet.id)); setPreviewSheet(analysis.workbook.worksheets[0].id); }
    } catch {
      if (current === operation.current && !controller.signal.aborted) setError("Não foi possível concluir a análise. Verifique a conexão e tente novamente.");
    } finally {
      if (current === operation.current) { inFlight.current = false; setBusy(false); abort.current = null; }
    }
  }
  function toggleSheet(id: string) {
    setError(""); setDraft(null);
    if (selected.includes(id) && selected.length === 1) { setError("Pelo menos uma aba deve permanecer selecionada."); return; }
    setSelected(previous => previous.includes(id) ? previous.filter(value => value !== id) : [...previous, id]);
  }
  const reviewed = useMemo(() => result?.ok ? reviewImport(result.workbook, selected, options) : null, [result, selected, options]);
  function openDraft() {
    if (opening.current) return;
    if (!reviewed?.ok) { setError("Revise a seleção de abas e as referências antes de abrir no Lab."); return; }
    opening.current = true;
    try {
      const definition = createExerciseDefinitionFromImport(reviewed.workbook, { id: `import-${Date.now()}-${crypto.randomUUID()}`, version: "0.1-draft", title: file?.name });
      definition.ui = { ...definition.ui, documentLabel: "RASCUNHO", eyebrow: "PRÉ-VISUALIZAÇÃO DO PROFESSOR" };
      repository.discard();
      setDraft({ definition, workbook: reviewed.workbook });
      setAuthorDraft(null); setSavedAuthorDraft(null);
      router.push(previewUrl);
    } catch { setError("Não foi possível criar o rascunho. Revise a análise antes de continuar."); }
    finally { opening.current = false; }
  }
  return { returnTo, importUrl, previewUrl, step, setStep, file, result, error, busy, selected, previewSheet, setPreviewSheet, options, setOptions,
    authorDraft, setAuthorDraft, savedAuthorDraft, setSavedAuthorDraft, authorInstance,
    loadAuthorDraft: (next: ExerciseDraft) => {
      try { localStorage.setItem("bi-society:last-editor",JSON.stringify([next.id,next.version])); } catch { /* UI preference only. */ }
      setAuthorDraft(structuredClone(next)); setSavedAuthorDraft(structuredClone(next)); setAuthorInstance(value => value + 1);
    },
    openEditor: () => { if (draft) {
      if (!authorDraft || authorDraft.id !== draft.definition.id) { setAuthorDraft(createDraft(draft.definition, draft.workbook)); setSavedAuthorDraft(null); setAuthorInstance(value => value + 1); }
      router.push(labRoute("/studio/editor", explicitReturn ?? previewUrl));
    } },
    reviewed, draft, repository, reset, choose, analyze, toggleSheet, openDraft };
}

type Journey = ReturnType<typeof useJourneyState>;
const JourneyContext = createContext<Journey | null>(null);
export function ImportJourneyProvider({ children }: { children: React.ReactNode }) {
  const journey = useJourneyState();
  return <JourneyContext.Provider value={journey}>{children}</JourneyContext.Provider>;
}
export function useImportJourney() {
  const journey = useContext(JourneyContext);
  if (!journey) throw new Error("Jornada de importação ausente.");
  return journey;
}
