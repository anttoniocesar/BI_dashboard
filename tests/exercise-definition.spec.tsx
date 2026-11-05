import { expect, test } from "@playwright/test";
import { renderToStaticMarkup } from "react-dom/server";
import { ExerciseLab } from "../components/storage/ExerciseLab";
import { SpreadsheetEditor } from "../components/spreadsheet/SpreadsheetEditor";
import { validateExerciseDefinition, sheetBounds, workbookBounds } from "../lib/exercises/definition";
import { simpleSumDefinition as sum } from "./fixtures/simple-sum";
import { neuralExerciseDefinition as neural } from "../data/exercises/neural-error-correction";
import { cloneWorkbook } from "../lib/spreadsheet/workbook";
import { applyCellEdit, createCellRuleResolver } from "../lib/spreadsheet/cell-rules";
import { calculateWorkbook } from "../lib/spreadsheet/formula-engine";
import { validateExercise } from "../lib/validation/validateExercise";
import { chartNumber, workbookChartData } from "../lib/charts/workbookChartData";
import { clearExerciseState, deserializeExercise, exerciseStorageKey, loadExerciseState, saveExerciseState, serializeExercise } from "../lib/storage/exerciseStorage";
import { normalizeCellAddress, parseCellAddress, parseCellRange, rangeAddresses } from "../lib/spreadsheet/coordinates";
import type { ExerciseDefinition } from "../types/exercise";
import { LocalStorageExerciseRepository } from "../lib/storage/LocalStorageExerciseRepository";

function evaluate(definition: ExerciseDefinition, raw: string) {
  const workbook = applyCellEdit(cloneWorkbook(definition.workbook), createCellRuleResolver(definition.cellRules), "operacao", { row: 0, column: 2 }, raw);
  const calculated = calculateWorkbook(workbook, definition.dimensions, workbookBounds(definition));
  return { workbook, calculated, result: validateExercise(calculated, { rules: definition.validationRules, minimumScore: definition.completion.minimumScore }) };
}

test("as duas definições são válidas, mestre é somente leitura e cópia do aluno é independente", () => {
  for (const definition of [neural, sum]) {
    expect(() => validateExerciseDefinition(definition)).not.toThrow();
    expect(Object.isFrozen(definition.workbook.worksheets[0].cells)).toBe(true);
    const copy = cloneWorkbook(definition.workbook);
    copy.worksheets[0].cells.A1 = "Alterado na cópia";
    expect(definition.workbook.worksheets[0].cells.A1).not.toBe("Alterado na cópia");
  }
});

test("o mesmo Lab e editor renderizam cabeçalho, abas, dimensões, proteção e respostas recebidas", () => {
  for (const definition of [neural, sum]) {
    const header = renderToStaticMarkup(<ExerciseLab definition={definition} repository={new LocalStorageExerciseRepository(definition)} />);
    expect(header).toContain(definition.title);
    if (definition.subtitle) expect(header).toContain(definition.subtitle);
    const html = renderToStaticMarkup(<SpreadsheetEditor definition={definition} initialSession={null} initialSaveState={{ status: "idle", lastSavedAt: null }} onSaveStatus={() => {}} />);
    const first = definition.workbook.worksheets[0];
    expect(html).toContain(`Células de ${first.name}`);
    expect(html.match(/role="gridcell"/g)).toHaveLength(definition.dimensions.rows * definition.dimensions.columns);
    expect(html).toContain(`aria-rowcount="${definition.dimensions.rows + 1}"`);
    expect(html).toContain(`aria-colcount="${definition.dimensions.columns + 1}"`);
    if (definition === sum) {
      expect(html).toContain('aria-label="C1" aria-selected="false" aria-readonly="false"');
      expect(html).toContain("Fornecida, protegida.");
      expect(html).not.toContain("Treinamento");
      expect(html).not.toContain("Resultados");
      expect(html).not.toContain("Redes Neurais");
    }
  }
});

test("soma usa o mesmo motor, aceita fórmula, rejeita literal e usa 7 pontos/corte de 100%", () => {
  expect(evaluate(sum, "=A1+B1").calculated.operacao.C1.calculatedValue).toBe(30);
  expect(evaluate(sum, "=A1+B1").result).toMatchObject({ earnedPoints: 7, possiblePoints: 7, completed: true, minimumScore: 100 });
  expect(evaluate(sum, "=B1+A1").result.completed).toBe(true);
  expect(evaluate(sum, "30").result.cells[0].reason).toBe("formula-required");
  expect(evaluate(sum, "=A1").result).toMatchObject({ earnedPoints: 0, scorePercent: 0, completed: false });
  expect(evaluate(sum, "").result.cells[0].status).toBe("unanswered");
  const initial = cloneWorkbook(sum.workbook);
  expect(applyCellEdit(initial, createCellRuleResolver(sum.cellRules), "operacao", { row: 0, column: 0 }, "999")).toBe(initial);
});

test("outro corte de aprovação vem da configuração, sem 70 fixo no motor", () => {
  const definition: ExerciseDefinition = { ...sum, completion: { minimumScore: 100 },
    validationRules: [...sum.validationRules, { ...sum.validationRules[0], id: "second", cell: "C2", points: 3 }] };
  expect(evaluate(definition, "=A1+B1").result).toMatchObject({ scorePercent: 70, completed: false });
  expect(evaluate({ ...definition, completion: { minimumScore: 70 } }, "=A1+B1").result.completed).toBe(true);
});

test("persistência de soma usa ID/versão próprios, restaura fórmula/nota e não colide com POC", () => {
  const source = evaluate(sum, "=A1+B1");
  const snapshot = { workbook: source.workbook, activeSheet: "operacao", selections: { operacao: { row: 0, column: 2 } }, validation: "verified" as const };
  const store = new Map<string, string>();
  const adapter = { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => { store.set(key, value); }, removeItem: (key: string) => { store.delete(key); } };
  expect(exerciseStorageKey(sum)).toContain("simple-sum:1.0");
  expect(exerciseStorageKey(sum)).not.toBe(exerciseStorageKey(neural));
  expect(saveExerciseState(sum, snapshot, adapter)).toBeTruthy();
  const saved = serializeExercise(sum, snapshot);
  expect(saved).toMatchObject({ exerciseId: "simple-sum", exerciseVersion: "1.0" });
  const restored = loadExerciseState(sum, adapter).session!;
  expect(restored.workbook.worksheets[0].cells.C1).toBe("=A1+B1");
  expect(restored.activeSheet).toBe("operacao");
  expect(restored.validation).toBe("verified");
  expect(validateExercise(calculateWorkbook(restored.workbook, sum.dimensions), { rules: sum.validationRules, minimumScore: sum.completion.minimumScore }).completed).toBe(true);
  expect(deserializeExercise(neural, saved)).toBeNull();
  expect(deserializeExercise({ ...sum, version: "2.0" }, saved)).toBeNull();
  expect(clearExerciseState(sum, adapter)).toBe(true);
  expect(loadExerciseState(sum, adapter).session).toBeNull();
});

test("sessão antiga da POC restaura sem perder progresso, mas compatibilidade não vaza para outros exercícios", () => {
  const saved = serializeExercise(neural, { workbook: cloneWorkbook(neural.workbook), activeSheet: "treinamento", selections: {}, validation: "never" });
  const { exerciseVersion: _version, ...legacy } = saved;
  const previous = { ...legacy, exerciseId: "poc01-neural-v1", cells: [{ worksheetId: "treinamento", address: "F2", raw: "=B2*D2+C2*E2" }] };
  expect(deserializeExercise(neural, previous)?.workbook.worksheets[1].cells.F2).toBe("=B2*D2+C2*E2");
  expect(deserializeExercise(sum, previous)).toBeNull();
});

test("valor inicial editável e exclusão explícita sobrevivem ao round-trip", () => {
  const workbook = cloneWorkbook(sum.workbook); workbook.worksheets[0].cells.C1 = "=A1+B1";
  const definition = { ...sum, workbook };
  const edited = cloneWorkbook(workbook); delete edited.worksheets[0].cells.C1;
  const saved = serializeExercise(definition, { workbook: edited, activeSheet: "operacao", selections: {}, validation: "unverified" });
  expect(saved.cells).toContainEqual({ worksheetId: "operacao", address: "C1", raw: "" });
  expect(deserializeExercise(definition, saved)?.workbook.worksheets[0].cells.C1).toBeUndefined();
  expect(cloneWorkbook(definition.workbook).worksheets[0].cells.C1).toBe("=A1+B1");
});

test("gráfico declarativo lê outra aba, intervalos e IDs sem actual/predicted obrigatórios", () => {
  const definition: ExerciseDefinition = { ...sum, dimensions: { rows: 5, columns: 4 },
    workbook: { worksheets: [{ id: "operacao", name: "Exercício", cells: { A1: "10", B1: "20", A2: "Jan", A3: "Fev", A4: "Mar", D2: "30", D3: "=A1+B1+10", D4: "60" } }] },
    charts: [{ id: "totals", sheet: "operacao", type: "line", title: "Totais mensais", xRange: "A2:A4", xAxisLabel: "Mês", series: [{ id: "total", name: "Total", range: "D2:D4", color: "#142d4e" }] }] };
  validateExerciseDefinition(definition);
  const calculated = calculateWorkbook(cloneWorkbook(definition.workbook), definition.dimensions);
  const dataset = workbookChartData(calculated, definition.charts[0]);
  expect(dataset.points.map(point => [point.sample, point.values.total])).toEqual([["Jan", 30], ["Fev", 40], ["Mar", 60]]);
  expect(chartNumber(calculated.operacao.D2)).toBe(30);
});

test("dimensões por aba controlam referências, storage e render sem limite A–L/40", () => {
  const definition: ExerciseDefinition = { ...sum, sheets: { operacao: { dimensions: { rows: 2, columns: 28 } } },
    workbook: { worksheets: [{ id: "operacao", name: "Exercício", cells: { A1: "10", B1: "20", AA1: "=A1+B1", AB1: "=AA1", AB2: "=AB3" } }] } };
  validateExerciseDefinition(definition);
  expect(sheetBounds(definition, "operacao")).toEqual({ rows: 2, columns: 28 });
  const calculated = calculateWorkbook(cloneWorkbook(definition.workbook), definition.dimensions, workbookBounds(definition));
  expect(calculated.operacao.AA1.calculatedValue).toBe(30);
  expect(calculated.operacao.AB1.calculatedValue).toBe(30);
  expect(calculated.operacao.AB2.error).toBe("#REF!");
});

test("endereçamento compartilhado normaliza $, caixa, intervalos e valida limites", () => {
  expect(normalizeCellAddress(" $aa$2 ", { rows: 2, columns: 28 })).toBe("AA2");
  expect(parseCellAddress("AB2")).toEqual({ row: 1, column: 27 });
  expect(parseCellRange("B2:A1")).toEqual({ from: { row: 0, column: 0 }, to: { row: 1, column: 1 } });
  expect(rangeAddresses("B1:C2")).toEqual(["B1", "C1", "B2", "C2"]);
  for (const address of ["A0", "AB3", "AC1", "A99999999999999999999999"]) expect(() => parseCellAddress(address, { rows: 2, columns: 28 })).toThrow();
});

test("definições inválidas falham com diagnóstico claro, inclusive nomes/IDs e alvos", () => {
  const examples = [null, {}, { ...sum, id: "" }, { ...sum, version: "" }, { ...sum, workbook: null }, { ...sum, dimensions: { rows: 0, columns: 3 } },
    { ...sum, workbook: { worksheets: [sum.workbook.worksheets[0], sum.workbook.worksheets[0]] } },
    { ...sum, workbook: { worksheets: [{ ...sum.workbook.worksheets[0], name: "Inválido/" }] } },
    { ...sum, validationRules: [{ ...sum.validationRules[0], cell: "C99" }] },
    { ...sum, validationRules: [{ ...sum.validationRules[0], worksheetId: "ausente" }] },
    { ...sum, validationRules: [sum.validationRules[0], sum.validationRules[0]] },
    { ...sum, cellRules: { operacao: { default: "teacher" } } },
    { ...sum, cellRules: { operacao: { default: "provided", cells: { Z99: "answer" } } } },
    { ...sum, completion: { minimumScore: 101 } },
    { ...sum, charts: [{ id: "bad", sheet: "ausente", type: "line", title: "Inválido", xRange: "A1", series: [{ id: "v", name: "V", range: "B1", color: "#142d4e" }] }] },
    { ...sum, charts: [{ id: "bad", sheet: "operacao", type: "line", title: "Inválido", xRange: "A1:A2", series: [{ id: "v", name: "V", range: "B1", color: "#142d4e" }] }] },
  ];
  for (const invalid of examples) expect(() => validateExerciseDefinition(invalid)).toThrow(/ExerciseDefinition inválido:/);
  expect(() => validateExerciseDefinition({ ...sum, validationRules: [{ ...sum.validationRules[0], cell: "C99" }] })).toThrow(/validationRule sum.*célula inexistente/);
});
