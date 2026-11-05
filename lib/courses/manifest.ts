import type { ExerciseDefinition } from "../../types/exercise";
import { sheetBounds } from "../exercises/definition";
import { createCellRuleResolver } from "../spreadsheet/cell-rules";
import { cellAddress } from "../spreadsheet/coordinates";
import {DataError} from "../data/http";
import {IMPORT_LIMITS} from "../excel-import/limits";
export function exerciseManifest(definition: ExerciseDefinition) {
  const allowedCells: string[] = [], sheets: Record<string,{rows:number;columns:number}> = {};
  const resolve = createCellRuleResolver(definition.cellRules);
  const area=definition.workbook.worksheets.reduce((sum,sheet)=>{const bounds=sheetBounds(definition,sheet.id);return sum+bounds.rows*bounds.columns;},0);
  if(definition.workbook.worksheets.length>IMPORT_LIMITS.sheets || area>IMPORT_LIMITS.gridCells)throw new DataError("Exercício excede os limites de abas/área suportados para autoria persistente.");
  for (const sheet of definition.workbook.worksheets) {
    const bounds = sheetBounds(definition,sheet.id); sheets[sheet.id] = bounds;
    for (let row=0;row<bounds.rows;row++) for (let column=0;column<bounds.columns;column++) if (!resolve(sheet.id,{row,column}).readOnly) allowedCells.push(`${sheet.id}!${cellAddress({row,column})}`);
  }
  return {allowedCells,sheets};
}
