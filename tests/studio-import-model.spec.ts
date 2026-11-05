import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { importWorkbook } from "../lib/excel-import/importWorkbook";
import { DEFAULT_IMPORT_OPTIONS, reviewImport } from "../lib/excel-import/reviewImport";
import { createExerciseDefinitionFromImport } from "../lib/excel-import/createExerciseDefinitionFromImport";
import { cloneWorkbook } from "../lib/spreadsheet/workbook";
import { serializeExercise } from "../lib/storage/exerciseSessionCodec";
import { VolatileExerciseRepository } from "../lib/storage/VolatileExerciseRepository";

async function source() {
  const result = await importWorkbook(readFileSync("tests/fixtures/xlsx/controlled.xlsx"), "controlled.xlsx");
  if (!result.ok) throw new Error(JSON.stringify(result.report));
  return result.workbook;
}

test("revisão mantém origem imutável e recusa seleção vazia, desconhecida ou duplicada", async () => {
  const workbook = await source(), before = JSON.stringify(workbook);
  for (const ids of [[], ["missing"], [workbook.worksheets[0].id, workbook.worksheets[0].id]]) {
    const result = reviewImport(workbook, ids, DEFAULT_IMPORT_OPTIONS);
    expect(result.ok).toBe(false);
    expect(result.report.items[0].code).toBe("SHEET_SELECTION");
  }
  const result = reviewImport(workbook, workbook.worksheets.map(sheet => sheet.id), DEFAULT_IMPORT_OPTIONS);
  expect(result.ok).toBe(true);
  expect(result.report).toMatchObject({ sheets: 2, formulas: 12, supportedFormulas: 12, unsupportedFormulas: 0 });
  expect(JSON.stringify(workbook)).toBe(before);
});

test("abas removidas bloqueiam referências; excluir apenas aba dependente é permitido", async () => {
  const workbook = await source();
  const invalid = reviewImport(workbook, [workbook.worksheets[1].id], DEFAULT_IMPORT_OPTIONS);
  expect(invalid.ok).toBe(false);
  expect(invalid.report.items.filter(item => item.code === "REMOVED_SHEET_REFERENCE")).toHaveLength(3);
  expect(invalid.report.items.some(item => item.message.includes("Dados base") && item.cell === "A2")).toBe(true);
  const valid = reviewImport(workbook, [workbook.worksheets[0].id], DEFAULT_IMPORT_OPTIONS);
  expect(valid.ok).toBe(true);
  if (valid.ok) {
    const definition = createExerciseDefinitionFromImport(valid.workbook, { id: "one-sheet", version: "0.1-draft" });
    expect(definition.workbook.worksheets.map(sheet => sheet.name)).toEqual(["Dados base"]);
  }
});

test("opções omitem fórmulas sem usar caches e preservam estilos somente quando selecionados", async () => {
  const workbook = await source(), before = JSON.stringify(workbook);
  const result = reviewImport(workbook, [workbook.worksheets[1].id], { values: true, formulas: false, formatting: false });
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.workbook.worksheets[0].cells.A1).toMatchObject({ kind: "blank", value: null });
  expect(result.workbook.worksheets[0].cells.A1.formula).toBeUndefined();
  expect(result.workbook.styles).toEqual({});
  expect(result.workbook.worksheets[0].merges).toEqual([]);
  expect(result.report.errors).toBe(0);
  expect(result.report.formulas).toBe(0);
  expect(result.report.items.map(item => item.code)).toEqual(expect.arrayContaining(["FORMULAS_OMITTED", "FORMATTING_OMITTED", "SHEETS_OMITTED"]));
  expect(JSON.stringify(workbook)).toBe(before);
});

test("desmarcar valores mantém expressões e avisa; opções desmarcadas não inventam conteúdo", async () => {
  const workbook = await source(), ids = workbook.worksheets.map(sheet => sheet.id);
  const result = reviewImport(workbook, ids, { values: false, formulas: true, formatting: true });
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.workbook.worksheets[0].cells.A1.kind).toBe("blank");
  expect(result.workbook.worksheets[0].cells.A3.formula?.expression).toBe("=SUM(A1:B1)");
  expect(result.report.items.some(item => item.code === "VALUES_OMITTED")).toBe(true);
  const empty = reviewImport(workbook, ids, { values: false, formulas: false, formatting: false });
  expect(empty.ok).toBe(true);
  expect(empty.report.populatedCells).toBe(0);
});

test("bloqueios de fórmulas externas permanecem na revisão e o rascunho usa texto inerte", async () => {
  const workbook = await source();
  const cell = workbook.worksheets[0].cells.A3;
  cell.formula = { expression: '=WEBSERVICE("https://example.invalid")', kind: "normal", blocked: true, compatibility: "UNSUPPORTED", functions: ["WEBSERVICE"], reasons: [] };
  const result = reviewImport(workbook, workbook.worksheets.map(sheet => sheet.id), DEFAULT_IMPORT_OPTIONS);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.workbook.worksheets[0].cells.A3.formula?.blocked).toBe(true);
  const definition = createExerciseDefinitionFromImport(result.workbook, { id: "inert-draft", version: "0.1-draft" });
  expect(definition.workbook.worksheets[0].cells.A3).toBe('="=WEBSERVICE(""https://example.invalid"")"');
});

test("repositório volátil isola identidade, copia estado, limpa e descarta sem storage", async () => {
  const workbook = await source();
  const definition = createExerciseDefinitionFromImport(workbook, { id: "draft-test", version: "0.1-draft" });
  const context = { exerciseId: definition.id, exerciseVersion: definition.version };
  const session = serializeExercise(definition, { workbook: cloneWorkbook(definition.workbook), activeSheet: definition.workbook.worksheets[0].id, selections: {}, validation: "never" });
  const repository = new VolatileExerciseRepository();
  expect(await repository.load(context)).toBeNull();
  await repository.save(context, session);
  const loaded = (await repository.load(context))!;
  loaded.activeSheet = "changed";
  expect((await repository.load(context))?.activeSheet).toBe(session.activeSheet);
  expect(await repository.load({ ...context, exerciseId: "another" })).toBeNull();
  await expect(repository.save({ ...context, exerciseVersion: "other" }, session)).rejects.toThrow(/Identidade/);
  await repository.clear(context);
  expect(await repository.load(context)).toBeNull();
  await repository.save(context, session); repository.discard();
  expect(await repository.load(context)).toBeNull();
  expect(repository).not.toHaveProperty("saveOnExit");
});
