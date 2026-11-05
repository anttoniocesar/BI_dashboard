"use client";
import { LabResizeHandle } from "./LabView";

import { useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type Ref } from "react";
import dynamic from "next/dynamic";
import type { ExerciseDefinition } from "@/types/exercise";
import { cloneWorkbook } from "@/lib/spreadsheet/workbook";
import { sheetBounds, workbookBounds } from "@/lib/exercises/definition";
import { useExerciseAutosave } from "@/components/storage/useExerciseAutosave";
import type { ExercisePersistenceController } from "@/lib/storage/ExercisePersistenceController";
import type { RestoredExercise, SaveState } from "@/types/exercise-session";
import { cellAddress, columnLabel, parseCellAddress } from "@/lib/spreadsheet/coordinates";
import { cellAccessibleDescription } from "@/lib/spreadsheet/cell-accessibility";
import { calculateWorkbook, displayCell } from "@/lib/spreadsheet/formula-engine";
import { CELL_CLIPBOARD_TYPE, pastedCell } from "@/lib/spreadsheet/clipboard";
import { applyCellEdit, createCellRuleResolver } from "@/lib/spreadsheet/cell-rules";
import type { CellEdit, CellPosition, Workbook } from "@/types/spreadsheet";
import { FormulaBar } from "./FormulaBar";
import { SheetTabs } from "./SheetTabs";
import { useLabDomId } from "./LabDomScope";
import { coveredByMerge, inspectMerges, mergeAnchor, mergeAt, mergeRange, moveMergedCell } from "@/lib/spreadsheet/merges";
import { useExerciseValidation } from "@/components/validation/useExerciseValidation";
import { ExerciseValidationSummary, validationStatusLabels } from "@/components/validation/ExerciseValidationSummary";
import type { CellValidationResult, ExerciseValidationResult } from "@/types/validation";

const ResultCharts = dynamic(() => import("@/components/charts/ResultCharts").then(module => module.ResultCharts), {
  ssr: false,
  loading: () => <div className="charts-loading" role="status">Carregando gráficos…</div>,
});

export function SpreadsheetEditor({ definition, initialSession, onSaveStatus, persistence, mode = "student", onWorkbookChange, onSelectionChange, authorSnapshotRef, onEvaluationChange }: {
  onEvaluationChange?: (result: ExerciseValidationResult | null) => void;
  mode?: "student" | "author"; onWorkbookChange?: (workbook: Workbook) => void; onSelectionChange?: (sheet: string, address: string) => void; authorSnapshotRef?: Ref<Workbook>;
  definition: ExerciseDefinition; initialSession: RestoredExercise | null; initialSaveState: SaveState; onSaveStatus: (state: SaveState) => void; persistence?: ExercisePersistenceController;
}) {
  const domId = useLabDomId();
  const resolveRule = useMemo(() => createCellRuleResolver(definition.cellRules), [definition]);
  const writeRule = useMemo(() => mode === "author" ? ((sheet: string, position: CellPosition) => ({ ...resolveRule(sheet, position), readOnly: false })) : resolveRule, [mode, resolveRule]);
  const validationConfig = useMemo(() => ({ rules: definition.validationRules, minimumScore: definition.completion.minimumScore }), [definition]);
  const validationTargets = useMemo(() => new Set(definition.validationRules.map(rule => `${rule.worksheetId}!${rule.cell}`)), [definition]);
  const dimensions = useMemo(() => workbookBounds(definition), [definition]);
  const [workbook, setWorkbook] = useState(() => initialSession?.workbook ?? cloneWorkbook(definition.workbook));
  const [activeSheetId, setActiveSheetId] = useState(initialSession?.activeSheet ?? definition.ui?.initialSheet ?? definition.workbook.worksheets[0].id);
  const bounds = sheetBounds(definition, activeSheetId);
  const presentation = definition.sheets?.[activeSheetId];
  const merges = useMemo(() => {
    const source=definition.workbook.worksheets.find(sheet=>sheet.id===activeSheetId)?.merges;
    return inspectMerges(Array.isArray(source)?source:[],bounds).merges;
  },[definition,activeSheetId,bounds]);
  const mergedGrid = merges.length>0;
  const charts = useMemo(() => definition.charts.filter(chart => chart.sheet === activeSheetId), [definition, activeSheetId]);
  const columnWidths = Array.from({ length: bounds.columns }, (_, column) => presentation?.columnWidths?.[columnLabel(column)]);
  const gridStyle = { "--sheet-columns": ["48px", ...columnWidths.map(width => width ? `${width}px` : "minmax(112px, 1fr)")].join(" "),
    "--sheet-min-width": `${48 + columnWidths.reduce<number>((total, width) => total + (width ?? 112), 0)}px`,
    ...(mergedGrid ? { gridTemplateRows:["29px",...Array.from({length:bounds.rows},(_,row)=>`minmax(${presentation?.rowHeights?.[String(row+1)]??31}px, auto)`)].join(" ") } : {}) } as CSSProperties;
  const [selections, setSelections] = useState<Record<string, CellPosition>>(initialSession?.selections ?? {});
  const worksheet = workbook.worksheets.find(sheet => sheet.id === activeSheetId)!;
  const data = worksheet.cells;
  const active = mergeAnchor(merges,selections[activeSheetId] ?? { row: 0, column: 0 });
  const activeMerge = mergeAt(merges,active);
  const setActive = (position: CellPosition) => { const anchor=mergeAnchor(merges,position); setSelections(previous => previous[activeSheetId]?.row === anchor.row && previous[activeSheetId]?.column === anchor.column ? previous : ({ ...previous, [activeSheetId]: anchor })); };
  const [edit, setEdit] = useState<CellEdit | null>(null);
  const formulaEditMode = !!edit?.draft.startsWith("=");
  const referenceCaret = useRef<number | null>(null);
  const calculatedWorkbook = useMemo(() => calculateWorkbook(workbook, definition.dimensions, dimensions), [workbook, definition, dimensions]);
  const calculated = calculatedWorkbook[activeSheetId];
  const cells = useRef(new Map<string, HTMLDivElement>());
  const input = useRef<HTMLInputElement>(null);
  const formulaInput = useRef<HTMLInputElement>(null);
  const activeTab = useRef<HTMLButtonElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const scrollPositions = useRef<Record<string, { top: number; left: number }>>({});
  const address = cellAddress(active);
  const activeRule = writeRule(activeSheetId, active);
  const editingAddress = edit?.source === "cell" ? cellAddress(edit.position) : null;
  const hasPendingChanges = !!edit && edit.draft !== (workbook.worksheets.find(sheet => sheet.id === edit.worksheetId)?.cells[cellAddress(edit.position)] ?? "");
  const validation = useExerciseValidation(workbook, calculatedWorkbook, validationConfig, hasPendingChanges, initialSession?.validation);
  const validatedCells = useMemo(() => new Map(validation.evaluation?.cells.map(result => [`${result.worksheetId}!${result.cell}`, result]) ?? []), [validation.evaluation]);
  // Preserve a paused draft as raw input, never merely its displayed calculation.
  const persistableWorkbook = useMemo(() => edit ? applyCellEdit(workbook, writeRule, edit.worksheetId, edit.position, edit.draft) : workbook, [workbook, edit, writeRule]);
  // Author actions can capture the latest raw input even before blur's update
  // has propagated through the parent callback. Student persistence is unchanged.
  useImperativeHandle(authorSnapshotRef, () => persistableWorkbook, [persistableWorkbook]);
  const sessionSnapshot = useMemo(() => ({ workbook: persistableWorkbook, activeSheet: activeSheetId, selections, validation: validation.checkpoint }), [persistableWorkbook, activeSheetId, selections, validation.checkpoint]);
  useExerciseAutosave(persistence, sessionSnapshot, onSaveStatus);

  useEffect(() => { if (mode === "author") onWorkbookChange?.(workbook); }, [workbook, mode, onWorkbookChange]);
  useEffect(() => { onSelectionChange?.(activeSheetId, address); }, [activeSheetId, address, onSelectionChange]);
  useEffect(() => { if (mode === "student") onEvaluationChange?.(validation.evaluation); }, [mode, validation.evaluation, onEvaluationChange]);

  useEffect(() => {
    viewport.current?.scrollTo(scrollPositions.current[activeSheetId] ?? { top: 0, left: 0 });
  }, [activeSheetId]);

  useEffect(() => {
    if (editingAddress && input.current) {
      input.current.focus();
      const end = input.current.value.length;
      input.current.setSelectionRange(end, end);
    }
  }, [editingAddress]);

  useLayoutEffect(() => {
    if (referenceCaret.current === null) return;
    const editor = edit?.source === "bar" ? formulaInput.current : input.current;
    editor?.focus();
    editor?.setSelectionRange(referenceCaret.current, referenceCaret.current);
    referenceCaret.current = null;
  }, [edit]);

  function insertReference(position: CellPosition) {
    if (!edit || !formulaEditMode) return;
    const editor = edit.source === "bar" ? formulaInput.current : input.current;
    const start = editor?.selectionStart ?? edit.draft.length;
    const end = editor?.selectionEnd ?? start;
    // Keep reference insertion separate from selection and write permissions.
    // Merged cells always refer to their anchor, including protected anchors.
    const reference = cellAddress(mergeAnchor(merges, position));
    referenceCaret.current = start + reference.length;
    setEdit({ ...edit, draft: edit.draft.slice(0, start) + reference + edit.draft.slice(end) });
  }

  function write(position: CellPosition, value: string, worksheetId = activeSheetId) {
    setWorkbook(previous => applyCellEdit(previous, writeRule, worksheetId, position, value));
  }

  function commit() {
    if (edit) write(edit.position, edit.draft, edit.worksheetId);
    setEdit(null);
  }

  function select(position: CellPosition) {
    const anchor=mergeAnchor(merges,position);
    setActive(anchor);
    cells.current.get(cellAddress(anchor))?.focus();
  }

  function move(rowDelta: number, columnDelta: number, tab = false) {
    const next=moveMergedCell(active,rowDelta,columnDelta,tab,bounds,merges);
    if(next) select(next);
  }

  function startEditing(position: CellPosition, replacement?: string) {
    position=mergeAnchor(merges,position);
    if (writeRule(activeSheetId, position).readOnly) return;
    const original = data[cellAddress(position)] ?? "";
    setActive(position);
    setEdit({ worksheetId: activeSheetId, position, draft: replacement ?? original, source: "cell" });
  }

  function verifyAnswers() {
    const next = edit ? applyCellEdit(workbook, writeRule, edit.worksheetId, edit.position, edit.draft) : workbook;
    if (next !== workbook) setWorkbook(next);
    setEdit(null);
    validation.verify(next, next === workbook ? calculatedWorkbook : calculateWorkbook(next, definition.dimensions, dimensions));
  }

  function selectFeedbackCell(result: CellValidationResult) {
    commit();
    const targetMerges=definition.workbook.worksheets.find(sheet=>sheet.id===result.worksheetId)?.merges??[];
    const target=mergeAnchor(targetMerges,parseCellAddress(result.cell, sheetBounds(definition, result.worksheetId)));
    setSelections(previous => ({ ...previous, [result.worksheetId]: target }));
    setActiveSheetId(result.worksheetId);
    requestAnimationFrame(() => cells.current.get(cellAddress(target))?.focus());
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.nativeEvent.isComposing || event.key === "Process") return;
    if (event.key === "Tab") {
      // The formula bar participates in normal document navigation, including
      // Shift+Tab back to the header. Blur/commit never removes this input.
      if (event.currentTarget === formulaInput.current) { commit(); return; }
      const atBoundary = !moveMergedCell(active,0,event.shiftKey?-1:1,true,bounds,merges);
      if (atBoundary) {
        event.preventDefault();
        commit();
        // Explicitly focus the adjacent document control: a cell editor may
        // unmount on commit, so native Tab alone would lose its starting point.
        requestAnimationFrame(() => (event.shiftKey ? formulaInput.current : activeTab.current)?.focus());
        return;
      }
      event.preventDefault(); commit(); move(0, event.shiftKey ? -1 : 1, true); return;
    }
    if (event.key === "Enter") {
      event.preventDefault(); commit(); move(event.shiftKey ? -1 : 1, 0); return;
    }
    if (event.key === "Escape" && edit) {
      event.preventDefault();
      setEdit(null);
      // Focus after the input unmounts so blur cannot commit a cancelled draft.
      requestAnimationFrame(() => cells.current.get(address)?.focus());
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      activeTab.current?.focus();
      return;
    }
    // During editing, arrows and deletion belong to the native text input.
    if (edit || event.ctrlKey || event.metaKey || event.altKey) return;
    const directions: Record<string, [number, number]> = {
      ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
    };
    if (directions[event.key]) {
      event.preventDefault(); move(...directions[event.key]);
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault(); write(active, "");
    } else if (event.key === "F2") {
      event.preventDefault(); startEditing(active);
    } else if (event.key.length === 1) {
      event.preventDefault(); startEditing(active, event.key);
    }
  }

  return (
    <div className={`spreadsheet-layout ${mode === "author" ? "author-spreadsheet" : ""}`}>
    <section className="spreadsheet" aria-label="Editor de planilha">
      <div className="sheet-toolbar"><div><span className="document-icon" aria-hidden="true">▦</span><strong>Planilha · {worksheet.name}</strong>{definition.ui?.documentLabel && <span className="document-tag">{definition.ui.documentLabel}</span>}</div>
        <div className="cell-legend" aria-label="Legenda das células">{mode === "author" ? <><span><i className="legend-provided" aria-hidden="true" />Fornecida</span><span><i className="legend-calculated" aria-hidden="true" />Calculada</span><span><i className="legend-answer" aria-hidden="true" />Editável</span><span><i className="legend-author-answer" aria-hidden="true" />Resposta</span></> : <><span><i className="legend-provided" aria-hidden="true" />Fornecido</span><span><i className="legend-answer" aria-hidden="true" />Preencher</span></>}
          {mode === "student" && validation.evaluation && <><span><i className="legend-correct" aria-hidden="true" />Correto</span><span><i className="legend-review" aria-hidden="true" />Revisar</span></>}
        </div>
      </div>
      <FormulaBar inputRef={formulaInput} address={address} value={edit?.draft ?? data[address] ?? ""} readOnly={activeRule.readOnly} answer={activeRule.role === "answer"}
        onFocus={() => { if (!activeRule.readOnly) setEdit(current => ({ worksheetId: activeSheetId, position: active, draft: current?.draft ?? data[address] ?? "", source: "bar" })); }}
        onChange={value => { if (!activeRule.readOnly) setEdit({ worksheetId: activeSheetId, position: active, draft: value, source: "bar" }); }}
        onBlur={commit} onKeyDown={onKeyDown} />
      <div ref={viewport} className="grid-viewport" style={presentation?.viewportHeight ? { height: presentation.viewportHeight } : undefined} role="tabpanel" id={domId(`sheet-${activeSheetId}`)} aria-labelledby={domId(`tab-${activeSheetId}`)}>
        <div role="grid" aria-label={`Células de ${worksheet.name}`} aria-rowcount={bounds.rows + 1} aria-colcount={bounds.columns + 1} aria-describedby={domId("keyboard-help")} className={`sheet-grid${mergedGrid ? " has-merges" : ""}`} style={gridStyle} onKeyDown={onKeyDown}
          onCopy={event => {
            if (edit) return; // Text selection inside an editor uses native clipboard behavior.
            event.preventDefault();
            const raw = data[address] ?? "";
            event.clipboardData.setData("text/plain", raw);
            event.clipboardData.setData(CELL_CLIPBOARD_TYPE, JSON.stringify({ raw, position: active, worksheetId: activeSheetId }));
          }}
          onPaste={event => {
            if (edit) return;
            event.preventDefault();
            write(active, pastedCell(event.clipboardData.getData("text/plain"), event.clipboardData.getData(CELL_CLIPBOARD_TYPE), active, bounds));
          }}>
          <div role="row" className="grid-row column-headings">
            <div role="columnheader" className="corner-cell" style={mergedGrid?{gridRow:1,gridColumn:1}:undefined} aria-label="Índices"><span /></div>
            {Array.from({ length: bounds.columns }, (_, column) => <div role="columnheader" key={column} style={mergedGrid?{gridRow:1,gridColumn:column+2}:undefined} className={`column-heading ${column >= (activeMerge?.startCol??active.column) && column <= (activeMerge?.endCol??active.column) ? "selected-heading" : ""}`}>{columnLabel(column)}</div>)}
          </div>
          {Array.from({ length: bounds.rows }, (_, row) => (
            <div role="row" className="grid-row" key={row}>
              <div role="rowheader" style={mergedGrid?{gridRow:row+2,gridColumn:1}:undefined} className={`row-heading ${row >= (activeMerge?.startRow??active.row) && row <= (activeMerge?.endRow??active.row) ? "selected-heading" : ""}`}>{row + 1}</div>
              {Array.from({ length: bounds.columns }, (_, column) => {
                const position = { row, column };
                if(coveredByMerge(merges,position)) return null;
                const merge=mergeAt(merges,position);
                const alignment=presentation?.cellAlignment?.[cellAddress(position)];
                const id = cellAddress(position);
                const selected = id === address;
                const isEditing = id === editingAddress;
                const value = displayCell(calculated[id]);
                const rule = writeRule(activeSheetId, position);
                const result = validatedCells.get(`${activeSheetId}!${id}`);
                return (
                  <div key={id} role="gridcell" aria-label={id} aria-selected={selected} aria-readonly={rule.readOnly} tabIndex={selected ? 0 : -1}
                    aria-rowindex={mergedGrid?row+2:undefined} aria-colindex={mergedGrid?column+2:undefined}
                    aria-rowspan={merge?merge.endRow-row+1:undefined} aria-colspan={merge?merge.endCol-column+1:undefined} data-merge={merge?mergeRange(merge):undefined}
                    style={{ ...(mergedGrid ? {gridRow:`${row+2} / span ${merge?merge.endRow-row+1:1}`,gridColumn:`${column+2} / span ${merge?merge.endCol-column+1:1}`} : {}),
                      ...(alignment?.horizontal ? {textAlign:alignment.horizontal} : {}), ...(alignment?.wrapText ? {whiteSpace:"pre-wrap",overflowWrap:"anywhere"} : {}),
                      ...(merge ? {justifyContent:alignment?.vertical==="middle"?"center":alignment?.vertical==="bottom"?"flex-end":"flex-start"} : {}) }}
                    aria-describedby={domId(`cell-description-${activeSheetId}-${id}`)}
                    ref={element => { if (element) cells.current.set(id, element); else cells.current.delete(id); }}
                    className={`grid-cell cell-${rule.role} ${merge?"merged-cell":""} ${result ? `validation-${result.status}` : ""} ${selected ? "active-cell" : ""} ${presentation?.headerRows?.includes(row + 1) ? "sheet-heading" : ""} ${value && Number.isFinite(Number(value)) ? "numeric-cell" : ""}`}
                    title={result ? `${validationStatusLabels[result.status]}: ${result.feedback}` : calculated[id]?.error ? `Erro na fórmula: ${calculated[id].error}` : value || undefined}
                    onFocus={event => { if (event.target === event.currentTarget) setActive(position); }}
                    onPointerDown={event => {
                      // Prevent the browser from blurring/committing the editor
                      // before click can insert at its current text selection.
                      if (formulaEditMode && event.button === 0 && event.target !== input.current) event.preventDefault();
                    }}
                    onClick={event => {
                      if (formulaEditMode && event.target !== input.current) { insertReference(position); return; }
                      if (!isEditing) { commit(); select(position); }
                    }}
                    onDoubleClick={() => { if (!formulaEditMode) startEditing(position); }}>
                    {isEditing && edit && !rule.readOnly ? <input ref={input} className="cell-editor" aria-label={`Editar ${id}`} value={edit.draft}
                      onChange={event => setEdit(current => current ? { ...current, draft: event.target.value } : null)}
                      onBlur={commit} /> : value}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <LabResizeHandle />
      {/* Referenced hidden descriptions do not create a second reading of the grid. */}
      <div hidden>
        {Array.from({ length: bounds.rows * bounds.columns }, (_, index) => {
          const position = { row: Math.floor(index / bounds.columns), column: index % bounds.columns };
          if(coveredByMerge(merges,position)) return null;
          const id = cellAddress(position);
          const role = resolveRule(activeSheetId, position).role;
          const authorRole = { provided: "Fornecida, protegida para o aluno", calculated: "Calculada, protegida para o aluno", editable: "Editável pelo aluno", answer: "Resposta do aluno" }[role];
          return <span key={id} id={domId(`cell-description-${activeSheetId}-${id}`)}>{mode === "author" ? `Valor ${displayCell(calculated[id]) || "vazio"}. ${authorRole}. Editável pelo professor.` : cellAccessibleDescription(displayCell(calculated[id]), role, validatedCells.get(`${activeSheetId}!${id}`), validationTargets.has(`${activeSheetId}!${id}`), calculated[id]?.error)}</span>;
        })}
      </div>
      <SheetTabs bounds={bounds} activeTabRef={activeTab} worksheets={workbook.worksheets} activeId={activeSheetId} onSelect={id => {
        if (viewport.current) scrollPositions.current[activeSheetId] = { top: viewport.current.scrollTop, left: viewport.current.scrollLeft };
        commit();
        setActiveSheetId(id);
      }} />
      <div className="sheet-status"><span><span className="status-dot" />{edit ? "Editando" : "Pronto"}</span><p id={domId("keyboard-help")}><kbd>Enter</kbd> confirmar <span>·</span> <kbd>Tab</kbd> avançar; nos limites, sair <span>·</span> Setas para navegar <span>·</span> Duplo clique ou <kbd>F2</kbd> editar <span>·</span> <kbd>Ctrl+C / Ctrl+V</kbd> copiar célula <span>·</span> <kbd>Esc</kbd> cancelar edição ou ir à aba ativa</p></div>
    </section>
    {mode === "student" && <ExerciseValidationSummary worksheets={workbook.worksheets} evaluation={validation.evaluation} hasPreviousCheck={validation.hasPreviousCheck} onVerify={verifyAnswers} onSelectCell={selectFeedbackCell} />}
    {!!charts.length && <ResultCharts calculatedWorkbook={calculatedWorkbook} charts={charts} presentation={presentation?.charts} />}
    </div>
  );
}
