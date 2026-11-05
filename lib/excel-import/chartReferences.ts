import { cellAddress, parseCellRange } from "../spreadsheet/coordinates";
import { importedSheetId } from "./sheetIdentity";
import type { ImportedWorksheet } from "./types";

/** Only a single local worksheet and a bounded one-dimensional A1 range.
 * Never evaluate formulas, defined names, unions or external workbook links. */
export function parseChartReference(formula: string, sheets: Pick<ImportedWorksheet, "name" | "dimensions">[]) {
  const match = /^(?:'((?:[^']|'')+)'|([^'!\[\]]+))!(\$?[A-Z]+\$?[1-9]\d*(?::\$?[A-Z]+\$?[1-9]\d*)?)$/i.exec(formula.trim().replace(/^=/, ""));
  if (!match) throw new Error(`Referência de gráfico não suportada: ${formula}.`);
  const name = (match[1]?.replace(/''/g, "'") ?? match[2]);
  const sheet = sheets.find(sheet => sheet.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"));
  if (!sheet) throw new Error(`Aba de origem do gráfico ausente: ${name}.`);
  const { from, to } = parseCellRange(match[3], sheet.dimensions);
  if (from.row !== to.row && from.column !== to.column) throw new Error("Intervalo de gráfico deve ser unidimensional.");
  return { sheet: importedSheetId(sheet.name), sheetName: sheet.name, range: from.row === to.row && from.column === to.column ? cellAddress(from) : `${cellAddress(from)}:${cellAddress(to)}`,
    length: (to.row - from.row + 1) * (to.column - from.column + 1) };
}
