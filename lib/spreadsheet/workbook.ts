import type { ReadonlyWorkbook, Workbook } from "@/types/spreadsheet";

export function cloneWorkbook(master: ReadonlyWorkbook): Workbook {
  return { worksheets: master.worksheets.map(({merges,...sheet}) => ({ ...sheet, cells: { ...sheet.cells }, ...(merges ? { merges:merges.map(merge=>({...merge})) } : {}) })) };
}
export function freezeWorkbook(workbook: ReadonlyWorkbook): ReadonlyWorkbook {
  for (const sheet of workbook.worksheets) { Object.freeze(sheet.cells); if(sheet.merges) {sheet.merges.forEach(Object.freeze);Object.freeze(sheet.merges);} Object.freeze(sheet); }
  Object.freeze(workbook.worksheets);
  return Object.freeze(workbook);
}
