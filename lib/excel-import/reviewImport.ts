import { lex } from "fast-formula-parser/grammar/lexing";
import { analyzeFormula, compatibilityReport, makeReport } from "./compatibility";
import type { ImportIssue, ImportResult, NormalizedCell, NormalizedWorkbook } from "./types";

export type ImportOptions = { values: boolean; formulas: boolean; formatting: boolean };
export const DEFAULT_IMPORT_OPTIONS: ImportOptions = { values: true, formulas: true, formatting: true };

/** Pure review projection; never changes the original analysis or infers pedagogical roles. */
export function reviewImport(source: NormalizedWorkbook, selectedIds: string[], options: ImportOptions): ImportResult {
  const selected = new Set(selectedIds);
  if (!selected.size || selected.size !== selectedIds.length || selectedIds.some(id => !source.worksheets.some(sheet => sheet.id === id))) {
    return { ok: false, report: makeReport([{ level: "ERROR", code: "SHEET_SELECTION", message: "Selecione ao menos uma aba válida para importar." }]) };
  }
  const removed = source.worksheets.filter(sheet => !selected.has(sheet.id));
  const issues: ImportIssue[] = [];
  const worksheets = source.worksheets.filter(sheet => selected.has(sheet.id)).map(sheet => ({
    ...sheet,
    merges: options.formatting ? [...sheet.merges] : [],
    mergeIssues: options.formatting ? sheet.mergeIssues : [],
    columns: sheet.columns.map(column => options.formatting ? { ...column } : { index: column.index }),
    rows: sheet.rows.map(row => options.formatting ? { ...row } : { index: row.index }),
    cells: Object.fromEntries(Object.entries(sheet.cells).map(([address, cell]) => {
      const omit = cell.formula ? !options.formulas : !options.values;
      const next: NormalizedCell = { ...cell, ...(omit ? { kind: "blank", value: null, formula: undefined, hyperlink: undefined } : {}),
        styleId: options.formatting ? cell.styleId : undefined };
      if (next.formula && !next.formula.blocked && removed.length) {
        try {
          const missingReferences = new Set<string>();
          for (const token of lex(next.formula.expression.slice(1)).tokens) {
            if (!["Sheet", "SheetQuoted"].includes(token.tokenType.name)) continue;
            const name = token.image.slice(0, -1).replace(/^'|'$/g, "").replace(/''/g, "'");
            const missing = removed.find(missing => missing.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"));
            if (missing) missingReferences.add(missing.name);
          }
          for (const name of missingReferences) issues.push({ level: "ERROR", code: "REMOVED_SHEET_REFERENCE", sheet: sheet.name, cell: address,
            message: `${sheet.name}!${address} referencia a aba desmarcada “${name}”. Inclua essa aba ou desmarque a opção Fórmulas.` });
        } catch {
          issues.push({ level: "ERROR", code: "UNRESOLVED_SHEET_REFERENCE", sheet: sheet.name, cell: address,
            message: `Não foi possível verificar as referências de ${sheet.name}!${address}. Mantenha todas as abas ou desmarque Fórmulas.` });
        }
      }
      return [address, next];
    })),
  }));
  const charts = source.charts.filter(chart => !chart.sheetName || worksheets.some(sheet => sheet.name === chart.sheetName)).map(chart => {
    const next = structuredClone(chart), def = next.definition;
    if (def) {
      const referenced = [def.sheet, def.xSheet, def.titleRef?.sheet, ...def.series.flatMap(series => [series.sheet, series.xSheet, series.nameRef?.sheet])].filter((id): id is string => !!id);
      if (referenced.some(id => !selected.has(id))) {
        next.definition = undefined; next.compatibility = "UNSUPPORTED";
        next.reasons.push("Gráfico omitido: uma aba de origem dos dados foi desmarcada. Inclua essa aba para preservar o gráfico.");
      }
    }
    return next;
  });
  const workbook: NormalizedWorkbook = { ...source, worksheets, charts, styles: options.formatting ? { ...source.styles } : {} };
  const rawWorkbook = { ...workbook, worksheets: worksheets.map(sheet => ({ ...sheet, cells: Object.values(sheet.cells) })) };
  for (const sheet of worksheets) for (const cell of Object.values(sheet.cells)) if (cell.formula) {
    cell.formula = analyzeFormula(cell.formula, rawWorkbook, sheet.name);
  }
  if (removed.length) issues.push({ level: "WARNING", code: "SHEETS_OMITTED", message: `${removed.length} aba(s) desmarcada(s) serão excluídas do rascunho.` });
  if (!options.values) issues.push({ level: "WARNING", code: "VALUES_OMITTED", message: "Valores de origem serão omitidos. Fórmulas mantidas podem produzir resultados diferentes ao referenciar células vazias." });
  if (!options.formulas) issues.push({ level: "WARNING", code: "FORMULAS_OMITTED", message: "Fórmulas serão omitidas, sem usar resultados em cache como valores." });
  if (!options.formatting) issues.push({ level: "WARNING", code: "FORMATTING_OMITTED", message: "Estilos, larguras, alturas e mesclagens não serão preservados neste rascunho." });
  const report = makeReport([...compatibilityReport(workbook).items, ...issues], workbook);
  return report.errors ? { ok: false, report } : { ok: true, workbook, report };
}
