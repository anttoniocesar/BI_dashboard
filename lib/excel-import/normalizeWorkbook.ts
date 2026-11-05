import { analyzeFormula } from "./compatibility";
import type { ImportedWorkbook, NormalizedWorkbook } from "./types";
import { importedSheetId } from "./sheetIdentity";

/** Injective UTF-8 encoding: stable across sheet order, safe as an internal ID. */
export { importedSheetId } from "./sheetIdentity";

export function normalizeWorkbook(workbook: ImportedWorkbook): NormalizedWorkbook {
  const styles: NormalizedWorkbook["styles"] = {};
  const styleIds = new Map<string, string>();
  const worksheets = workbook.worksheets.map(sheet => ({
    ...sheet, id: importedSheetId(sheet.name),
    cells: Object.fromEntries(sheet.cells.map(cell => {
      const { style, formula, ...content } = cell;
      let styleId: string | undefined;
      if (style) {
        const serialized = JSON.stringify(style);
        styleId = styleIds.get(serialized);
        if (!styleId) { styleId = `style-${styleIds.size + 1}`; styleIds.set(serialized, styleId); styles[styleId] = JSON.parse(serialized); }
      }
      return [cell.address, { ...content, styleId, formula: formula ? analyzeFormula(formula, workbook, sheet.name) : undefined }];
    })),
  }));
  return { ...workbook, schemaVersion: 1, worksheets, styles };
}
