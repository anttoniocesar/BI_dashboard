import type { SheetBounds } from "@/types/spreadsheet";
import type { ChartDefinition } from "@/types/exercise";

export type Compatibility = "SUPPORTED" | "PARTIALLY_SUPPORTED" | "UNSUPPORTED";
export type ImportIssue = { level: "OK" | "WARNING" | "ERROR"; code: string; message: string; sheet?: string; cell?: string; part?: string };
export type ImportedColor = { argb?: string; theme?: number; indexed?: number; tint?: number };
export type ImportedStyle = {
  bold?: boolean; italic?: boolean; fontColor?: ImportedColor;
  fill?: { type: string; pattern?: string; color?: ImportedColor };
  alignment?: { horizontal?: string; vertical?: string; wrapText?: boolean; textRotation?: number | string };
  numberFormat?: string;
  protection?: { locked?: boolean; hidden?: boolean };
};
export type ImportedFormula = { expression: string; kind: "normal" | "shared" | "array"; cachedResult?: string | number | boolean | null };
export type ImportedCell = {
  address: string; kind: "text" | "number" | "boolean" | "blank" | "date" | "error" | "formula";
  value: string | number | boolean | null;
  formula?: ImportedFormula; style?: ImportedStyle; hyperlink?: string; mergedInto?: string; notices?: string[];
};
export type ImportedChart = { id: string; part: string; types: string[]; sheetName?: string; compatibility: Compatibility; reasons: string[]; definition?: ChartDefinition };
export type ImportedWorksheet = {
  name: string; order: number; usedRange: string | null; dimensions: SheetBounds;
  cells: ImportedCell[]; merges: string[];
  mergeIssues?: { range: string; reason: string }[];
  columns: { index: number; width?: number; hidden?: boolean }[];
  rows: { index: number; height?: number; hidden?: boolean }[];
  metadata: { visibility: string; protection?: Record<string, string> };
};
export type ImportedWorkbook = {
  fileName: string; worksheets: ImportedWorksheet[]; charts: ImportedChart[];
  metadata: {
    creator?: string; dateSystem: "1900" | "1904"; parts: string[];
    definedNames: { name: string; expression: string; localSheetId?: string }[];
    features: { kind: string; part: string; detail?: string }[];
  };
};
export type NormalizedFormula = ImportedFormula & { compatibility: Compatibility; functions: string[]; reasons: string[]; blocked: boolean };
export type NormalizedCell = Omit<ImportedCell, "style" | "formula"> & { styleId?: string; formula?: NormalizedFormula };
export type NormalizedWorksheet = Omit<ImportedWorksheet, "cells"> & { id: string; cells: Record<string, NormalizedCell> };
export type NormalizedWorkbook = Omit<ImportedWorkbook, "worksheets"> & {
  schemaVersion: 1; worksheets: NormalizedWorksheet[]; styles: Record<string, ImportedStyle>;
};
export type ImportReport = {
  sheets: number; cells: number; populatedCells: number; formulas: number;
  supportedFormulas: number; partiallySupportedFormulas: number; unsupportedFormulas: number;
  charts: number; importedCharts?: number; unsupportedCharts?: number; warnings: number; errors: number;
  items: ImportIssue[];
};
export type ImportResult = { ok: true; workbook: NormalizedWorkbook; report: ImportReport } | { ok: false; failureKind?: "invalid" | "unsupported" | "internal"; report: ImportReport };
