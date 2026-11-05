import type { ExerciseDefinition } from "@/types/exercise";
import type { SheetBounds } from "@/types/spreadsheet";
import { columnIndex, normalizeCellAddress, parseCellAddress, parseCellRange } from "@/lib/spreadsheet/coordinates";
import { validateExercise } from "@/lib/validation/validateExercise";
import { inspectMerges, coveredByMerge, validMerge } from "@/lib/spreadsheet/merges";

export const sheetBounds = (definition: ExerciseDefinition, id: string): SheetBounds => definition.sheets?.[id]?.dimensions ?? definition.dimensions;
export const workbookBounds = (definition: ExerciseDefinition) => Object.fromEntries(definition.workbook.worksheets.map(sheet => [sheet.id, sheetBounds(definition, sheet.id)]));
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const fail = (message: string): never => { throw new Error(`ExerciseDefinition inválido: ${message}`); };
function dimensions(value: unknown) {
  if (!record(value) || !Number.isSafeInteger(value.rows) || !Number.isSafeInteger(value.columns) || Number(value.rows) < 1 || Number(value.columns) < 1) fail("dimensões devem ser inteiros positivos.");
}

function checkExerciseDefinition(value: unknown): asserts value is ExerciseDefinition {
  if (!record(value)) fail("objeto ausente.");
  const def = value as unknown as ExerciseDefinition;
  if (!text(def.id) || !/^[a-zA-Z0-9_-]+$/.test(def.id)) fail("id ausente ou inválido.");
  if (!text(def.version) || !text(def.title)) fail("versão e título são obrigatórios.");
  if (def.subtitle !== undefined && typeof def.subtitle !== "string") fail("subtítulo inválido.");
  dimensions(def.dimensions);
  if (!record(def.workbook) || !Array.isArray(def.workbook.worksheets) || !def.workbook.worksheets.length) fail("workbook deve conter abas.");
  if (def.sheets !== undefined && !record(def.sheets)) fail("metadata de abas inválida.");
  const ids = new Set<string>(), names = new Set<string>();
  for (const sheet of def.workbook.worksheets) {
    if (!record(sheet) || !text(sheet.id) || !/^[a-zA-Z0-9_-]+$/.test(sheet.id) || ["__proto__", "prototype", "constructor"].includes(sheet.id) || ids.has(sheet.id)) fail("ID de aba inválido ou duplicado.");
    if (!text(sheet.name) || sheet.name !== sheet.name.trim() || sheet.name.length > 31 || /[\\/?*\[\]:]/.test(sheet.name) || names.has(sheet.name.toLocaleLowerCase("pt-BR"))) fail(`nome de aba inválido ou duplicado: ${sheet.id}.`);
    ids.add(sheet.id); names.add(sheet.name.toLocaleLowerCase("pt-BR"));
    if (!record(sheet.cells)) fail(`células inválidas em ${sheet.id}.`);
    if (def.sheets?.[sheet.id]?.dimensions !== undefined) dimensions(def.sheets[sheet.id].dimensions);
    if(sheet.merges !== undefined) {
      if(!Array.isArray(sheet.merges)) fail(`mesclagens inválidas em ${sheet.id}.`);
      if(sheet.merges.some(merge => !validMerge(merge, sheetBounds(def, sheet.id)))) fail(`mesclagem deve conter coordenadas normalizadas válidas em ${sheet.id}.`);
      const checked=inspectMerges(sheet.merges,sheetBounds(def,sheet.id));
      if(checked.issues.length) fail(`mesclagem inválida em ${sheet.id}: ${checked.issues[0].range} (${checked.issues[0].reason}).`);
      for(const [address,raw] of Object.entries(sheet.cells)) {
        if(raw && coveredByMerge(checked.merges,parseCellAddress(address,sheetBounds(def,sheet.id)))) fail(`conteúdo em célula coberta por mesclagem: ${sheet.id}!${address}; use a principal.`);
      }
    }
    for (const [address, raw] of Object.entries(sheet.cells)) {
      try { if (normalizeCellAddress(address, sheetBounds(def, sheet.id)) !== address || typeof raw !== "string") fail(`célula inválida: ${sheet.id}!${address}.`); }
      catch { fail(`célula inválida: ${sheet.id}!${address}.`); }
    }
  }
  const checkCell = (sheet: string, cell: string, context: string) => {
    if (!ids.has(sheet)) fail(`${context} referencia aba inexistente: ${sheet}.`);
    try { if (normalizeCellAddress(cell, sheetBounds(def, sheet)) !== cell) fail("endereço não normalizado"); }
    catch { fail(`${context} referencia célula inexistente ou inválida: ${sheet}!${cell}.`); }
  };
  const checkRange = (sheet: string, range: string, context: string): number => {
    if (!ids.has(sheet)) fail(`${context} referencia aba inexistente: ${sheet}.`);
    try {
      const { from, to } = parseCellRange(range, sheetBounds(def, sheet));
      if (from.row !== to.row && from.column !== to.column) fail("range de gráfico deve ser unidimensional");
      return (to.row - from.row + 1) * (to.column - from.column + 1);
    } catch { return fail(`${context} referencia intervalo inválido: ${range}.`); }
  };
  for (const [id, ui] of Object.entries(def.sheets ?? {})) {
    if (!ids.has(id) || !record(ui)) fail(`metadata referencia aba inexistente: ${id}.`);
    if (ui.viewportHeight !== undefined && (!Number.isFinite(ui.viewportHeight) || ui.viewportHeight <= 0)) fail(`altura inválida em ${id}.`);
    if (ui.headerRows !== undefined && (!Array.isArray(ui.headerRows) || ui.headerRows.some(row => !Number.isInteger(row) || row < 1 || row > sheetBounds(def, id).rows))) fail(`cabeçalhos inválidos em ${id}.`);
    for (const [column, width] of Object.entries(ui.columnWidths ?? {})) {
      try { if (column !== column.toUpperCase() || columnIndex(column) >= sheetBounds(def, id).columns || !Number.isFinite(width) || width < 40) fail("largura inválida"); }
      catch { fail(`largura de coluna inválida em ${id}.`); }
    }
    for(const [row,height] of Object.entries(ui.rowHeights??{})) if(!/^[1-9]\d*$/.test(row) || Number(row)>sheetBounds(def,id).rows || !Number.isFinite(height) || height<=0) fail(`altura de linha inválida em ${id}.`);
    for(const [address,alignment] of Object.entries(ui.cellAlignment??{})) {
      checkCell(id,address,"alinhamento");
      if(!record(alignment) || (alignment.horizontal!==undefined && !["left","center","right","justify"].includes(alignment.horizontal)) || (alignment.vertical!==undefined && !["top","middle","bottom"].includes(alignment.vertical)) || (alignment.wrapText!==undefined && typeof alignment.wrapText!=="boolean")) fail(`alinhamento inválido em ${id}!${address}.`);
    }
    if (ui.charts) {
      if (!text(ui.charts.title) || !text(ui.charts.ariaLabel)) fail(`título de gráficos inválido em ${id}.`);
      const metricIds = new Set<string>();
      for (const metric of ui.charts.metrics ?? []) {
        if (!text(metric.id) || metricIds.has(metric.id) || !text(metric.title) || !text(metric.ariaLabel)) fail(`indicador inválido ou duplicado em ${id}.`);
        metricIds.add(metric.id);
        checkCell(metric.sheet, metric.cell, `indicador ${metric.id}`);
      }
    }
  }
  if (!record(def.cellRules)) fail("regras de células ausentes.");
  const validRole = (role: unknown) => typeof role === "string" && ["provided", "calculated", "answer", "editable"].includes(role);
  for (const [id, rules] of Object.entries(def.cellRules)) {
    if (!ids.has(id) || !record(rules) || !validRole(rules.default)) fail(`regras de células inválidas em ${id}.`);
    for (const rule of rules.ranges ?? []) {
      try { parseCellRange(rule.range, sheetBounds(def, id)); if (!validRole(rule.role)) fail("papel inválido"); }
      catch { fail(`intervalo pedagógico inválido em ${id}.`); }
    }
    for (const [cell, role] of Object.entries(rules.cells ?? {})) {
      try { parseCellAddress(cell, sheetBounds(def, id)); if (!validRole(role)) fail("papel inválido"); }
      catch { fail(`regra pedagógica inválida: ${id}!${cell}.`); }
    }
  }
  if (!Array.isArray(def.validationRules) || !record(def.completion)) fail("validação/conclusão ausente.");
  const ruleIds = new Set<string>();
  for (const rule of def.validationRules) {
    if (!record(rule) || !text(rule.id) || ruleIds.has(rule.id) || !text(rule.label) || !text(rule.feedback) || !["number", "text"].includes(rule.type)) fail("regra de validação inválida ou duplicada.");
    if (rule.requireFormula !== undefined && typeof rule.requireFormula !== "boolean") fail(`requireFormula inválido em ${rule.id}.`);
    if (rule.type === "text" && typeof rule.expected !== "string") fail(`texto esperado inválido em ${rule.id}.`);
    ruleIds.add(rule.id); checkCell(rule.worksheetId, rule.cell, `validationRule ${rule.id}`);
  }
  try { validateExercise({}, { rules: def.validationRules, minimumScore: def.completion.minimumScore }); }
  catch (error) { fail(error instanceof Error ? error.message : "validação inválida."); }
  if (!Array.isArray(def.charts)) fail("lista de gráficos ausente.");
  const chartIds = new Set<string>();
  const chartSourceLength = (sheet: string, range: unknown, values: unknown, context: string, numeric = false): number => {
    if (!ids.has(sheet)) fail(`${context} referencia aba inexistente: ${sheet}.`);
    if (range !== undefined) {
      if (typeof range !== "string" || values !== undefined) return fail(`origem ambígua ou inválida em ${context}.`);
      return checkRange(sheet, range, context);
    }
    if (!Array.isArray(values) || !values.length || values.length > 20000 || values.some(value => value !== null && (typeof value === "number" ? !Number.isFinite(value) : numeric || typeof value !== "string"))) return fail(`dados literais inválidos em ${context}.`);
    return values.length;
  };
  const chartTextRef = (ref: unknown, context: string) => {
    if (ref === undefined) return;
    if (!record(ref) || !text(ref.sheet) || !text(ref.cell)) return fail(`referência de texto inválida em ${context}.`);
    checkCell(ref.sheet, ref.cell, context);
  };
  for (const chart of def.charts) {
    if (!record(chart) || !text(chart.id) || !/^[a-zA-Z0-9_-]+$/.test(chart.id) || chartIds.has(chart.id) || !["line", "column", "bar", "pie", "scatter"].includes(chart.type) || !text(chart.title) || !Array.isArray(chart.series) || !chart.series.length) fail("gráfico inválido ou duplicado.");
    chartIds.add(chart.id);
    if (!ids.has(chart.sheet)) fail(`gráfico referencia aba inexistente: ${chart.sheet}.`);
    const length = chartSourceLength(chart.xSheet ?? chart.sheet, chart.xRange, chart.xValues, `gráfico ${chart.id}`, chart.type === "scatter");
    chartTextRef(chart.titleRef, chart.id);
    if (chart.legend !== undefined && typeof chart.legend !== "boolean") fail("legenda inválida.");
    if (chart.legendPosition !== undefined && !["top", "bottom", "left", "right"].includes(chart.legendPosition)) fail("posição de legenda inválida.");
    if (chart.grouping !== undefined && (chart.grouping !== "standard" && chart.grouping !== "stacked" || chart.grouping === "stacked" && !["bar", "column"].includes(chart.type))) fail("agrupamento de gráfico inválido.");
    for (const axis of [chart.xAxis, chart.yAxis]) if (axis !== undefined) {
      if (!record(axis) || [axis.min, axis.max].some(value => value !== undefined && !Number.isFinite(value)) || axis.min !== undefined && axis.max !== undefined && axis.min >= axis.max || axis.reversed !== undefined && typeof axis.reversed !== "boolean") fail("escala de gráfico inválida.");
    }
    if (chart.anchor !== undefined) {
      const anchor = chart.anchor;
      if (!record(anchor) || [anchor.fromRow, anchor.fromCol, anchor.toRow, anchor.toCol].some(value => !Number.isSafeInteger(value) || value < 0 || value > 1048576)
        || anchor.toRow < anchor.fromRow || anchor.toCol < anchor.fromCol || [anchor.width, anchor.height].some(value => value !== undefined && (!Number.isFinite(value) || value <= 0))) fail("anchor de gráfico inválido.");
    }
    if (chart.type === "pie" && chart.series.length !== 1) fail("pizza deve conter uma série.");
    const seriesIds = new Set<string>();
    for (const series of chart.series) {
      if (!record(series) || !text(series.id) || !/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(series.id) || seriesIds.has(series.id) || !text(series.name) || !/^#[\da-f]{6}$/i.test(series.color)) fail(`série inválida em ${chart.id}.`);
      seriesIds.add(series.id);
      chartTextRef(series.nameRef, series.id);
      const seriesLength = chartSourceLength(series.sheet ?? chart.sheet, series.range, series.values, `série ${series.id}`, true);
      const xLength = chart.type === "scatter" && (series.xRange !== undefined || series.xValues !== undefined) ? chartSourceLength(series.xSheet ?? chart.xSheet ?? chart.sheet, series.xRange, series.xValues, `eixo X de ${series.id}`, true) : length;
      if (seriesLength !== xLength) fail(`série ${series.id} tem comprimento diferente do eixo X.`);
    }
  }
  if (def.ui?.initialSheet !== undefined && !ids.has(def.ui.initialSheet)) fail("aba inicial inexistente.");
  if (def.persistence && (!record(def.persistence) || (def.persistence.key !== undefined && !text(def.persistence.key)) || (def.persistence.legacyExerciseId !== undefined && !text(def.persistence.legacyExerciseId)))) fail("persistência inválida.");
}

export function validateExerciseDefinition(value: unknown): asserts value is ExerciseDefinition {
  try { checkExerciseDefinition(value); }
  catch (error) {
    if (error instanceof Error && error.message.startsWith("ExerciseDefinition inválido:")) throw error;
    fail(`estrutura incompatível: ${error instanceof Error ? error.message : "dados inválidos"}`);
  }
}
