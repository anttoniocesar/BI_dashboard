import type { ReadonlyWorkbook, SheetBounds } from "./spreadsheet";
import type { WorkbookCellRules } from "./cell-rules";
import type { ValidationRule } from "./validation";

export type ChartType = "line" | "column" | "bar" | "pie" | "scatter";
export type ChartCellReference = { sheet: string; cell: string };
export type ChartAnchor = { fromRow: number; fromCol: number; toRow: number; toCol: number; width?: number; height?: number };
export type ChartAxis = { min?: number; max?: number; reversed?: boolean };
export type ChartSeriesDefinition = {
  id: string; name: string; range?: string; sheet?: string; values?: (number | null)[]; color: string; dashed?: boolean;
  nameRef?: ChartCellReference; xRange?: string; xSheet?: string; xValues?: (number | null)[];
};
export type ChartDefinition = {
  id: string; sheet: string; type: ChartType; title: string; xRange?: string; xSheet?: string; xValues?: (string | number | null)[];
  series: ChartSeriesDefinition[]; xAxisLabel?: string; yAxisLabel?: string; legend?: boolean;
  titleRef?: ChartCellReference; anchor?: ChartAnchor; legendPosition?: "top" | "bottom" | "left" | "right";
  xAxis?: ChartAxis; yAxis?: ChartAxis; grouping?: "standard" | "stacked";
};
export type MetricDefinition = { id: string; sheet: string; cell: string; title: string; detail?: string; ariaLabel: string };
export type SheetPresentation = {
  dimensions?: SheetBounds;
  columnWidths?: Record<string, number>;
  rowHeights?: Record<string, number>;
  cellAlignment?: Record<string, { horizontal?: "left" | "center" | "right" | "justify"; vertical?: "top" | "middle" | "bottom"; wrapText?: boolean }>;
  headerRows?: number[];
  viewportHeight?: number;
  charts?: { title: string; description?: string; ariaLabel: string; metrics?: MetricDefinition[] };
};
export type ExerciseDefinition = {
  id: string; version: string; title: string; subtitle?: string;
  workbook: ReadonlyWorkbook;
  dimensions: SheetBounds;
  sheets?: Record<string, SheetPresentation>;
  cellRules: WorkbookCellRules;
  validationRules: ValidationRule[];
  charts: ChartDefinition[];
  completion: { minimumScore: number };
  persistence?: { key?: string; legacyExerciseId?: string };
  ui?: { documentLabel?: string; eyebrow?: string; initialSheet?: string };
};
