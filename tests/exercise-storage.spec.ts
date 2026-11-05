import { expect, test } from "@playwright/test";
import { createStudentWorkbook, masterWorkbook } from "../data/master-workbook";
import { createInitialWorkbook } from "../data/neural-network-demo";
import { exerciseCellRules } from "../data/cell-rules";
import { applyCellEdit, createCellRuleResolver } from "../lib/spreadsheet/cell-rules";
import { clearExerciseState, deserializeExercise, EXERCISE_STORAGE_KEY, loadExerciseState, saveExerciseState, serializeExercise } from "./fixtures/neural-storage";
import { calculateWorkbook } from "../lib/spreadsheet/formula-engine";
import { validateExercise } from "../lib/validation/validateExercise";
import { exerciseValidationConfig } from "../data/exercises/neural-validation";

const resolve = createCellRuleResolver(exerciseCellRules);
const snapshot = () => ({ workbook: createInitialWorkbook(), activeSheet: "treinamento", selections: { treinamento: { row: 1, column: 5 } }, validation: "verified" as const });

test("Modelo Mestre congelado, respostas vazias e cópias independentes", () => {
  expect(Object.isFrozen(masterWorkbook)).toBe(true);
  expect(Object.isFrozen(masterWorkbook.worksheets[1].cells)).toBe(true);
  const workbook = createStudentWorkbook();
  expect(workbook.worksheets[1].cells.F2).toBeUndefined();
  expect(workbook.worksheets[1].cells.H2).toBeUndefined();
  const edited = applyCellEdit(workbook, resolve, "treinamento", { row: 1, column: 5 }, "=1+2");
  expect(edited.worksheets[1].cells.F2).toBe("=1+2");
  expect(createStudentWorkbook()).toEqual(masterWorkbook);
  expect(masterWorkbook.worksheets[2].cells.B8).toBe("=AVERAGE(D2:D6)");
});

test("round-trip preserva fórmulas e seleção; restaura cálculos, nota e proteção a partir da configuração", () => {
  const saved = serializeExercise(snapshot());
  expect(saved.cells).toHaveLength(20);
  expect(saved.cells.some(cell => cell.worksheetId === "dados")).toBe(false);
  const restored = deserializeExercise(JSON.parse(JSON.stringify(saved)))!;
  expect(restored.workbook.worksheets[1].cells.F2).toBe("=B2*D2+C2*E2");
  expect(restored.activeSheet).toBe("treinamento");
  expect(restored.selections.treinamento).toEqual({ row: 1, column: 5 });
  expect(resolve("resultados", { row: 7, column: 1 }).readOnly).toBe(true);
  const result = validateExercise(calculateWorkbook(restored.workbook, { rows: 40, columns: 12 }), exerciseValidationConfig);
  expect(result).toMatchObject({ correctCount: 5, earnedPoints: 70, scorePercent: 100, completed: true });
});

test("dados inválidos, incompatíveis, duplicados e tentativa de sobrescrever protegidas são rejeitados", () => {
  const saved = serializeExercise(snapshot());
  for (const invalid of [null, [], {}, { ...saved, version: 2 }, { ...saved, exerciseId: "outro" },
    { ...saved, activeSheet: "ausente" }, { ...saved, validation: "approved" }, { ...saved, lastSavedAt: "ontem" },
    { ...saved, selections: { treinamento: { row: 40, column: 5 } } },
    { ...saved, cells: [{ worksheetId: "dados", address: "B2", raw: "999" }] },
    { ...saved, cells: [{ worksheetId: "treinamento", address: "F99", raw: "1" }] },
    { ...saved, cells: [{ worksheetId: "treinamento", address: "F2", raw: 1 }] },
    { ...saved, cells: [saved.cells[0], saved.cells[0]] }]) expect(deserializeExercise(invalid)).toBeNull();
});

test("camada de armazenamento tolera JSON corrompido, quota e acesso bloqueado", () => {
  const fail = () => { throw new Error("Storage denied"); };
  expect(loadExerciseState({ getItem: () => "{broken" })).toEqual({ session: null, error: false });
  expect(loadExerciseState({ getItem: fail })).toEqual({ session: null, error: true });
  expect(saveExerciseState(snapshot(), { setItem: fail })).toBeNull();
  expect(clearExerciseState({ removeItem: fail })).toBe(false);
  const store = new Map<string, string>();
  const adapter = { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => { store.set(key, value); }, removeItem: (key: string) => { store.delete(key); } };
  expect(saveExerciseState(snapshot(), adapter)).toBeTruthy();
  expect(store.has(EXERCISE_STORAGE_KEY)).toBe(true);
  expect(loadExerciseState(adapter).session?.validation).toBe("verified");
  expect(clearExerciseState(adapter)).toBe(true);
  expect(loadExerciseState(adapter).session).toBeNull();
});
