// Keep historical assertions for all three series while exercising generic selectors.
import { neuralExerciseDefinition as definition } from "../../data/exercises/neural-error-correction";
import { chartNumber, workbookChartData as select } from "../../lib/charts/workbookChartData";
import type { CalculatedWorkbook } from "../../types/spreadsheet";
export function workbookChartData(calculated: CalculatedWorkbook) {
  const output = select(calculated, definition.charts[0]);
  const error = select(calculated, definition.charts[1]);
  const metric = definition.sheets!.resultados.charts!.metrics![0];
  return { points: output.points.map(point => ({ row: point.row, sample: point.sample, actual: point.values.actual, predicted: point.values.predicted,
    absoluteError: error.points.find(item => item.row === point.row)?.values.absoluteError ?? null })),
    mae: chartNumber(calculated[metric.sheet]?.[metric.cell]) };
}
