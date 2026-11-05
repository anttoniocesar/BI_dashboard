import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { importWorkbook } from "../lib/excel-import/importWorkbook";
import { createExerciseDefinitionFromImport } from "../lib/excel-import/createExerciseDefinitionFromImport";
import { validateExerciseDefinition } from "../lib/exercises/definition";

/** Reproducible entry point for inspecting another local file; no upload route or student UI. */
test("analisar XLSX local e produzir artefatos normalizados para revisão", async () => {
  const file = process.env.BI_SOCIETY_XLSX_PATH ?? "tests/fixtures/xlsx/controlled.xlsx";
  const result = await importWorkbook(readFileSync(file), basename(file));
  mkdirSync("test-results/xlsx", { recursive: true });
  writeFileSync("test-results/xlsx/report.json", JSON.stringify(result.report, null, 2));
  expect(result.ok, JSON.stringify(result.report, null, 2)).toBe(true);
  if (!result.ok) return;
  const definition = createExerciseDefinitionFromImport(result.workbook, { id: "xlsx-review", version: "1" });
  expect(() => validateExerciseDefinition(definition)).not.toThrow();
  writeFileSync("test-results/xlsx/normalized-workbook.json", JSON.stringify(result.workbook, null, 2));
  writeFileSync("test-results/xlsx/exercise-definition.json", JSON.stringify(definition, null, 2));
});
