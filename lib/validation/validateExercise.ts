import type { CalculatedWorkbook } from "@/types/spreadsheet";
import type { ExerciseValidationConfig, ExerciseValidationResult } from "@/types/validation";
import { validateCell } from "./validateCell";

export function validateExercise(calculated: CalculatedWorkbook, config: ExerciseValidationConfig): ExerciseValidationResult {
  if (!Number.isFinite(config.minimumScore) || config.minimumScore < 0 || config.minimumScore > 100) throw new Error("Limite de conclusão inválido na configuração.");
  const targets = new Set<string>();
  for (const rule of config.rules) {
    const target = JSON.stringify([rule.worksheetId, rule.cell]);
    if (targets.has(target)) throw new Error("Célula duplicada na configuração de validação.");
    targets.add(target);
    if (!Number.isFinite(rule.points ?? 1) || (rule.points ?? 1) <= 0) throw new Error("Pontuação inválida na configuração.");
    if (rule.type === "number" && (!Number.isFinite(rule.expected) || !Number.isFinite(rule.tolerance ?? 0) || (rule.tolerance ?? 0) < 0)) throw new Error("Regra numérica inválida na configuração.");
  }
  const cells = config.rules.map(rule => validateCell(calculated[rule.worksheetId]?.[rule.cell], rule));
  const correctCount = cells.filter(cell => cell.status === "correct").length;
  const unansweredCount = cells.filter(cell => cell.status === "unanswered").length;
  const earnedPoints = cells.reduce((sum, cell) => sum + cell.pointsEarned, 0);
  const possiblePoints = cells.reduce((sum, cell) => sum + cell.pointsPossible, 0);
  const scorePercent = possiblePoints ? earnedPoints / possiblePoints * 100 : 0;
  return {
    cells, totalCount: cells.length, correctCount, reviewCount: cells.length - correctCount, unansweredCount,
    earnedPoints, possiblePoints, scorePercent, accuracyPercent: cells.length ? correctCount / cells.length * 100 : 0,
    minimumScore: config.minimumScore, completed: cells.length > 0 && scorePercent >= config.minimumScore,
  };
}
