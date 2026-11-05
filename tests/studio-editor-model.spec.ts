import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { simpleSumDefinition } from "./fixtures/simple-sum";
import { neuralExerciseDefinition } from "../data/exercises/neural-error-correction";
import { createDraft, buildDefinition, applyDraftRole } from "../lib/studio/exerciseDraft";
import { importWorkbook } from "../lib/excel-import/importWorkbook";
import { createExerciseDefinitionFromImport } from "../lib/excel-import/createExerciseDefinitionFromImport";
import { validateExerciseDefinition } from "../lib/exercises/definition";
import { createCellRuleResolver } from "../lib/spreadsheet/cell-rules";
import { calculateWorkbook } from "../lib/spreadsheet/formula-engine";
import { validateExercise } from "../lib/validation/validateExercise";

test("Draft: cópia mutável independente, definição validada e mestre congelado", () => {
  const draft = createDraft(simpleSumDefinition);
  draft.workbook.worksheets[0].cells.A1 = "50";
  draft.workbook.worksheets[0].cells.C1 = "=A1+B1";
  draft.validationRules[0].expected = 70;
  const definition = buildDefinition(draft);
  expect(() => validateExerciseDefinition(definition)).not.toThrow();
  expect(simpleSumDefinition.workbook.worksheets[0].cells.A1).toBe("10");
  expect(simpleSumDefinition.validationRules[0].expected).toBe(30);
  expect(Object.isFrozen(definition.workbook.worksheets[0].cells)).toBe(true);
  draft.workbook.worksheets[0].cells.A1 = "90";
  expect(definition.workbook.worksheets[0].cells.A1).toBe("50");
});

test("Draft: papéis por intervalo usam precedência existente; remover resposta remove avaliação", () => {
  const original = createDraft(simpleSumDefinition);
  let draft = applyDraftRole(original, "operacao", "A1:C2", "answer");
  expect(createCellRuleResolver(draft.cellRules)("operacao", { row: 1, column: 2 })).toEqual({ role: "answer", readOnly: false });
  draft = applyDraftRole(draft, "operacao", "C1", "calculated");
  expect(createCellRuleResolver(draft.cellRules)("operacao", { row: 0, column: 2 }).readOnly).toBe(true);
  expect(draft.validationRules).toHaveLength(0);
  expect(original.validationRules).toHaveLength(1);
  expect(() => applyDraftRole(draft, "operacao", "Z99", "editable")).toThrow();
  expect(() => applyDraftRole(draft, "missing", "A1", "provided")).toThrow();
});

test("Draft: aluno recebe respostas vazias; edição e avaliação da cópia não alteram autoria", () => {
  const draft = createDraft(simpleSumDefinition);
  draft.workbook.worksheets[0].cells.C1 = "=A1+B1";
  const student = buildDefinition(draft, true);
  expect(student.workbook.worksheets[0].cells.C1).toBeUndefined();
  expect(student.workbook.worksheets[0].cells.A1).toBe("10");
  const copy = createDraft(student);
  copy.workbook.worksheets[0].cells.C1 = "=A1+B1";
  const result = validateExercise(calculateWorkbook(copy.workbook, copy.dimensions), { rules: copy.validationRules, minimumScore: copy.completion.minimumScore });
  expect(result.earnedPoints).toBe(7); expect(result.completed).toBe(true);
  expect(draft.workbook.worksheets[0].cells.C1).toBe("=A1+B1");
});

test("Draft: valida parâmetros inválidos e mantém avaliadores existentes de texto e tolerância", () => {
  const draft = createDraft(simpleSumDefinition);
  draft.validationRules = [{ ...draft.validationRules[0], type: "number", expected: 30, tolerance: 0.005, points: 10 }];
  draft.workbook.worksheets[0].cells.C1 = "=30.005";
  expect(validateExercise(calculateWorkbook(draft.workbook, draft.dimensions), { rules: draft.validationRules, minimumScore: 100 }).earnedPoints).toBe(10);
  draft.validationRules = [{ ...draft.validationRules[0], type: "text", expected: "Temperatura", requireFormula: false }];
  draft.workbook.worksheets[0].cells.C1 = "temperatura";
  expect(validateExercise(calculateWorkbook(draft.workbook, draft.dimensions), { rules: draft.validationRules, minimumScore: 100 }).completed).toBe(true);
  draft.validationRules[0].points = -1; expect(() => buildDefinition(draft)).toThrow();
});

test("Draft: preserva gráficos configurados e metadados Excel sem alterar a fonte", async () => {
  expect(buildDefinition(createDraft(neuralExerciseDefinition)).charts).toEqual(neuralExerciseDefinition.charts);
  const imported = await importWorkbook(readFileSync("tests/fixtures/xlsx/controlled.xlsx"), "controlled.xlsx");
  if (!imported.ok) throw new Error("Fixture inválida");
  const original = JSON.stringify(imported.workbook);
  const draft = createDraft(createExerciseDefinitionFromImport(imported.workbook, { id: "draft-test", version: "1" }), imported.workbook);
  draft.workbook.worksheets[0].cells.A1 = "123";
  expect(draft.importedWorkbook).toEqual(imported.workbook);
  expect(draft.importedWorkbook).not.toBe(imported.workbook);
  expect(JSON.stringify(imported.workbook)).toBe(original);
  expect("importedWorkbook" in buildDefinition(draft)).toBe(false);
});
