import { createInitialWorkbook, COLUMN_COUNT, ROW_COUNT } from "./neural-network-demo";
import { exerciseCellRules } from "./cell-rules";
import { createCellRuleResolver } from "../lib/spreadsheet/cell-rules";
import { cellAddress } from "../lib/spreadsheet/coordinates";
import type { Workbook } from "../types/spreadsheet";
import { cloneWorkbook, freezeWorkbook } from "../lib/spreadsheet/workbook";

const resolve = createCellRuleResolver(exerciseCellRules);
const template = createInitialWorkbook();
for (const sheet of template.worksheets) {
  for (let row = 0; row < ROW_COUNT; row++) for (let column = 0; column < COLUMN_COUNT; column++) {
    if (!resolve(sheet.id, { row, column }).readOnly) delete sheet.cells[cellAddress({ row, column })];
  }
}
/** Runtime-frozen template. Student edits always operate on independent copies. */
export const masterWorkbook = freezeWorkbook(template);
export function createStudentWorkbook(): Workbook {
  return cloneWorkbook(masterWorkbook);
}
