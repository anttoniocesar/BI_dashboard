import type { ExerciseDefinition } from "@/types/exercise";
import { masterWorkbook } from "../master-workbook";
import { COLUMN_COUNT, ROW_COUNT } from "../neural-network-demo";
import { exerciseCellRules } from "../cell-rules";
import { exerciseValidationConfig } from "./neural-validation";
import { validateExerciseDefinition } from "@/lib/exercises/definition";

export const neuralExerciseDefinition: ExerciseDefinition = {
  id: "neural-error-correction", version: "1.0",
  title: "Redes Neurais – Aprendizado por Correção de Erro",
  workbook: masterWorkbook, dimensions: { rows: ROW_COUNT, columns: COLUMN_COUNT },
  sheets: {
    dados: { columnWidths: { A: 176 }, headerRows: [1] },
    treinamento: { columnWidths: { A: 176 }, headerRows: [1] },
    resultados: { columnWidths: { A: 176 }, headerRows: [1], viewportHeight: 340,
      charts: { title: "Leitura dos resultados", description: "Acompanhe a previsão e o erro das amostras.", ariaLabel: "Gráficos de Resultados",
        metrics: [{ id: "mae", sheet: "resultados", cell: "B8", title: "MAE", detail: "Erro absoluto médio", ariaLabel: "MAE dos resultados" }] } },
    analise: { columnWidths: { A: 176, B: 600 }, headerRows: [1] },
  },
  cellRules: exerciseCellRules, validationRules: exerciseValidationConfig.rules,
  completion: { minimumScore: exerciseValidationConfig.minimumScore },
  charts: [
    { id: "actual-predicted", sheet: "resultados", type: "line", title: "Saída real × Saída prevista", xRange: "A2:A6", xAxisLabel: "Amostra", yAxisLabel: "Saída", legend: true,
      series: [{ id: "actual", name: "Saída real", range: "B2:B6", color: "#142d4e" }, { id: "predicted", name: "Saída prevista", range: "C2:C6", color: "#ee7e32", dashed: true }] },
    { id: "absolute-error", sheet: "resultados", type: "line", title: "Erro absoluto por amostra", xRange: "A2:A6", xAxisLabel: "Amostra", yAxisLabel: "Erro absoluto",
      series: [{ id: "absoluteError", name: "Erro absoluto", range: "D2:D6", color: "#ee7e32" }] },
  ],
  persistence: { key: "bi-society:poc01:exercise-state:v1", legacyExerciseId: "poc01-neural-v1" },
  ui: { documentLabel: "POC 01", eyebrow: "LABORATÓRIO INTERATIVO", initialSheet: "dados" },
};
validateExerciseDefinition(neuralExerciseDefinition);
