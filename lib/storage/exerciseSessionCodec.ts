import type { ExerciseDefinition } from "@/types/exercise";
import { sheetBounds } from "@/lib/exercises/definition";
import { cloneWorkbook } from "@/lib/spreadsheet/workbook";
import { applyCellEdit, createCellRuleResolver } from "../spreadsheet/cell-rules";
import { cellAddress, normalizeCellAddress, parseCellAddress, positionInBounds } from "../spreadsheet/coordinates";
import type { ExerciseSession, ExerciseSnapshot, RestoredExercise } from "../../types/exercise-session";

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

export function serializeExercise(definition: ExerciseDefinition, snapshot: ExerciseSnapshot, lastSavedAt = new Date().toISOString()): ExerciseSession {
  const resolve = createCellRuleResolver(definition.cellRules);
  const cells: ExerciseSession["cells"] = [];
  for (const sheet of snapshot.workbook.worksheets) {
    const bounds = sheetBounds(definition, sheet.id);
    for (let row = 0; row < bounds.rows; row++) for (let column = 0; column < bounds.columns; column++) {
      if (!resolve(sheet.id, { row, column }).readOnly) {
        const address = cellAddress({ row, column });
        const raw = sheet.cells[address] ?? "";
        const original = definition.workbook.worksheets.find(source => source.id === sheet.id)?.cells[address] ?? "";
        if (raw !== "" || original !== "") cells.push({ worksheetId: sheet.id, address, raw });
      }
    }
  }
  return { version: 1, exerciseId: definition.id, exerciseVersion: definition.version, cells, activeSheet: snapshot.activeSheet,
    selections: snapshot.selections, validation: snapshot.validation, lastSavedAt };
}

export function deserializeExercise(definition: ExerciseDefinition, value: unknown): RestoredExercise | null {
  if (!record(value)) return null;
  const currentIdentity = value.exerciseId === definition.id && value.exerciseVersion === definition.version;
  const legacyIdentity = definition.persistence?.legacyExerciseId !== undefined && value.exerciseId === definition.persistence.legacyExerciseId && value.exerciseVersion === undefined;
  const ids = new Set(definition.workbook.worksheets.map(sheet => sheet.id));
  const maxCells = definition.workbook.worksheets.reduce((count, sheet) => { const b = sheetBounds(definition, sheet.id); return count + b.rows * b.columns; }, 0);
  if (value.version !== 1 || (!currentIdentity && !legacyIdentity) || typeof value.activeSheet !== "string" || !ids.has(value.activeSheet) ||
      typeof value.validation !== "string" || !["never", "verified", "unverified"].includes(value.validation) ||
      typeof value.lastSavedAt !== "string" || !Number.isFinite(Date.parse(value.lastSavedAt)) ||
      !Array.isArray(value.cells) || value.cells.length > maxCells || !record(value.selections)) return null;
  const selections: ExerciseSnapshot["selections"] = {};
  for (const [id, selected] of Object.entries(value.selections)) {
    if (!ids.has(id) || !record(selected) || typeof selected.row !== "number" || typeof selected.column !== "number" || !positionInBounds({ row: selected.row, column: selected.column }, sheetBounds(definition, id))) return null;
    selections[id] = { row: selected.row, column: selected.column };
  }
  const resolve = createCellRuleResolver(definition.cellRules);
  let workbook = cloneWorkbook(definition.workbook);
  const seen = new Set<string>();
  for (const cell of value.cells) {
    if (!record(cell) || typeof cell.worksheetId !== "string" || !ids.has(cell.worksheetId) || typeof cell.address !== "string" || typeof cell.raw !== "string") return null;
    try {
      const selected = parseCellAddress(cell.address, sheetBounds(definition, cell.worksheetId));
      const key = `${cell.worksheetId}!${cell.address}`;
      if (normalizeCellAddress(cell.address) !== cell.address || resolve(cell.worksheetId, selected).readOnly || seen.has(key)) return null;
      seen.add(key);
      workbook = applyCellEdit(workbook, resolve, cell.worksheetId, selected, cell.raw);
    } catch { return null; }
  }
  return { workbook, activeSheet: value.activeSheet, selections, validation: value.validation as ExerciseSnapshot["validation"], lastSavedAt: value.lastSavedAt };
}

