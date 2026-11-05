import { expect, test } from "@playwright/test";
import { createInitialWorkbook } from "../data/neural-network-demo";
import { calculateWorkbook, translateFormula } from "../lib/spreadsheet/formula-engine";
import type { Workbook } from "../types/spreadsheet";

const bounds = { rows: 40, columns: 12 };

test("exercício: cinco amostras, pesos, ABS e MAE sem erros", () => {
  const workbook = createInitialWorkbook();
  const result = calculateWorkbook(workbook, bounds);
  expect(result.treinamento.F2.calculatedValue).toBeCloseTo(0.16, 12);
  expect(result.treinamento.H2.calculatedValue).toBeCloseTo(0.14, 12);
  expect(result.treinamento.I2.calculatedValue).toBeCloseTo(0.2028, 12);
  expect(result.treinamento.J2.calculatedValue).toBeCloseTo(0.3056, 12);
  expect(result.resultados.D2.calculatedValue).toBeCloseTo(0.14, 12);
  expect(result.resultados.B8.calculatedValue).toBeCloseTo(0.23885997636184, 12);
  for (const sheet of Object.values(result)) {
    for (const cell of Object.values(sheet)) expect(cell.error, cell.raw).toBeUndefined();
  }
  const changed: Workbook = { worksheets: workbook.worksheets.map(sheet => sheet.id === "dados" ? { ...sheet, cells: { ...sheet.cells, B2: "0.40" } } : sheet) };
  const updated = calculateWorkbook(changed, bounds);
  expect(updated.treinamento.B2.calculatedValue).toBe(0.4);
  expect(updated.treinamento.F2.calculatedValue).toBeCloseTo(0.2, 12);
  expect(updated.resultados.C2.calculatedValue).toBeCloseTo(0.2, 12);
  expect(updated.resultados.D2.calculatedValue).toBeCloseTo(0.1, 12);
  expect(updated.resultados.B8.calculatedValue).not.toBe(result.resultados.B8.calculatedValue);
  expect(workbook.worksheets[0].cells.B2).toBe("0.20");
});

test("abas: contexto local, expressões mistas, nomes com acento e intervalos iguais em abas distintas", () => {
  // Put the dependent sheet first so the cache cannot hide missing dependencies.
  const workbook: Workbook = { worksheets: [
    { id: "resultados", name: "Resultados", cells: {
      A1: "=SUM(Dados!A1:A2,Treinamento!A1:A2)",
      A2: "=SUM(Dados!A1:A2,Treinamento!A1)",
      A3: "=Dados!B2*Treinamento!D2", A4: "='Análise'!B3", A5: "=dados!B2",
      A6: "=AVERAGE(Dados!A1:A2)", A7: "=Ausente!A1",
    } },
    { id: "dados", name: "Dados", cells: { A1: "1", A2: "2", B2: "0.20", B10: "0.10" } },
    { id: "treinamento", name: "Treinamento", cells: { A1: "10", A2: "20", B2: "5", D2: "0.20", E2: "=B2*Dados!$B$10" } },
    { id: "analise", name: "Análise", cells: { B3: "Resposta livre" } },
  ] };
  const result = calculateWorkbook(workbook, bounds);
  expect(result.resultados.A1.calculatedValue).toBe(33);
  expect(result.resultados.A2.calculatedValue).toBe(13);
  expect(result.resultados.A3.calculatedValue).toBeCloseTo(0.04, 12);
  expect(result.resultados.A4.calculatedValue).toBe("Resposta livre");
  expect(result.resultados.A5.calculatedValue).toBe(0.2);
  expect(result.resultados.A6.calculatedValue).toBe(1.5);
  expect(result.resultados.A7.error).toBe("#REF!");
  expect(result.treinamento.E2.calculatedValue).toBe(0.5);
});

test("ciclos e propagação de erros entre abas; coordenadas iguais são independentes", () => {
  const result = calculateWorkbook({ worksheets: [
    { id: "dados", name: "Dados", cells: { A1: "=Treinamento!A1", B1: "=1/0", C1: "=Z99", D1: "30" } },
    { id: "treinamento", name: "Treinamento", cells: { A1: "=Dados!A1", B1: "=Dados!B1", C1: "=SUM(Dados!C1:C2)", D1: "=Dados!D1" } },
  ] }, bounds);
  expect(result.dados.A1.error).toBe("#CYCLE!");
  expect(result.treinamento.A1.error).toBe("#CYCLE!");
  expect(result.treinamento.B1.error).toBe("#DIV/0!");
  expect(result.treinamento.C1.error).toBe("#REF!");
  expect(result.treinamento.D1.calculatedValue).toBe(30);
});

test("cópia entre abas preserva nome e $ em referências absolutas e mistas", () => {
  const source = { row: 1, column: 8 };
  const target = { row: 2, column: 9 };
  expect(translateFormula("=D2+Dados!$B$10*H2*B2", source, target, bounds)).toBe("=E3+Dados!$B$10*I3*C3");
  expect(translateFormula("=Dados!$B2+Treinamento!B$1", source, target, bounds)).toBe("=Dados!$B3+Treinamento!C$1");
  expect(translateFormula("='Análise'!B3", source, target, bounds)).toBe("='Análise'!C4");
});
