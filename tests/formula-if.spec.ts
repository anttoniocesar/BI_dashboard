import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { calculateSheet, calculateWorkbook, translateFormula } from "../lib/spreadsheet/formula-engine";
import { importWorkbook } from "../lib/excel-import/importWorkbook";
import { createExerciseDefinitionFromImport } from "../lib/excel-import/createExerciseDefinitionFromImport";
import { workbookBounds } from "../lib/exercises/definition";
import { cloneWorkbook } from "../lib/spreadsheet/workbook";
import type { Workbook } from "../types/spreadsheet";

const bounds = { rows: 40, columns: 20 };
const cases: [string, string, string | number | boolean][] = [
  ["número verdadeiro", "=IF(A1>0,1,0)", 1],
  ["número falso", "=IF(A1<0,1,0)", 0],
  ["texto", '=IF(A1>0,"Positivo","Negativo")', "Positivo"],
  ["boolean verdadeiro", "=IF(TRUE,TRUE,FALSE)", true],
  ["boolean falso", "=IF(FALSE,TRUE,FALSE)", false],
  ["aninhado", '=IF(A1<0,"Negativo",IF(A1>0,"Positivo","Zero"))', "Positivo"],
  ["três níveis", "=IF(A1<0,0,IF(A1=0,1,IF(A1=2,2,3)))", 2],
  ["referência", "=IF(A1>0,B1,C1)", 8],
  ["expressão", "=IF(A1>0,B1*2,C1/2)", 16],
  ["outra função", "=SUM(IF(A1>0,SUM(B1:C1),0),1)", 13],
  [">", "=IF(A1>2,1,0)", 0], ["<", "=IF(A1<3,1,0)", 1],
  [">=", "=IF(A1>=2,1,0)", 1], ["<=", "=IF(A1<=2,1,0)", 1],
  ["=", "=IF(A1=2,1,0)", 1], ["<>", "=IF(A1<>2,1,0)", 0],
  ["string vazia", '=IF(TRUE,"","outra")', ""],
  ["aspas e pontuação", '=IF(TRUE,"IF(A1, B1); ""olá""","não")', 'IF(A1, B1); "olá"'],
  ["precedência", "=2*IF(TRUE,-2,3)^2", 8],
  ["lazy divisão", "=IF(A2=0,0,1/A2)", 0],
  ["lazy ramo verdadeiro", "=IF(FALSE,1/0,7)", 7],
  ["lazy referência com erro", "=IF(TRUE,7,D1)", 7],
  ["lazy referência inválida", "=IF(TRUE,7,Z99)", 7],
  ["lazy ciclo", "=IF(TRUE,7,Q1)", 7],
  ["lazy IF aninhado", "=IF(TRUE,7,IF(1/0,1,2))", 7],
];
for (const [name, formula, expected] of cases) test(`IF: ${name}`, () => {
  const result = calculateSheet({ A1: "2", A2: "0", B1: "8", C1: "4", D1: "=1/0", Q1: formula }, bounds).Q1;
  expect(result.error).toBeUndefined();
  expect(result.calculatedValue).toBe(expected);
});

test("IF: erros selecionados, condição inválida e funções fora do escopo", () => {
  for (const [formula, error] of [
    ["=IF(TRUE,1/0,7)", "#DIV/0!"], ["=IF(1/0,1,2)", "#DIV/0!"],
    ["=IF(TRUE,Z99,7)", "#REF!"], ['=IF("texto",1,2)', "#VALUE!"],
    ["=IF(TRUE,1)", "#VALUE!"], ["=IF(TRUE,1,2,3)", "#VALUE!"],
    ["=MISSING(1)", "#NAME?"], ["=AND(TRUE,FALSE)", "#NAME?"],
  ]) expect(calculateSheet({ A1: formula }, bounds).A1.error, formula).toBe(error);
});

test("IF: ambos os ramos e condição recalculam, inclusive entre abas", () => {
  const workbook: Workbook = { worksheets: [
    { id: "output", name: "Saída", cells: { A1: "=IF(Dados!A1>0,Dados!B1,Dados!C1)" } },
    { id: "data", name: "Dados", cells: { A1: "1", B1: "8", C1: "4" } },
  ] };
  const result = () => calculateWorkbook(workbook, bounds).output.A1.calculatedValue;
  expect(result()).toBe(8);
  workbook.worksheets[1].cells.B1 = "10"; expect(result()).toBe(10);
  workbook.worksheets[1].cells.C1 = "20"; expect(result()).toBe(10);
  workbook.worksheets[1].cells.A1 = "-1"; expect(result()).toBe(20);
  workbook.worksheets[1].cells.C1 = "30"; expect(result()).toBe(30);
  expect(translateFormula('=IF(A1>0,B1,"A1")', { row: 0, column: 0 }, { row: 1, column: 0 }, bounds)).toBe('=IF(A2>0,B2,"A1")');
});

for (const number of [1, 2]) test(`IF: LAB ${number} original, Q11:Q18 contra cache Excel e relatório`, async () => {
  const file = number === 1 ? process.env.BI_SOCIETY_CHART_REGRESSION_PATH : process.env.BI_SOCIETY_LAB2_REGRESSION_PATH;
  test.skip(!file, "Configure o caminho do XLSX original para homologação real.");
  const result = await importWorkbook(readFileSync(file!), `lab-${number}.xlsx`);
  expect(result.ok).toBe(true); if (!result.ok) return;
  const definition = createExerciseDefinitionFromImport(result.workbook, { id: `if-lab-${number}`, version: "1" });
  const workbook = cloneWorkbook(definition.workbook);
  const source = result.workbook.worksheets.find(sheet => sheet.name === "Gabarito")!;
  const sheet = workbook.worksheets.find(sheet => sheet.name === "Gabarito")!;
  const calculate = () => calculateWorkbook(workbook, definition.dimensions, workbookBounds(definition))[sheet.id];
  const calculated = calculate();
  const rows = Array.from({ length: 8 }, (_, index) => {
    const address = `Q${index + 11}`, formula = source.cells[address].formula!;
    expect(formula.compatibility, address).toBe("SUPPORTED");
    expect(formula.cachedResult, address).toBeDefined();
    expect(calculated[address].error, address).toBeUndefined();
    expect(calculated[address].calculatedValue, address).toBe(formula.cachedResult);
    return { address, excel: formula.cachedResult, lab: calculated[address].calculatedValue };
  });
  if (number === 1) {
    expect(calculated.Q11.calculatedValue).toBe("Previsão acima do real");
    sheet.cells.I11 = "1"; expect(calculate().Q11.calculatedValue).toBe("Previsão abaixo do real");
    sheet.cells.I11 = "0"; expect(calculate().Q11.calculatedValue).toBe("Sem erro");
  }
  const diagnostic = { lab: number, rows, report: { ...result.report, items: undefined } };
  console.log(JSON.stringify(diagnostic));
  await test.info().attach(`if-lab-${number}`, { body: JSON.stringify(diagnostic, null, 2), contentType: "application/json" });
});
