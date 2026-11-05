"use client";

import { useEffect, useMemo, useState } from "react";
import { deserializeExercise } from "@/lib/storage/exerciseSessionCodec";
import { ExercisePersistenceController } from "@/lib/storage/ExercisePersistenceController";
import type { ExercisePersistenceContext, ExerciseRepository } from "@/types/exercise-repository";
import type { RestoredExercise, SaveState } from "@/types/exercise-session";
import { SpreadsheetEditor } from "@/components/spreadsheet/SpreadsheetEditor";
import { LabView } from "@/components/spreadsheet/LabView";
import { SaveStatus } from "./SaveStatus";
import { useLabDomId } from "@/components/spreadsheet/LabDomScope";
import { ResetExerciseButton } from "./ResetExerciseButton";
import type { ExerciseDefinition } from "@/types/exercise";
import { validateExerciseDefinition } from "@/lib/exercises/definition";
import { freezeWorkbook } from "@/lib/spreadsheet/workbook";
import type { ExerciseValidationResult } from "@/types/validation";

type LabProps = { definition: ExerciseDefinition; repository: ExerciseRepository; userId?: string; attemptId?: string; embedded?: boolean; onEvaluationChange?: (result: ExerciseValidationResult | null) => void };

export function ExerciseLab({ definition, repository, userId, attemptId, embedded, onEvaluationChange }: LabProps) {
  useMemo(() => { validateExerciseDefinition(definition); freezeWorkbook(definition.workbook); }, [definition]);
  return <ExerciseSessionLab key={JSON.stringify([definition.id, definition.version, userId, attemptId])} definition={definition} repository={repository} userId={userId} attemptId={attemptId} embedded={embedded} onEvaluationChange={onEvaluationChange} />;
}

function ExerciseSessionLab({ definition, repository, userId, attemptId, embedded, onEvaluationChange }: LabProps) {
  const domId = useLabDomId();
  const Heading = embedded ? "h3" : "h1";
  const [loaded, setLoaded] = useState(false);
  const [session, setSession] = useState<RestoredExercise | null>(null);
  const [generation, setGeneration] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle", lastSavedAt: null });
  const [persistence, setPersistence] = useState<ExercisePersistenceController>();
  const [loadError, setLoadError] = useState(false);
  const [reload, setReload] = useState(0);
  const context = useMemo<ExercisePersistenceContext>(() => ({ exerciseId: definition.id, exerciseVersion: definition.version, userId, attemptId }), [definition.id, definition.version, userId, attemptId]);
  useEffect(() => {
    let cancelled = false;
    let controller: ExercisePersistenceController | undefined;
    setLoaded(false);
    setLoadError(false);
    async function load() {
      let restored: RestoredExercise | null = null;
      let error = false;
      try {
        const stored = await repository.load(context);
        if (stored) { restored = deserializeExercise(definition, stored); if (!restored && repository.requireSuccessfulLoad) throw new Error("Tentativa incompatível com a definição."); }
      } catch { error = true; }
      if (cancelled) return;
      if (error && repository.requireSuccessfulLoad) { setLoadError(true); return; }
      const state: SaveState = { status: error ? "error" : restored ? "saved" : "idle", lastSavedAt: restored?.lastSavedAt ?? null };
      controller = new ExercisePersistenceController(definition, repository, context, state);
      setSession(restored);
      setSaveState(state);
      setPersistence(controller);
      setGeneration(value => value + 1);
      setLoaded(true);
    }
    void load();
    return () => { cancelled = true; controller?.dispose(); };
  }, [definition, repository, context, reload]);
  async function reset() {
    if (!persistence) return false;
    try { await persistence.clear(); } catch { return false; }
    setSession(null);
    setSaveState({ status: "idle", lastSavedAt: null });
    setGeneration(value => value + 1);
    return true;
  }
  return <LabView heading={<>
    {loadError && <div role="alert"><p>Não foi possível recuperar sua tentativa. Tente novamente antes de editar.</p><button type="button" onClick={() => setReload(value => value + 1)}>Tentar carregar novamente</button></div>}
    <div className="workspace-heading">
      <div><div className="eyebrow">{definition.ui?.eyebrow ?? "LABORATÓRIO INTERATIVO"}{definition.ui?.documentLabel && <><span> / </span>{definition.ui.documentLabel}</>}</div><Heading id={domId("lab-title")}>BI.Society <span>Lab</span></Heading><p>{definition.title}</p>{definition.subtitle && <p>{definition.subtitle}</p>}</div>
      {loaded ? <div className="session-actions"><SaveStatus state={saveState} />{repository.requireSuccessfulLoad && saveState.status === "error" && <button type="button" onClick={() => persistence?.retry()}>Tentar salvar novamente</button>}<ResetExerciseButton onReset={reset} triggerLabel={embedded ? "Reiniciar planilha" : undefined} /></div> : !loadError && <span role="status">Carregando exercício...</span>}
    </div>
    </>}>
    {loaded && <SpreadsheetEditor key={generation} definition={definition} initialSession={session} initialSaveState={saveState} onSaveStatus={setSaveState} persistence={persistence} onEvaluationChange={onEvaluationChange} />}
  </LabView>;
}
