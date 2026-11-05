import { expect, test } from "@playwright/test";
import { createInitialWorkbook } from "../data/neural-network-demo";
import { calculateWorkbook } from "../lib/spreadsheet/formula-engine";
import { validateCell } from "../lib/validation/validateCell";
import { validateExercise } from "../lib/validation/validateExercise";
import { exerciseValidationConfig } from "../data/exercises/neural-validation";
import type { CalculatedCell } from "../types/spreadsheet";
import type { ExerciseValidationConfig, ValidationRule } from "../types/validation";

const cell = (value: CalculatedCell["calculatedValue"], raw = String(value)): CalculatedCell => ({ raw, calculatedValue: value, formula: raw.startsWith("=") ? raw : undefined });
const rule: ValidationRule = { id: "numeric", worksheetId: "teste", cell: "A1", label: "Número", type: "number", expected: 10, feedback: "Revise o cálculo." };
const bounds = { rows: 40, columns: 12 };

test("cinco regras iniciais: 70 pontos, 100%, sem alterar o workbook ou expor o gabarito no resultado", () => {
  const workbook = createInitialWorkbook();
  const before = JSON.stringify(workbook);
  const calculated = calculateWorkbook(workbook, bounds);
  const result = validateExercise(calculated, exerciseValidationConfig);
  expect(result).toMatchObject({ totalCount: 5, correctCount: 5, earnedPoints: 70, possiblePoints: 70, accuracyPercent: 100, scorePercent: 100, completed: true });
  expect(result.cells.every(item => item.status === "correct")).toBe(true);
  for (const item of result.cells) {
    expect(item).not.toHaveProperty("expected");
    expect(item).not.toHaveProperty("tolerance");
    expect(item).not.toHaveProperty("formula");
  }
  expect(JSON.stringify(workbook)).toBe(before);
});

test("número exato, zero válido e rejeição de valores não numéricos/não finitos", () => {
  expect(validateCell(cell(10), rule).status).toBe("correct");
  expect(validateCell(cell(10.0000001), rule).status).toBe("incorrect");
  expect(validateCell(cell(0), { ...rule, expected: 0 }).status).toBe("correct");
  for (const value of ["10", false, null, Infinity, NaN]) expect(validateCell(cell(value), rule).status).toBe("incorrect");
});

test("tolerância absoluta inclusiva nas duas extremidades; fora do intervalo é incorreto", () => {
  const tolerant: ValidationRule = { ...rule, expected: 0.16, tolerance: 0.001 };
  for (const value of [0.159, 0.16, 0.161, 0.1605]) expect(validateCell(cell(value), tolerant).status).toBe("correct");
  for (const value of [0.15899999, 0.16100001]) expect(validateCell(cell(value), tolerant).status).toBe("incorrect");
});

test("fórmula obrigatória aceita expressão equivalente e rejeita número digitado", () => {
  for (const formula of ["=B2*D2+C2*E2", "=D2*B2+E2*C2"]) {
    const workbook = createInitialWorkbook();
    workbook.worksheets[1].cells.F2 = formula;
    const result = validateExercise(calculateWorkbook(workbook, bounds), exerciseValidationConfig);
    expect(result.cells[0].status).toBe("correct");
  }
  const workbook = createInitialWorkbook();
  workbook.worksheets[1].cells.F2 = "0.16";
  const result = validateExercise(calculateWorkbook(workbook, bounds), exerciseValidationConfig);
  expect(result.cells[0]).toMatchObject({ status: "incorrect", reason: "formula-required", pointsEarned: 0 });
});

test("resposta ausente e erros de fórmula recebem feedback sem quebrar", () => {
  for (const missing of [undefined, cell(""), cell("  ")]) expect(validateCell(missing, rule).status).toBe("unanswered");
  for (const error of ["#ERROR!", "#REF!", "#DIV/0!", "#CYCLE!"]) {
    const result = validateCell({ ...cell(error, "=1/0"), error }, rule);
    expect(result).toMatchObject({ status: "incorrect", reason: "formula-error", pointsEarned: 0 });
    expect(result.feedback).toContain("A fórmula contém um erro.");
  }
});

test("texto simples ignora caixa e espaços externos, mas não aceita número como texto", () => {
  const textual: ValidationRule = { id: "text", worksheetId: "analise", cell: "B3", label: "Texto", type: "text", expected: "Peso inicial", feedback: "Revise seu texto." };
  expect(validateCell(cell("  PESO INICIAL  "), textual).status).toBe("correct");
  expect(validateCell(cell("peso final"), textual).status).toBe("incorrect");
  expect(validateCell(cell(10), textual).reason).toBe("not-text");
});

test("nota ponderada difere da contagem de acertos; conclusão inclui exatamente 70%", () => {
  const config: ExerciseValidationConfig = { minimumScore: 70, rules: [{ ...rule, id: "one", cell: "A1", points: 7 }, { ...rule, id: "two", cell: "A2", points: 3 }] };
  const result = validateExercise({ teste: { A1: cell(10), A2: cell(0) } }, config);
  expect(result).toMatchObject({ correctCount: 1, reviewCount: 1, accuracyPercent: 50, scorePercent: 70, earnedPoints: 7, possiblePoints: 10, completed: true });
  expect(validateExercise({ teste: { A1: cell(0), A2: cell(10) } }, config).completed).toBe(false);
  expect(validateExercise({}, { minimumScore: 70, rules: [] })).toMatchObject({ scorePercent: 0, completed: false });
});

test("nova verificação reavalia a correção; configuração inválida não produz pontuação enganosa", () => {
  const config: ExerciseValidationConfig = { rules: [rule], minimumScore: 70 };
  expect(validateExercise({ teste: { A1: cell(1) } }, config).cells[0].status).toBe("incorrect");
  expect(validateExercise({ teste: { A1: cell(10) } }, config).cells[0].status).toBe("correct");
  expect(() => validateExercise({}, { ...config, minimumScore: 101 })).toThrow();
  expect(() => validateExercise({}, { ...config, rules: [{ ...rule, points: -1 }] })).toThrow();
  expect(() => validateExercise({}, { ...config, rules: [{ ...rule, tolerance: -1 }] })).toThrow();
});
