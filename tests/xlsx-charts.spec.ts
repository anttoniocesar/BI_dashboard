import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { chartWorkbookFixture, labChartTitle } from "./fixtures/xlsx/chart-workbook";
import { packageFixture } from "./fixtures/xlsx/package-fixture";
import { importWorkbook } from "../lib/excel-import/importWorkbook";
import { createExerciseDefinitionFromImport } from "../lib/excel-import/createExerciseDefinitionFromImport";
import { importedSheetId } from "../lib/excel-import/normalizeWorkbook";
import { parseChartReference } from "../lib/excel-import/chartReferences";
import { workbookBounds, validateExerciseDefinition } from "../lib/exercises/definition";
import { calculateWorkbook } from "../lib/spreadsheet/formula-engine";
import { resolveChartText, workbookChartData } from "../lib/charts/workbookChartData";
import { reviewImport, DEFAULT_IMPORT_OPTIONS } from "../lib/excel-import/reviewImport";
import { cloneWorkbook } from "../lib/spreadsheet/workbook";

async function analyzed(buffer: Uint8Array, name = "charts.xlsx") {
  const result = await importWorkbook(buffer, name);
  expect(result.ok, JSON.stringify(result.report)).toBe(true);
  if (!result.ok) throw new Error("Fixture não importada.");
  return result;
}
for (const type of ["line", "column", "bar", "pie", "scatter"] as const) {
  test(`XLSX charts: ${type}, título Unicode, legenda, referências e escala`, async () => {
    const fixture = await chartWorkbookFixture([{ type, title: labChartTitle }]);
    const result = await analyzed(fixture.buffer);
    expect(result.report).toMatchObject({ charts: 1, importedCharts: 1, unsupportedCharts: 0 });
    expect(result.workbook.charts[0].compatibility).toBe("SUPPORTED");
    const def = createExerciseDefinitionFromImport(result.workbook, { id: "chart-fixture", version: "1" });
    expect(() => validateExerciseDefinition(def)).not.toThrow();
    expect(def.charts[0]).toMatchObject({ type, title: labChartTitle, sheet: importedSheetId("Gabarito"), xRange: "A11:A18", legend: true, legendPosition: "bottom", anchor: { fromRow: 20, fromCol: 5, toRow: 35, toCol: 13 } });
    expect(def.charts[0].series[0]).toMatchObject({ name: "|e|", range: "J11:J18" });
    if (type !== "pie") expect(def.charts[0]).toMatchObject({ xAxisLabel: "Chapa", yAxisLabel: "Erro absoluto", yAxis: { min: 0, max: 1 } });
    const data = workbookChartData(calculateWorkbook(cloneWorkbook(def.workbook), def.dimensions, workbookBounds(def)), def.charts[0]);
    expect(data.points.map(point => point.sample)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(data.points[0].values[def.charts[0].series[0].id]).toBeCloseTo(0.1);
    expect(data.points[0].values[def.charts[0].series[0].id]).not.toBe(999);
  });
}

test("XLSX charts: múltiplos gráficos/abas, sem título, IDs estáveis e únicos", async () => {
  const specs = [{ type: "line" as const, title: null }, { type: "column" as const, title: "Colunas" }, { type: "bar" as const, owner: "data" as const, source: "data" as const, title: "Outra aba" }];
  const first = await analyzed((await chartWorkbookFixture(specs)).buffer);
  const second = await analyzed((await chartWorkbookFixture(specs, "Dados base", true)).buffer);
  expect(first.report).toMatchObject({ charts: 3, importedCharts: 3 });
  expect(first.workbook.charts.map(chart => chart.id)).toEqual(second.workbook.charts.map(chart => chart.id).sort((a, b) => first.workbook.charts.findIndex(chart => chart.id === a) - first.workbook.charts.findIndex(chart => chart.id === b)));
  expect(new Set(first.workbook.charts.map(chart => chart.id)).size).toBe(3);
  expect(first.workbook.charts.find(chart => chart.definition?.type === "line")?.definition?.title).toBe("Gráfico importado");
  expect(first.workbook.charts.find(chart => chart.sheetName === "Dados base")?.definition?.sheet).toBe(importedSheetId("Dados base"));
});

test("XLSX charts: sheet com espaços/apóstrofo, fontes em outra aba e dados/nomes reativos", async () => {
  const result = await analyzed((await chartWorkbookFixture([{ type: "line", source: "data" }], "Dados d'água")).buffer);
  const definition = createExerciseDefinitionFromImport(result.workbook, { id: "cross-chart", version: "1" });
  const chart = definition.charts[0], workbook = cloneWorkbook(definition.workbook);
  expect(chart).toMatchObject({ sheet: importedSheetId("Gabarito"), xSheet: importedSheetId("Dados d'água"), series: [{ sheet: importedSheetId("Dados d'água"), range: "B2:B9" }] });
  const sheet = workbook.worksheets.find(sheet => sheet.name === "Dados d'água")!;
  sheet.cells.B2 = "0.75"; sheet.cells.B1 = "Série atualizada";
  const calculated = calculateWorkbook(workbook, definition.dimensions, workbookBounds(definition));
  expect(workbookChartData(calculated, chart).points[0].values[chart.series[0].id]).toBe(0.75);
  expect(resolveChartText(calculated, chart).series[0].name).toBe("Série atualizada");
});

test("XLSX charts: anchors de uma célula e absolutos preservam tamanho aproximado", async () => {
  for (const anchor of ["oneCellAnchor", "absoluteAnchor"] as const) {
    const result = await analyzed((await chartWorkbookFixture([{ type: "line", anchor }])).buffer);
    expect(result.workbook.charts[0].definition?.anchor).toMatchObject({ fromRow: 20, fromCol: 5, width: 800, height: 400 });
  }
});

test("XLSX charts: tipo não suportado e referência inválida não interrompem as células", async () => {
  const result = await analyzed((await chartWorkbookFixture([{ type: "line" }, { type: "radar" }, { type: "line", series: [{ valuesFormula: "'[external.xlsx]Dados'!$B$2:$B$9" }] }])).buffer);
  expect(result.report).toMatchObject({ charts: 3, importedCharts: 1, unsupportedCharts: 2 });
  expect(result.report.items.some(item => item.code === "CHARTS_PARTIALLY_SUPPORTED")).toBe(true);
  expect(result.report.items.some(item => item.message.includes("unsupported chart type: radarChart"))).toBe(true);
  expect(createExerciseDefinitionFromImport(result.workbook, { id: "partial", version: "1" }).charts).toHaveLength(1);
});

test("XLSX charts: referências seguras e bounds rejeitam fórmulas externas, nomes e ranges bidimensionais", () => {
  const sheets = [{ name: "Dados d'água", dimensions: { rows: 20, columns: 10 } }];
  expect(parseChartReference("'Dados d''água'!$A$2:$A$9", sheets)).toMatchObject({ range: "A2:A9", length: 8 });
  for (const formula of ["'[other.xlsx]Dados'!A1", "https://example.com!A1", "'Dados d''água'!A1:B2", "'Dados d''água'!XFD99", "NomeDefinido", "SUM(A1:A9)", "'Dados d''água'!A1,A2"]) expect(() => parseChartReference(formula, sheets)).toThrow();
});

test("XLSX charts: relacionamento externo/caminho fora do pacote é inerte e DTD é recusado", async () => {
  for (const target of ['Target="https://example.invalid/chart.xml" TargetMode="External"', 'Target="../../../evil.xml"']) {
    const fixture = await chartWorkbookFixture();
    const key = "xl/drawings/_rels/drawing-gabarito.xml.rels";
    fixture.parts.set(key, Buffer.from(fixture.parts.get(key)!.toString().replace('Target="../charts/chart1.xml"', target)));
    const result = await analyzed(packageFixture(fixture.parts));
    expect(result.report.importedCharts).toBe(0);
    expect(result.report.unsupportedCharts).toBeGreaterThan(0);
  }
  const fixture = await chartWorkbookFixture();
  fixture.parts.set("xl/charts/chart1.xml", Buffer.from('<!DOCTYPE chart [<!ENTITY x SYSTEM "https://example.invalid/secret">]><chart>&x;</chart>'));
  expect((await importWorkbook(packageFixture(fixture.parts), "dtd.xlsx")).ok).toBe(false);
});

test("XLSX charts: revisão exclui gráficos de abas removidas e informa dependências omitidas", async () => {
  const result = await analyzed((await chartWorkbookFixture([{ type: "line", source: "data" }])).buffer);
  const reviewed = reviewImport(result.workbook, [importedSheetId("Gabarito")], DEFAULT_IMPORT_OPTIONS);
  expect(reviewed.ok).toBe(true);
  if (!reviewed.ok) return;
  expect(reviewed.report).toMatchObject({ importedCharts: 0, unsupportedCharts: 1 });
  expect(reviewed.report.items.some(item => item.message.includes("aba de origem dos dados foi desmarcada"))).toBe(true);
  expect(createExerciseDefinitionFromImport(reviewed.workbook, { id: "reviewed", version: "1" }).charts).toEqual([]);
  const removed = reviewImport(result.workbook, [importedSheetId("Dados base")], DEFAULT_IMPORT_OPTIONS);
  expect(removed.report.charts).toBe(0);
});

test("XLSX charts: dados literais explícitos funcionam sem usar numCache como origem", async () => {
  const result = await analyzed((await chartWorkbookFixture([{ type: "line", series: [{ literal: true }] }])).buffer);
  const def = createExerciseDefinitionFromImport(result.workbook, { id: "literal", version: "1" });
  expect(def.charts[0].series[0].values).toEqual([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]);
});

test("XLSX charts: dispersão preserva pares X/Y próprios de cada série", async () => {
  const result = await analyzed((await chartWorkbookFixture([{ type: "scatter", series: [{ name: "Chapas" }, { name: "Entrada", xFormula: "Gabarito!$B$11:$B$18" }] }])).buffer);
  const def = createExerciseDefinitionFromImport(result.workbook, { id: "scatter", version: "1" });
  const data = workbookChartData(calculateWorkbook(cloneWorkbook(def.workbook), def.dimensions, workbookBounds(def)), def.charts[0]);
  expect(data.points[0].x).toEqual({ "series-1": 1, "series-2": -0.1 });
  expect(data.points[0].values).toEqual({ "series-1": 0.1, "series-2": 0.1 });
});

test("XLSX charts: ausência de gráficos não cria avisos; pontos literais têm limite", async () => {
  const empty = await analyzed((await chartWorkbookFixture([])).buffer);
  expect(empty.report.charts).toBe(0);
  expect(empty.report.items.filter(item => item.code.startsWith("CHART"))).toEqual([]);
  const fixture = await chartWorkbookFixture([{ type: "line", series: [{ literal: true }] }]);
  fixture.parts.set("xl/charts/chart1.xml", Buffer.from(fixture.parts.get("xl/charts/chart1.xml")!.toString().replace('<c:numLit><c:ptCount val="8"', '<c:numLit><c:ptCount val="1000000"')));
  const limited = await analyzed(packageFixture(fixture.parts));
  expect(limited.report).toMatchObject({ importedCharts: 0, unsupportedCharts: 1 });
  expect(limited.workbook.charts[0].reasons.join(" ")).toContain("fora do limite");
});

test("XLSX charts: definições de gráfico rejeitam origem ambígua, escala, anchor e nome inválidos", async () => {
  const result = await analyzed((await chartWorkbookFixture()).buffer);
  const def = createExerciseDefinitionFromImport(result.workbook, { id: "validation-chart", version: "1" });
  for (const change of [
    (chart: typeof def.charts[0]) => { chart.xRange = undefined; },
    (chart: typeof def.charts[0]) => { chart.xValues = [1]; },
    (chart: typeof def.charts[0]) => { chart.yAxis = { min: 2, max: 1 }; },
    (chart: typeof def.charts[0]) => { chart.anchor!.fromRow = -1; },
    (chart: typeof def.charts[0]) => { chart.series[0].nameRef = { sheet: "absent", cell: "A1" }; },
    (chart: typeof def.charts[0]) => { chart.series[0].range = "J11:J12"; },
    (chart: typeof def.charts[0]) => { chart.series[0].values = [Infinity]; },
  ]) {
    const invalid = structuredClone(def); change(invalid.charts[0]);
    expect(() => validateExerciseDefinition(invalid)).toThrow("ExerciseDefinition inválido");
  }
});

test("LAB 1: fixture equivalente tem uma série |e|, oito chapas e conversão reativa", async () => {
  const fixture = await chartWorkbookFixture();
  const result = await analyzed(fixture.buffer, "laboratorio_1.xlsx");
  const def = createExerciseDefinitionFromImport(result.workbook, { id: "lab-1", version: "1" });
  expect(def.charts).toHaveLength(1);
  expect(def.charts[0].title).toBe(labChartTitle);
  expect(def.charts[0].series).toHaveLength(1);
  expect(def.charts[0].series[0].name).toBe("|e|");
  const workbook = cloneWorkbook(def.workbook); workbook.worksheets.find(sheet => sheet.name === "Gabarito")!.cells.B11 = "-0.55";
  expect(workbookChartData(calculateWorkbook(workbook, def.dimensions, workbookBounds(def)), def.charts[0]).points[0].values[def.charts[0].series[0].id]).toBe(0.55);
});

test("LAB 1: arquivo de regressão local ou fixture preserva título, série |e| e chapas 1 a 8", async () => {
  const file = process.env.BI_SOCIETY_CHART_REGRESSION_PATH;
  const bytes = file ? readFileSync(file) : (await chartWorkbookFixture()).buffer;
  const result = await analyzed(bytes, file ? basename(file) : "laboratorio_1.xlsx");
  const def = createExerciseDefinitionFromImport(result.workbook, { id: "lab-1-regression", version: "1" });
  const chart = def.charts.find(chart => chart.title === labChartTitle)!;
  expect(chart).toBeDefined(); expect(chart.sheet).toBe(importedSheetId("Gabarito"));
  const series = chart.series.find(series => series.name === "|e|")!;
  expect(series).toBeDefined(); expect(series.range).toBe("J11:J18");
  const data = workbookChartData(calculateWorkbook(cloneWorkbook(def.workbook), def.dimensions, workbookBounds(def)), chart);
  expect(data.points.map(point => point.sample)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  expect(data.points.every(point => point.values[series.id] !== null)).toBe(true);
  mkdirSync("test-results/xlsx-charts", { recursive: true });
  writeFileSync("test-results/xlsx-charts/lab-1.json", JSON.stringify({ file: file ?? "fixture equivalente", report: result.report, chart, points: data.points }, null, 2));
});
