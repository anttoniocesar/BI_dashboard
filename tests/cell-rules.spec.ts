import { expect, test } from "@playwright/test";
import { exerciseCellRules } from "../data/cell-rules";
import { createInitialWorkbook } from "../data/neural-network-demo";
import { applyCellEdit, createCellRuleResolver } from "../lib/spreadsheet/cell-rules";

test("prioridade: célula > último intervalo correspondente > padrão da aba", () => {
  const resolve = createCellRuleResolver({ teste: {
    default: "provided",
    ranges: [{ range: "A1:D10", role: "answer" }, { range: "B2:C3", role: "calculated" }],
    cells: { B2: "editable" },
  } });
  expect(resolve("teste", { row: 10, column: 0 })).toEqual({ role: "provided", readOnly: true });
  expect(resolve("teste", { row: 0, column: 0 })).toEqual({ role: "answer", readOnly: false });
  expect(resolve("teste", { row: 2, column: 1 })).toEqual({ role: "calculated", readOnly: true });
  expect(resolve("teste", { row: 1, column: 1 })).toEqual({ role: "editable", readOnly: false });
  expect(resolve("ausente", { row: 0, column: 0 }).readOnly).toBe(true);
});

test("intervalos inclusivos, letras múltiplas e normalização de endereços", () => {
  const resolve = createCellRuleResolver({ teste: { default: "provided", ranges: [{ range: "$AA$3:AB4", role: "answer" }], cells: { " $ab$4 ": "calculated" } } });
  expect(resolve("teste", { row: 2, column: 26 }).readOnly).toBe(false);
  expect(resolve("teste", { row: 3, column: 26 }).readOnly).toBe(false);
  expect(resolve("teste", { row: 3, column: 27 }).readOnly).toBe(true);
  expect(resolve("teste", { row: 4, column: 26 }).readOnly).toBe(true);
  expect(() => createCellRuleResolver({ teste: { default: "provided", ranges: [{ range: "A0:B1", role: "answer" }] } })).toThrow();
});

test("configuração do exercício protege Dados/Resultados e libera apenas as respostas", () => {
  const resolve = createCellRuleResolver(exerciseCellRules);
  for (const id of ["dados", "resultados"]) {
    for (let row = 0; row < 40; row++) for (let column = 0; column < 12; column++) expect(resolve(id, { row, column }).readOnly).toBe(true);
  }
  for (const column of [5, 7, 8, 9]) for (let row = 1; row <= 5; row++) expect(resolve("treinamento", { row, column })).toEqual({ role: "answer", readOnly: false });
  for (const column of [0, 1, 2, 3, 4, 6]) expect(resolve("treinamento", { row: 1, column }).readOnly).toBe(true);
  for (const row of [2, 5, 8]) expect(resolve("analise", { row, column: 1 }).readOnly).toBe(false);
  expect(resolve("analise", { row: 1, column: 1 }).readOnly).toBe(true);
});

test("guarda de escrita impede alteração/limpeza direta mesmo sem passar pela interface", () => {
  const resolve = createCellRuleResolver(exerciseCellRules);
  const workbook = createInitialWorkbook();
  for (const value of ["999", "", "=1+1", "texto colado"]) {
    expect(applyCellEdit(workbook, resolve, "dados", { row: 1, column: 1 }, value)).toBe(workbook);
    expect(applyCellEdit(workbook, resolve, "resultados", { row: 7, column: 1 }, value)).toBe(workbook);
  }
  const edited = applyCellEdit(workbook, resolve, "treinamento", { row: 1, column: 5 }, "=Dados!B2");
  expect(edited.worksheets[1].cells.F2).toBe("=Dados!B2");
  expect(edited.worksheets[0]).toBe(workbook.worksheets[0]);
  expect(workbook.worksheets[1].cells.F2).toBe("=B2*D2+C2*E2");
  const cleared = applyCellEdit(edited, resolve, "treinamento", { row: 1, column: 5 }, "");
  expect(cleared.worksheets[1].cells.F2).toBeUndefined();
});
