import type { CalculatedCell, CalculatedWorkbook } from "@/types/spreadsheet";
import type { ChartDefinition } from "@/types/exercise";
import { parseCellAddress, rangeAddresses } from "@/lib/spreadsheet/coordinates";

export type ResultChartPoint = { row: number; sample: string | number; values: Record<string, number | null>; x?: Record<string, number | null> };
export type WorkbookChartData = { points: ResultChartPoint[] };
function present(cell: CalculatedCell | undefined): cell is CalculatedCell {
  return !!cell && !cell.error && cell.raw.trim() !== "";
}
export function chartNumber(cell: CalculatedCell | undefined): number | null {
  return present(cell) && typeof cell.calculatedValue === "number" && Number.isFinite(cell.calculatedValue) ? cell.calculatedValue : null;
}
/** Axes and series come only from the declared ranges; no exercise-specific keys. */
export function workbookChartData(calculated: CalculatedWorkbook, chart: ChartDefinition): WorkbookChartData {
  const xAddresses = chart.xRange ? rangeAddresses(chart.xRange) : [];
  const sheet = calculated[chart.xSheet ?? chart.sheet] ?? {};
  const samples = chart.xRange ? xAddresses.map(address => present(sheet[address]) ? sheet[address].calculatedValue : null) : chart.xValues ?? [];
  const numeric = (sheetId: string, range?: string, values?: (number | null)[]) => range ? rangeAddresses(range).map(address => chartNumber(calculated[sheetId]?.[address])) : values ?? [];
  const sources = chart.series.map(series => ({ id: series.id, values: numeric(series.sheet ?? chart.sheet, series.range, series.values),
    x: chart.type === "scatter" ? series.xRange || series.xValues ? numeric(series.xSheet ?? chart.xSheet ?? chart.sheet, series.xRange, series.xValues) : samples.map(value => typeof value === "number" && Number.isFinite(value) ? value : null) : [] }));
  const points: ResultChartPoint[] = [];
  const length = chart.type === "scatter" ? Math.max(samples.length, ...sources.map(source => source.values.length)) : samples.length;
  for (let index = 0; index < length; index++) {
    const value = samples[index];
    const valid = typeof value === "number" ? Number.isFinite(value) : typeof value === "string" && !!value.trim();
    if (!valid && chart.type !== "scatter") continue;
    points.push({ row: xAddresses[index] ? parseCellAddress(xAddresses[index]).row + 1 : index + 1, sample: valid ? value as string | number : index + 1,
      values: Object.fromEntries(sources.map(series => [series.id, series.values[index] ?? null])),
      ...(chart.type === "scatter" ? { x: Object.fromEntries(sources.map(series => [series.id, series.x[index] ?? null])) } : {}) });
  }
  return { points };
}
export function resolveChartText(calculated: CalculatedWorkbook, chart: ChartDefinition): ChartDefinition {
  const text = (ref: { sheet: string; cell: string } | undefined, fallback: string) => {
    const cell = ref && calculated[ref.sheet]?.[ref.cell];
    return cell && !cell.error && cell.calculatedValue !== null ? String(cell.calculatedValue).trim() || fallback : fallback;
  };
  return { ...chart, title: text(chart.titleRef, chart.title), series: chart.series.map(series => ({ ...series, name: text(series.nameRef, series.name) })) };
}
export function formatChartNumber(value: number): string { return String(Number(value.toPrecision(6))); }
