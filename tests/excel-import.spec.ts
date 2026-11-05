import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { importWorkbook } from "../lib/excel-import/importWorkbook";
import { createExerciseDefinitionFromImport } from "../lib/excel-import/createExerciseDefinitionFromImport";
import { importedSheetId } from "../lib/excel-import/normalizeWorkbook";
import { readPackage, xmlElements } from "../lib/excel-import/packageReader";
import { IMPORT_LIMITS } from "../lib/excel-import/limits";
import { calculateWorkbook } from "../lib/spreadsheet/formula-engine";
import { cloneWorkbook } from "../lib/spreadsheet/workbook";
import { validateExerciseDefinition, workbookBounds } from "../lib/exercises/definition";
import { applyCellEdit, createCellRuleResolver } from "../lib/spreadsheet/cell-rules";
import { packageFixture } from "./fixtures/xlsx/package-fixture";
import type { NormalizedWorkbook } from "../lib/excel-import/types";
import { analyzeFormula } from "../lib/excel-import/compatibility";
import { readXlsx } from "../lib/excel-import/xlsxAdapter";

const bytes = () => readFileSync("tests/fixtures/xlsx/controlled.xlsx");
async function imported() {
  const result = await importWorkbook(bytes(), "controlled.xlsx");
  expect(result.ok, JSON.stringify(result.report)).toBe(true);
  if (!result.ok) throw new Error(result.report.items[0].message);
  return result;
}
const parts = () => readPackage(bytes());
function changeSheet(changed: Map<string, Buffer>, transform: (xml: string) => string, name = "xl/worksheets/sheet1.xml") {
  changed.set(name, Buffer.from(transform(changed.get(name)!.toString("utf8"))));
  return packageFixture(changed);
}

test("XLSX: duas abas preservam nomes, ordem, intervalo e dimensões diferentes", async () => {
  const { workbook } = await imported();
  expect(workbook.worksheets.map(sheet => [sheet.name, sheet.order, sheet.dimensions])).toEqual([
    ["Dados base", 0, { rows: 10, columns: 4 }], ["Resultado & análise", 1, { rows: 5, columns: 6 }],
  ]);
  expect(workbook.worksheets[0].usedRange).toBe("A1:D10");
  expect(workbook.worksheets[1].usedRange).toBe("A1:F5");
  expect(workbook.worksheets[0].id).toBe(importedSheetId("Dados base"));
  expect(importedSheetId("Á & B")).not.toBe(importedSheetId("A & B"));
  expect(importedSheetId("__proto__")).toMatch(/^s-[a-f\d]+$/);
  expect(workbook.schemaVersion).toBe(1);
});

test("XLSX: preserva texto, número, booleano, data, branco formatado e expressão original", async () => {
  const { workbook } = await imported();
  const [data, result] = workbook.worksheets;
  expect(data.cells.A1).toMatchObject({ kind: "number", value: 10 });
  expect(data.cells.A2).toMatchObject({ kind: "text", value: "Temperatura" });
  expect(data.cells.B2).toMatchObject({ kind: "text", value: "001" });
  expect(data.cells.C1).toMatchObject({ kind: "boolean", value: true });
  expect(data.cells.B3).toMatchObject({ kind: "boolean", value: false });
  expect(data.cells.C2).toMatchObject({ kind: "text", value: "=SUM(A1:B1)" });
  expect(data.cells.A10).toMatchObject({ kind: "date", value: "2026-01-01T00:00:00.000Z" });
  expect(result.cells.C4).toMatchObject({ kind: "blank", value: null });
  expect(result.cells.A1.formula?.expression).toBe("='Dados base'!A1+'Dados base'!B1");
  expect(result.cells.A2.formula?.expression).toBe("='Dados base'!$A$1*2");
  expect(result.cells.A4.formula?.expression).toBe("=$A$1+A$2+$A1");
  expect(result.cells.A1.formula?.cachedResult).toBe(999);
});

test("XLSX: estilos básicos, largura, altura, mesclagem e proteção são metadados próprios", async () => {
  const { workbook, report } = await imported();
  const [data, result] = workbook.worksheets;
  const style = workbook.styles[data.cells.A1.styleId!];
  expect(style).toMatchObject({ bold: true, italic: true, fontColor: { argb: "FF142D4E" }, fill: { type: "pattern", pattern: "solid", color: { argb: "FFFFF5CF" } }, alignment: { horizontal: "right", vertical: "middle", wrapText: true }, numberFormat: "0.00" });
  expect(data.columns[0].width).toBe(24);
  expect(data.rows[0].height).toBe(28);
  expect(data.metadata.protection).toHaveProperty("sheet", "1");
  expect(workbook.styles[data.cells.B1.styleId!].protection).toEqual({ locked: false, hidden: true });
  expect(result.merges).toEqual(["E1:F1"]);
  expect(result.cells.F1.mergedInto).toBe("E1");
  expect(report.items.map(item => item.code)).toEqual(expect.arrayContaining(["STYLES_METADATA_ONLY", "MERGES_SUPPORTED", "PROTECTION_METADATA_ONLY", "DEFINED_NAMES"]));
});

test("XLSX: relatório reconhece sete funções e registra IF sem descartá-la", async () => {
  const { workbook, report } = await imported();
  const formulas = Object.values(workbook.worksheets[0].cells).flatMap(cell => cell.formula ? [cell.formula] : []);
  expect(formulas.map(formula => formula.functions[0])).toEqual(["SUM", "AVERAGE", "MIN", "MAX", "ABS", "SQRT", "POWER"]);
  expect(formulas.every(formula => formula.compatibility === "SUPPORTED")).toBe(true);
  expect(report).toMatchObject({ sheets: 2, formulas: 12, supportedFormulas: 12, unsupportedFormulas: 0, partiallySupportedFormulas: 0, charts: 0, errors: 0 });
  expect(report.populatedCells).toBeGreaterThan(20);
  expect(report.cells).toBeGreaterThan(report.populatedCells);
  expect(report.warnings).toBeGreaterThan(0);
  expect(report.items.find(item => item.cell === "A3" && item.sheet === "Resultado & análise")).toMatchObject({ level: "OK", code: "FORMULA_SUPPORTED" });
  expect(workbook.worksheets[1].cells.A3.formula?.expression).toBe("=IF(A1>0,1,0)");
  expect(report.items.some(item => item.code === "VBA_SCAN" && item.level === "OK")).toBe(true);
});

test("XLSX: conversão validada, sem gabarito, recalcula referências e ignora caches", async () => {
  const { workbook } = await imported();
  const definition = createExerciseDefinitionFromImport(workbook, { id: "xlsx-fixture", version: "1" });
  expect(() => validateExerciseDefinition(definition)).not.toThrow();
  expect(definition).toMatchObject({ title: "controlled", validationRules: [], charts: [], completion: { minimumScore: 100 } });
  expect(Object.isFrozen(definition.workbook.worksheets[0].cells)).toBe(true);
  const [data, result] = definition.workbook.worksheets;
  expect(definition.sheets?.[result.id].dimensions).toEqual({ rows: 5, columns: 6 });
  const calculated = calculateWorkbook(cloneWorkbook(definition.workbook), definition.dimensions, workbookBounds(definition));
  expect(calculated[result.id].A1.calculatedValue).toBe(30);
  expect(calculated[result.id].A2.calculatedValue).toBe(20);
  expect(calculated[result.id].A4.calculatedValue).toBe(80);
  expect(calculated[result.id].A5.calculatedValue).toBe(30);
  expect(calculated[result.id].A3).toMatchObject({ calculatedValue: 1, error: undefined });
  expect(calculated[data.id].C1.calculatedValue).toBe(true);
  expect(calculated[data.id].B3.calculatedValue).toBe(false);
  expect(calculated[data.id].B2.calculatedValue).toBe("001");
  expect(calculated[data.id].C2.calculatedValue).toBe("=SUM(A1:B1)");
  expect(createCellRuleResolver(definition.cellRules)(data.id, { row: 0, column: 1 }).readOnly).toBe(true);
  const source = cloneWorkbook(definition.workbook);
  expect(applyCellEdit(source, createCellRuleResolver(definition.cellRules), data.id, { row: 0, column: 1 }, "99")).toBe(source);
  const editable = createExerciseDefinitionFromImport(workbook, { id: "xlsx-editable", version: "1", cellPolicy: "editable" });
  const edited = applyCellEdit(cloneWorkbook(editable.workbook), createCellRuleResolver(editable.cellRules), data.id, { row: 0, column: 0 }, "50");
  expect(calculateWorkbook(edited, editable.dimensions, workbookBounds(editable))[result.id].A1.calculatedValue).toBe(70);
});

test("XLSX: detecta gráficos, VBA, consultas, pivôs, conexões e links sem executá-los", async () => {
  const changed = parts();
  changed.set("xl/vbaProject.bin", Buffer.from("globalThis.xlsxExecuted = true"));
  changed.set("xl/charts/chart1.xml", Buffer.from('<c:chartSpace xmlns:c="urn:chart"><c:chart><c:plotArea><c:barChart/></c:plotArea></c:chart></c:chartSpace>'));
  changed.set("xl/pivotTables/pivotTable1.xml", Buffer.from("<pivotTableDefinition/>"));
  changed.set("xl/connections.xml", Buffer.from("<connections/>"));
  changed.set("xl/queryTables/queryTable1.xml", Buffer.from("<queryTable/>"));
  changed.set("xl/externalLinks/externalLink1.xml", Buffer.from("<externalLink/>"));
  const input = changeSheet(changed, xml => xml.replace(/<f>SUM\(A1:B1\)<\/f>/, '<f>WEBSERVICE(&quot;https://example.invalid/execute&quot;)</f>'));
  const result = await importWorkbook(input, "active-parts.xlsx");
  expect(result.ok, JSON.stringify(result.report)).toBe(true);
  if (!result.ok) return;
  expect(result.report.charts).toBe(1);
  expect(result.report.items.map(item => item.code)).toEqual(expect.arrayContaining(["VBA", "CHART_UNSUPPORTED", "PIVOT_TABLE", "CONNECTION", "POWER_QUERY_OR_CUSTOM_XML", "EXTERNAL_LINK"]));
  expect(result.workbook.charts[0]).toMatchObject({ types: ["barChart"], compatibility: "UNSUPPORTED" });
  const original = result.workbook.worksheets[0].cells.A3.formula!;
  expect(original).toMatchObject({ blocked: true, compatibility: "UNSUPPORTED", expression: '=WEBSERVICE("https://example.invalid/execute")' });
  const definition = createExerciseDefinitionFromImport(result.workbook, { id: "inert", version: "1" });
  const raw = definition.workbook.worksheets[0].cells.A3;
  expect(raw).toBe('="=WEBSERVICE(""https://example.invalid/execute"")"');
  expect(calculateWorkbook(cloneWorkbook(definition.workbook), definition.dimensions, workbookBounds(definition))[definition.workbook.worksheets[0].id].A3.calculatedValue).toBe(original.expression);
  expect((globalThis as unknown as Record<string, unknown>).xlsxExecuted).toBeUndefined();
});

test("XLSX: nomes duplicados são erro claro, IDs não dependem da ordem", async () => {
  const changed = parts();
  changed.set("xl/workbook.xml", Buffer.from(changed.get("xl/workbook.xml")!.toString().replace('name="Resultado &amp; análise"', 'name="dados base"')));
  const result = await importWorkbook(packageFixture(changed), "duplicate.xlsx");
  expect(result.ok).toBe(false);
  expect(result.report.items[0]).toMatchObject({ level: "ERROR", code: "SHEET_NAME_CONFLICT" });
  const { workbook } = await imported();
  const ids = workbook.worksheets.map(sheet => sheet.id);
  const reversed: NormalizedWorkbook = { ...workbook, worksheets: [...workbook.worksheets].reverse() };
  expect(createExerciseDefinitionFromImport(reversed, { id: "reverse", version: "1" }).workbook.worksheets.map(sheet => sheet.id)).toEqual([...ids].reverse());
});

test("XLSX: planilha vazia preservada e workbook sem planilhas rejeitado", async () => {
  const changed = parts();
  changed.set("xl/worksheets/sheet1.xml", Buffer.from('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData/></worksheet>'));
  const empty = await importWorkbook(packageFixture(changed), "empty-sheet.xlsx");
  expect(empty.ok).toBe(true);
  if (empty.ok) expect(empty.workbook.worksheets[0]).toMatchObject({ cells: {}, usedRange: null, dimensions: { rows: 1, columns: 1 } });
  expect(empty.report.items.map(item => item.code)).toContain("EMPTY_SHEET");
  changed.set("xl/workbook.xml", Buffer.from(changed.get("xl/workbook.xml")!.toString().replace(/<sheets>[\s\S]*?<\/sheets>/, "<sheets/>")));
  const noSheets = await importWorkbook(packageFixture(changed), "no-sheets.xlsx");
  expect(noSheets.ok).toBe(false);
  expect(noSheets.report.items[0].code).toBe("NO_WORKSHEETS");
});

test("XLSX: limites de arquivo, partes, expansão, abas, linhas, colunas e células", async () => {
  const tooLarge = await importWorkbook(new Uint8Array(IMPORT_LIMITS.fileBytes + 1), "large.xlsx");
  expect(tooLarge.report.items[0].code).toBe("FILE_LIMIT");
  for (const range of ["A1:A201", "A1:AG1"]) {
    const result = await importWorkbook(changeSheet(parts(), xml => xml.replace(/<dimension ref="[^"]+"\/>/, `<dimension ref="${range}"/>`)), "bounds.xlsx");
    expect(result.ok).toBe(false);
    expect(result.report.items[0].message).toMatch(/limite/i);
  }
  const manyCells = parts();
  const rows = Array.from({ length: 200 }, (_, row) => `<row r="${row + 1}">${Array.from({ length: 26 }, (_, column) => `<c r="${String.fromCharCode(65 + column)}${row + 1}"><v>1</v></c>`).join("")}</row>`).join("");
  manyCells.set("xl/worksheets/sheet1.xml", Buffer.from(`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`));
  expect((await importWorkbook(packageFixture(manyCells), "cells.xlsx")).report.items[0].code).toBe("CELL_LIMIT");
  const manySheets = parts();
  manySheets.set("xl/workbook.xml", Buffer.from(manySheets.get("xl/workbook.xml")!.toString().replace(/<sheets>[\s\S]*?<\/sheets>/, `<sheets>${Array.from({ length: 9 }, (_, index) => `<sheet name="S${index}" sheetId="${index}"/>`).join("")}</sheets>`)));
  expect((await importWorkbook(packageFixture(manySheets), "sheets.xlsx")).report.items[0].code).toBe("SHEET_LIMIT");
  const manyParts = parts();
  for (let index = 0; index < 257; index++) manyParts.set(`extra${index}.bin`, Buffer.alloc(0));
  expect((await importWorkbook(packageFixture(manyParts), "parts.xlsx")).report.items[0].code).toBe("PACKAGE_LIMIT");
  const expansion = Buffer.from(bytes());
  const central = expansion.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  expansion.writeUInt32LE(IMPORT_LIMITS.partBytes + 1, central + 24);
  expect((await importWorkbook(expansion, "expansion.xlsx")).report.items[0].code).toBe("EXPANSION_LIMIT");
});

test("XLSX: formato inválido, corrupção e DTD retornam relatório de erro sem throw", async () => {
  for (const [input, name] of [[Buffer.from("not zip"), "bad.xlsx"], [bytes().subarray(0, 100), "broken.xlsx"], [bytes(), "old.xls"], [bytes(), "macro.xlsm"]] as const) {
    const result = await importWorkbook(input, name);
    expect(result.ok).toBe(false);
    expect(result.report.errors).toBe(1);
    expect(result.report.items[0].message).toMatch(/Não foi possível importar/);
  }
  const crc = parts(); crc.set("extra.bin", Buffer.from("one"));
  const corrupt = packageFixture(crc); corrupt[corrupt.indexOf(Buffer.from("one"))] ^= 255;
  expect((await importWorkbook(corrupt, "crc.xlsx")).ok).toBe(false);
  const dtd = parts();
  dtd.set("evil.xml", Buffer.from('<!DOCTYPE a [<!ENTITY x SYSTEM "file:///should-never-open">]><a>&x;</a>'));
  const result = await importWorkbook(packageFixture(dtd), "dtd.xlsx");
  expect(result.ok).toBe(false);
  expect(result.report.items[0].message).toContain("DTD/entidades");
  expect(() => xmlElements('<r xmlns="urn:test"><x></r>', ["x"])).toThrow();
});

test("XLSX: compatibilidade parcial, sintaxe inválida, nomes, arrays e referências externas", async () => {
  const workbook = await readXlsx(bytes(), "controlled.xlsx");
  const inspect = (expression: string, kind: "normal" | "array" | "shared" = "normal") => analyzeFormula({ expression, kind }, workbook, "Dados base");
  expect(inspect("=SUM(A1:B1)").compatibility).toBe("SUPPORTED");
  expect(inspect("=A199")).toMatchObject({ compatibility: "PARTIALLY_SUPPORTED", blocked: false });
  expect(inspect("=SUM(A1:B1)", "array").compatibility).toBe("PARTIALLY_SUPPORTED");
  expect(inspect("=A1", "shared").compatibility).toBe("SUPPORTED");
  expect(inspect("=SUM(A1:B1").compatibility).toBe("UNSUPPORTED");
  expect(inspect("=ValorBase+1").compatibility).toBe("UNSUPPORTED");
  expect(inspect("='[Outro.xlsx]Dados'!A1")).toMatchObject({ compatibility: "UNSUPPORTED", blocked: true });
  expect(inspect("=Tabela1[Total]")).toMatchObject({ compatibility: "UNSUPPORTED", blocked: true });
  expect(inspect('="https://example.invalid/[literal]"')).toMatchObject({ compatibility: "SUPPORTED", blocked: false });
});
