import type { ExerciseDefinition } from "../../types/exercise";
import { freezeWorkbook } from "../../lib/spreadsheet/workbook";

export const simpleSumDefinition: ExerciseDefinition = {
  id: "simple-sum", version: "1.0", title: "Teste de Soma", subtitle: "Some os dois valores usando uma fórmula.",
  workbook: freezeWorkbook({ worksheets: [{ id: "operacao", name: "Exercício", cells: { A1: "10", B1: "20" } }] }),
  dimensions: { rows: 4, columns: 3 },
  cellRules: { operacao: { default: "provided", cells: { C1: "answer" } } },
  validationRules: [{ id: "sum", worksheetId: "operacao", cell: "C1", label: "Soma", type: "number", expected: 30, requireFormula: true, points: 7, feedback: "Some os valores fornecidos." }],
  completion: { minimumScore: 100 }, charts: [], ui: { initialSheet: "operacao", documentLabel: "TESTE TÉCNICO" },
};
