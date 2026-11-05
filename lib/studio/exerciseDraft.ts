import type { ExerciseDefinition } from "@/types/exercise";
import type { ExerciseDraft } from "@/types/exercise-draft";
import type { NormalizedWorkbook } from "@/lib/excel-import/types";
import type { CellRole } from "@/types/cell-rules";
import { freezeWorkbook, cloneWorkbook } from "@/lib/spreadsheet/workbook";
import { createCellRuleResolver } from "@/lib/spreadsheet/cell-rules";
import { parseCellAddress, rangeAddresses } from "@/lib/spreadsheet/coordinates";
import { sheetBounds, validateExerciseDefinition } from "@/lib/exercises/definition";

export function createDraft(definition: ExerciseDefinition, importedWorkbook?: NormalizedWorkbook): ExerciseDraft {
  validateExerciseDefinition(definition);
  return structuredClone({ ...definition, workbook: cloneWorkbook(definition.workbook), version: "0.1-draft", importedWorkbook });
}

export function buildDefinition(draft: ExerciseDraft, student = false): ExerciseDefinition {
  const { importedWorkbook: _metadata, ...definition } = structuredClone(draft);
  if (student) {
    const resolve = createCellRuleResolver(definition.cellRules);
    for (const sheet of definition.workbook.worksheets) {
      for (const address of Object.keys(sheet.cells)) {
        if (resolve(sheet.id, parseCellAddress(address)).role === "answer") delete sheet.cells[address];
      }
    }
  }
  validateExerciseDefinition(definition);
  return { ...definition, workbook: freezeWorkbook(definition.workbook) };
}

/** Uses existing cell overrides/precedence; changing away from answer removes its evaluator. */
export function applyDraftRole(draft: ExerciseDraft, sheetId: string, range: string, role: CellRole): ExerciseDraft {
  const addresses = rangeAddresses(range, sheetBounds(draft, sheetId));
  if (!draft.workbook.worksheets.some(sheet => sheet.id === sheetId)) throw new Error("Aba inexistente.");
  const next = structuredClone(draft);
  const sheet = next.cellRules[sheetId] ?? { default: "provided" };
  sheet.cells = { ...sheet.cells, ...Object.fromEntries(addresses.map(address => [address, role])) };
  next.cellRules[sheetId] = sheet;
  if (role !== "answer") next.validationRules = next.validationRules.filter(rule => rule.worksheetId !== sheetId || !addresses.includes(rule.cell));
  buildDefinition(next);
  return next;
}
