import { expect, test } from "@playwright/test";
import { calculateSheet, translateFormula } from "../lib/spreadsheet/formula-engine";

const bounds = { rows: 40, columns: 12 };

test("AVERAGE(A1:A2): recalcula de 25 para 30 quando A2 muda de 20 para 30", () => {
  const data = { A1: "30", A2: "20", C1: "=AVERAGE(A1:A2)" };
  expect(calculateSheet(data, bounds).C1.calculatedValue).toBe(25);
  expect(calculateSheet({ ...data, A2: "30" }, bounds).C1.calculatedValue).toBe(30);
});

test("motor: operações e as sete funções", () => {
  const examples: [string, number][] = [
    ["=A1+B1", 15], ["=A1-B1", 5], ["=A1*B1", 50], ["=A1/B1", 2], ["=B1^2", 25],
    ["=SUM(A1:A3)", 60], ["=AVERAGE(A1:A3)", 20], ["=MIN(A1:A3)", 10],
    ["=MAX(A1:A3)", 30], ["=ABS(-7)", 7], ["=SQRT(81)", 9], ["=POWER(2,3)", 8],
  ];
  for (const [formula, expected] of examples) {
    const result = calculateSheet({ A1: "10", A2: "20", A3: "30", B1: "5", C1: formula }, bounds).C1;
    expect(result, formula).toMatchObject({ raw: formula, formula, calculatedValue: expected });
    expect(result.error, formula).toBeUndefined();
  }
});

test("motor: dependências encadeadas, recálculo e tratamento de erros", () => {
  const data = { A1: "=B1+1", B1: "=C1*2", C1: "4", D1: "=SUM(A1:B1)" };
  expect(calculateSheet(data, bounds).D1.calculatedValue).toBe(17);
  expect(calculateSheet({ ...data, C1: "10" }, bounds).D1.calculatedValue).toBe(41);
  const errors = calculateSheet({ A1: "=1/0", A2: "=Z99", A3: "=A1+", A4: "=B4", B4: "=A4", A5: "=SUM(A1:A2)", A6: "=Ausente!B1", A7: "=SQRT(-1)", A8: "=A30+1", A9: "=", A10: "=SUM(A1:XFD1048576)" }, bounds);
  expect(errors.A1.error).toBe("#DIV/0!");
  expect(errors.A2.error).toBe("#REF!");
  expect(errors.A3.error).toBeTruthy();
  expect(errors.A4.error).toBe("#CYCLE!");
  expect(errors.B4.error).toBe("#CYCLE!");
  expect(errors.A5.error).toBe("#DIV/0!");
  expect(errors.A6.error).toBe("#REF!");
  expect(errors.A7.error).toBe("#NUM!");
  expect(errors.A8.calculatedValue).toBe(1);
  expect(errors.A9.error).toBeTruthy();
  expect(errors.A10.error).toBe("#REF!");
});

test("cópia: referências relativas, absolutas, mistas, intervalos e strings", () => {
  const source = { row: 1, column: 2 };
  expect(translateFormula("=A2*B2", source, { row: 2, column: 2 }, bounds)).toBe("=A3*B3");
  expect(translateFormula("=A2*$B$5", source, { row: 2, column: 2 }, bounds)).toBe("=A3*$B$5");
  expect(translateFormula("=$A2+A$1+$B$5", source, { row: 2, column: 3 }, bounds)).toBe("=$A3+B$1+$B$5");
  expect(translateFormula('=SUM(A1:B2)&"A1"', source, { row: 2, column: 3 }, bounds)).toBe('=SUM(B2:C3)&"A1"');
  expect(translateFormula("=A1", source, { row: 0, column: 2 }, bounds)).toBe("=#REF!");
  expect(translateFormula("texto A1", source, { row: 2, column: 2 }, bounds)).toBe("texto A1");
  expect(translateFormula("=A1+", source, { row: 2, column: 2 }, bounds)).toBe("=A2+");
});
