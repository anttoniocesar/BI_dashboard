import ExcelJS from "exceljs";
import { posix } from "node:path";
import { parseCellAddress, parseCellRange, cellAddress } from "@/lib/spreadsheet/coordinates";
import { IMPORT_LIMITS as limits, ImportFailure, importAssert } from "./limits";
import { readPackage, packageForParser } from "./packageReader";
import { normalizeWorkbookStructure } from "./normalizeWorkbookStructure";
import type { ImportedCell, ImportedColor, ImportedStyle, ImportedWorkbook, ImportedWorksheet } from "./types";
import { inspectMerges, mergeAt, mergeRange } from "@/lib/spreadsheet/merges";
import { parseWorkbookCharts } from "./parseWorkbookCharts";

function color(value: Partial<ExcelJS.Color> | undefined): ImportedColor | undefined {
  return value && Object.keys(value).length ? { ...value } : undefined;
}
function style(cell: ExcelJS.Cell): ImportedStyle | undefined {
  const source = cell.style;
  if (!Object.keys(source).length) return undefined;
  return {
    bold: source.font?.bold, italic: source.font?.italic, fontColor: color(source.font?.color),
    fill: source.fill ? { type: source.fill.type, ...("pattern" in source.fill ? { pattern: source.fill.pattern, color: color(source.fill.fgColor) } : {}) } : undefined,
    alignment: source.alignment ? { horizontal: source.alignment.horizontal, vertical: source.alignment.vertical, wrapText: source.alignment.wrapText, textRotation: source.alignment.textRotation } : undefined,
    numberFormat: source.numFmt,
    protection: source.protection ? { locked: source.protection.locked, hidden: source.protection.hidden } : undefined,
  };
}
function scalar(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (["string", "number", "boolean"].includes(typeof value)) return value as string | number | boolean;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && "error" in value) return String(value.error);
  return null;
}
function importedCell(cell: ExcelJS.Cell): ImportedCell {
  const result: ImportedCell = { address: cell.address, kind: "blank", value: null, style: style(cell) };
  if (cell.type === ExcelJS.ValueType.Merge) { result.mergedInto = cell.master.address; return result; }
  const value = cell.value;
  if (cell.type === ExcelJS.ValueType.Formula) {
    result.kind = "formula";
    const model = value as ExcelJS.CellFormulaValue & { shareType?: string };
    result.formula = { expression: `=${cell.formula}`, kind: model.shareType === "array" ? "array" : cell.formulaType === ExcelJS.FormulaType.Shared ? "shared" : "normal", cachedResult: scalar(cell.result) };
  } else if (typeof value === "number") { result.kind = "number"; result.value = value; }
  else if (typeof value === "boolean") { result.kind = "boolean"; result.value = value; }
  else if (typeof value === "string") { result.kind = "text"; result.value = value; }
  else if (value instanceof Date) { result.kind = "date"; result.value = value.toISOString(); }
  else if (value && "error" in value) { result.kind = "error"; result.value = value.error; }
  else if (value && "richText" in value) { result.kind = "text"; result.value = value.richText.map(run => run.text).join(""); result.notices = ["Rich text concatenado; formatação por trecho não representada no modelo básico."]; }
  else if (value && "hyperlink" in value) { result.kind = "text"; result.value = value.text; result.hyperlink = value.hyperlink; }
  importAssert(String(result.value ?? "").length <= limits.textLength, "TEXT_LIMIT", `Texto excede ${limits.textLength} caracteres em ${cell.address}.`);
  importAssert(result.kind !== "number" || Number.isFinite(result.value), "INVALID_NUMBER", `Número não finito em ${cell.address}.`);
  if (cell.fill?.type === "gradient") (result.notices ??= []).push("Preenchimento gradiente detectado; somente o tipo é preservado, sem stops/ângulo.");
  importAssert(!result.formula || result.formula.expression.length <= limits.formulaLength, "FORMULA_LIMIT", `Fórmula excede ${limits.formulaLength} caracteres em ${cell.address}.`);
  return result;
}

/** Node.js adapter. ExcelJS and OOXML/ZIP details never reach the Lab. */
export type ImportDiagnostics = { stage: "package" | "structure" | "cells" | "parser" | "charts" | "normalization" | "complete"; sheetCount: number; parserBranch: "unselected" | "standard" | "namespace-normalized"; chartCount: number; relationCount: number };
export async function readXlsx(input: Uint8Array, fileName: string, diagnostics?: ImportDiagnostics): Promise<ImportedWorkbook> {
  importAssert(/\.xlsx$/i.test(fileName), "UNSUPPORTED_FORMAT", "Formato não suportado. Utilize um arquivo .xlsx (não XLS, XLSM, XLSB, CSV ou ODS).");
  const parts = readPackage(input);
  importAssert(parts.has("[Content_Types].xml") && parts.has("xl/workbook.xml"), "INVALID_XLSX", "O ZIP não contém um workbook XLSX válido.");
  if (diagnostics) diagnostics.stage = "structure";
  const structure = normalizeWorkbookStructure(parts);
  if (diagnostics) Object.assign(diagnostics,{stage:"cells",sheetCount:structure.sheetCount,parserBranch:structure.branch,relationCount:structure.relationCount});
  const sheets = structure.elements("xl/workbook.xml", ["sheet", "definedName", "workbookPr"]);
  const sheetNodes = sheets.filter(element => element.name === "sheet");
  importAssert(sheetNodes.length > 0, "NO_WORKSHEETS", "O arquivo não contém planilhas.");
  importAssert(sheetNodes.length <= limits.sheets, "SHEET_LIMIT", `O arquivo excede ${limits.sheets} abas.`);
  const names = new Set<string>();
  const relationships = structure.elements("xl/_rels/workbook.xml.rels", ["Relationship"]);
  let cellCount = 0, area = 0;
  const sources = sheetNodes.map(node => {
    const name = node.attributes.name;
    importAssert(name && name.trim() === name && name.length <= 31 && !/[\\/?*\[\]:]/.test(name) && !names.has(name.toLocaleLowerCase("pt-BR")), "SHEET_NAME_CONFLICT", `Nome de aba inválido ou duplicado: ${name ?? "ausente"}.`);
    names.add(name.toLocaleLowerCase("pt-BR"));
    const relation = relationships.find(rel => rel.attributes.Id === node.attributes.id);
    importAssert(relation && relation.attributes.Type.endsWith("/worksheet") && relation.attributes.TargetMode !== "External", "UNSUPPORTED_SHEET", `Aba ${name}: somente worksheets locais são suportadas (não chartsheets).`);
    const target = relation.attributes.Target;
    const part = target.startsWith("/") ? target.slice(1) : posix.normalize(posix.join("xl", target));
    importAssert(parts.has(part), "MISSING_WORKSHEET", `Conteúdo da aba ${name} ausente.`);
    const elements = structure.elements(part, ["dimension", "c", "row", "col", "mergeCell", "sheetProtection", "drawing"]);
    const checkedMerges=inspectMerges(elements.filter(element=>element.name==="mergeCell").map(element=>element.attributes.ref),{rows:limits.rows,columns:limits.columns});
    let rows = 1, columns = 1, firstRow = Infinity, firstColumn = Infinity;
    function include(range: string) {
      importAssert(typeof range === "string", "INVALID_CELL_RANGE", `Endereço/intervalo ausente em ${name}.`);
      let parsed: ReturnType<typeof parseCellRange>;
      try { parsed = parseCellRange(range, { rows: limits.rows, columns: limits.columns }); }
      catch { throw new ImportFailure("INVALID_CELL_RANGE",`Aba ${name}: endereço/intervalo ${range} inválido ou fora do limite de ${limits.rows} linhas × ${limits.columns} colunas.`); }
      rows = Math.max(rows, parsed.to.row + 1); columns = Math.max(columns, parsed.to.column + 1);
      firstRow = Math.min(firstRow, parsed.from.row); firstColumn = Math.min(firstColumn, parsed.from.column);
    }
    for (const element of elements) {
      if (element.name === "dimension" && element.attributes.ref) include(element.attributes.ref);
      if (element.name === "c") { include(element.attributes.r); cellCount++; }
      if (element.name === "row") importAssert(Number(element.attributes.r) <= limits.rows && Number(element.attributes.r) >= 1, "DIMENSION_LIMIT", `Linhas da aba ${name} excedem o limite de ${limits.rows}.`);
      if (element.name === "col") importAssert(Number(element.attributes.max) <= limits.columns && Number(element.attributes.min) >= 1, "DIMENSION_LIMIT", `Colunas da aba ${name} excedem o limite de ${limits.columns}.`);
    }
    checkedMerges.merges.forEach(merge=>include(mergeRange(merge)));
    area += rows * columns;
    importAssert(cellCount <= limits.cells && area <= limits.gridCells, "CELL_LIMIT", `Limite excedido: ${limits.cells} células armazenadas / ${limits.gridCells} posições de grade no total.`);
    return { node, part, elements, checkedMerges, dimensions: { rows, columns }, usedRange: Number.isFinite(firstRow) ? `${cellAddress({ row: firstRow, column: firstColumn })}:${cellAddress({ row: rows - 1, column: columns - 1 })}` : null };
  });

  const workbook = new ExcelJS.Workbook();
  // ExcelJS accepts ArrayBuffer at runtime; its declaration names that type Buffer.
  // OOXML merges were already inspected above. Ignore them in ExcelJS to avoid
  // its overlapping-range exception and keep diagnostics for malformed files.
  if (diagnostics) diagnostics.stage = "parser";
  const parserInput = packageForParser(structure.parserParts);
  await workbook.xlsx.load(Uint8Array.from(parserInput).buffer,{ignoreNodes:["mergeCells","drawing"]});
  importAssert(Array.isArray(workbook.worksheets) && workbook.worksheets.length === sources.length,"UNSUPPORTED_WORKBOOK_STRUCTURE","A biblioteca não recuperou a estrutura de planilhas esperada.");
  const worksheets: ImportedWorksheet[] = sources.map((source, order) => {
    const sheet = workbook.getWorksheet(source.node.attributes.name);
    importAssert(sheet, "MISSING_WORKSHEET", `A biblioteca não recuperou a aba ${source.node.attributes.name}.`);
    const cells: ImportedCell[] = [];
    // OOXML cell elements include styled blanks; avoid iterating a huge sparse rectangle.
    const seen = new Set<string>();
    for (const element of source.elements.filter(element => element.name === "c")) {
      const address = element.attributes.r;
      importAssert(!seen.has(address), "DUPLICATE_CELL", `Célula duplicada em ${sheet.name}!${address}.`);
      seen.add(address);
      parseCellAddress(address, source.dimensions);
      const merge=mergeAt(source.checkedMerges.merges,parseCellAddress(address,source.dimensions));
      const anchor=merge?cellAddress({row:merge.startRow,column:merge.startCol}):address;
      cells.push(anchor!==address ? {address,kind:"blank",value:null,mergedInto:anchor,style:style(sheet.getCell(address))} : importedCell(sheet.getCell(address)));
    }
    return {
      name: sheet.name, order, cells, usedRange: source.usedRange, dimensions: source.dimensions,
      merges: source.checkedMerges.merges.map(mergeRange), mergeIssues:source.checkedMerges.issues,
      columns: Array.from({ length: source.dimensions.columns }, (_, index) => ({ index: index + 1, width: sheet.getColumn(index + 1).width, hidden: sheet.getColumn(index + 1).hidden })),
      rows: source.elements.filter(element => element.name === "row").map(element => { const index = Number(element.attributes.r); return { index, height: sheet.getRow(index).height, hidden: sheet.getRow(index).hidden }; }),
      metadata: { visibility: sheet.state, protection: source.elements.find(element => element.name === "sheetProtection")?.attributes },
    };
  });
  const features: ImportedWorkbook["metadata"]["features"] = [];
  const featurePaths: [RegExp, string][] = [[/vbaProject\.bin$/i, "VBA"], [/customXml\/|mashup|queryTables\//i, "POWER_QUERY_OR_CUSTOM_XML"], [/pivotTables\/|pivotCache\//i, "PIVOT_TABLE"], [/connections\.xml$/i, "CONNECTION"], [/externalLinks\//i, "EXTERNAL_LINK"], [/embeddings\/|activeX\//i, "EMBEDDED_OBJECT"], [/tables\//i, "TABLE"], [/media\//i, "IMAGE"]];
  for (const [part, data] of parts) {
    for (const [pattern, kind] of featurePaths) if (pattern.test(part) && !part.endsWith("/")) features.push({ kind, part });
    if (/\.rels$/i.test(part)) for (const relation of structure.elements(part, ["Relationship"])) if (relation.attributes.TargetMode === "External") features.push({ kind: "EXTERNAL_RELATIONSHIP", part, detail: relation.attributes.Target });
    if (/^xl\/worksheets\/[^/]+\.xml$/i.test(part)) {
      for (const element of structure.elements(part, ["conditionalFormatting", "dataValidation", "autoFilter", "extLst", "drawing", "legacyDrawing", "sheetView"])) {
        features.push({ kind: `WORKSHEET_${element.name.toUpperCase()}`, part });
      }
    }
  }
  if (diagnostics) diagnostics.stage = "charts";
  const charts = parseWorkbookCharts(parts, sources.map(source => ({ part: source.part, name: source.node.attributes.name, drawingIds: source.elements.filter(node => node.name === "drawing").map(node => node.attributes.id) })), worksheets);
  if (diagnostics) diagnostics.chartCount = charts.length;
  return {
    fileName, worksheets, charts,
    metadata: { creator: workbook.creator, dateSystem: workbook.properties.date1904 ? "1904" : "1900", parts: [...parts.keys()], features,
      definedNames: sheets.filter(element => element.name === "definedName").map(element => ({ name: element.attributes.name, expression: element.text, localSheetId: element.attributes.localSheetId })) },
  };
}
