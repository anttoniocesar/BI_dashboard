import { expect, test } from "@playwright/test";
import { createInitialWorkbook } from "../data/neural-network-demo";
import { calculateWorkbook } from "../lib/spreadsheet/formula-engine";
import { chartNumber } from "../lib/charts/workbookChartData";
import { workbookChartData } from "./fixtures/neural-chart-data";
import type { CalculatedCell, CalculatedWorkbook } from "../types/spreadsheet";

const cell = (value: CalculatedCell["calculatedValue"], raw = String(value)): CalculatedCell => ({ raw, calculatedValue: value });

test("dataset lê os cinco resultados e o MAE do cálculo atual, sem alterar o workbook", () => {
  const workbook = createInitialWorkbook();
  const calculated = calculateWorkbook(workbook, { rows: 40, columns: 12 });
  const source = JSON.stringify(calculated);
  const dataset = workbookChartData(calculated);
  expect(dataset.points).toHaveLength(5);
  expect(dataset.points[0]).toMatchObject({ row: 2, sample: 1, actual: 0.3 });
  expect(dataset.points[0].predicted).toBeCloseTo(0.16, 12);
  expect(dataset.points[0].absoluteError).toBeCloseTo(0.14, 12);
  expect(dataset.mae).toBeCloseTo(0.23885997636184, 12);
  workbook.worksheets[0].cells.B2 = "0.40";
  const updated = workbookChartData(calculateWorkbook(workbook, { rows: 40, columns: 12 }));
  expect(updated.points[0].predicted).toBeCloseTo(0.2, 12);
  expect(updated.points[0].absoluteError).toBeCloseTo(0.1, 12);
  expect(updated.mae).not.toBe(dataset.mae);
  expect(JSON.stringify(calculated)).toBe(source);
});

test("valores inválidos viram lacunas; zero numérico permanece zero", () => {
  for (const invalid of [undefined, cell(null), cell(""), cell(" "), cell("texto"), cell("0.50"), cell(false), cell(NaN), cell(Infinity), cell(-Infinity), { ...cell(7), error: "#ERROR!" }]) {
    expect(chartNumber(invalid)).toBeNull();
  }
  expect(chartNumber(cell(0, "0"))).toBe(0);
  expect(chartNumber(cell(0, "=SUM(A1:A2)"))).toBe(0);
  const calculated: CalculatedWorkbook = { resultados: {
    A2: cell(1), B2: cell(0), C2: cell("inválido"), D2: { ...cell("#DIV/0!"), error: "#DIV/0!" },
    A3: cell(2), B3: cell(0.7), C3: cell(0.5), D3: cell(0.2),
  } };
  expect(workbookChartData(calculated)).toEqual({ points: [
    { row: 2, sample: 1, actual: 0, predicted: null, absoluteError: null },
    { row: 3, sample: 2, actual: 0.7, predicted: 0.5, absoluteError: 0.2 },
  ], mae: null });
});

test("amostra inválida é omitida; rótulos textuais válidos são preservados", () => {
  expect(workbookChartData({ resultados: {
    A2: cell(null), B2: cell(0.5),
    A3: { ...cell("#REF!"), error: "#REF!" }, B3: cell(0.5),
    A4: cell("Lote A"), B4: cell(0.5), C4: cell(0.4),
    A5: cell(false), A6: cell(Infinity),
  } }).points).toEqual([
    { row: 4, sample: "Lote A", actual: 0.5, predicted: 0.4, absoluteError: null },
  ]);
  expect(workbookChartData({ resultados: { A2: { ...cell("#REF!"), error: "#REF!" } } }).points).toEqual([]);
});

test("workbook sem resultados ou com células vazias gera dataset vazio", () => {
  expect(workbookChartData({})).toEqual({ points: [], mae: null });
  expect(workbookChartData({ resultados: {} })).toEqual({ points: [], mae: null });
});
