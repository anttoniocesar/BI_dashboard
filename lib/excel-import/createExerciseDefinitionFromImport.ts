import type { ExerciseDefinition } from "@/types/exercise";
import { validateExerciseDefinition } from "@/lib/exercises/definition";
import { freezeWorkbook } from "@/lib/spreadsheet/workbook";
import type { NormalizedCell, NormalizedWorkbook } from "./types";
import { inspectMerges } from "@/lib/spreadsheet/merges";
import { importedSheetPresentation } from "./presentation";

const quotedText = (text: string) => `="${text.replace(/"/g, '""')}"`;
function labRaw(cell: NormalizedCell): string {
  if (cell.mergedInto) return "";
  if (cell.formula) return cell.formula.blocked ? quotedText(cell.formula.expression) : cell.formula.expression;
  if (cell.kind === "blank" || cell.mergedInto) return "";
  if (cell.kind === "boolean") return cell.value ? "=TRUE" : "=FALSE";
  const raw = String(cell.value ?? "");
  // Protect text starting '=' and numeric text from accidental formula/type conversion.
  return cell.kind === "text" && (raw.startsWith("=") || /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw.trim())) ? quotedText(raw) : raw;
}

export function createExerciseDefinitionFromImport(workbook: NormalizedWorkbook, options: { id: string; version: string; title?: string; cellPolicy?: "provided" | "editable" }): ExerciseDefinition {
  const definition: ExerciseDefinition = {
    id: options.id, version: options.version,
    title: options.title ?? workbook.fileName.replace(/\.xlsx$/i, ""),
    subtitle: "Importação técnica — sem configuração pedagógica ou avaliação.",
    workbook: freezeWorkbook({ worksheets: workbook.worksheets.map(sheet => ({ id: sheet.id, name: sheet.name, merges:inspectMerges(sheet.merges,sheet.dimensions).merges, cells: Object.fromEntries(Object.entries(sheet.cells).map(([address, cell]) => [address, labRaw(cell)])) })) }),
    dimensions: workbook.worksheets[0]?.dimensions ?? { rows: 1, columns: 1 },
    sheets: Object.fromEntries(workbook.worksheets.map(sheet => [sheet.id, importedSheetPresentation(sheet,workbook.styles)])),
    cellRules: Object.fromEntries(workbook.worksheets.map(sheet => [sheet.id, { default: options.cellPolicy ?? "provided" }])),
    validationRules: [], charts: workbook.charts.flatMap(chart => chart.definition ? [structuredClone(chart.definition)] : []), completion: { minimumScore: 100 },
    ui: { initialSheet: workbook.worksheets[0]?.id, documentLabel: "IMPORTAÇÃO XLSX" },
  };
  validateExerciseDefinition(definition);
  return definition;
}
