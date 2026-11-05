import type { CalculatedCell } from "@/types/spreadsheet";
import type { CellValidationResult, ValidationReason, ValidationRule, ValidationStatus } from "@/types/validation";

export function validateCell(cell: CalculatedCell | undefined, rule: ValidationRule): CellValidationResult {
  const points = rule.points ?? 1;
  const result = (status: ValidationStatus, reason: ValidationReason, feedback: string): CellValidationResult => ({
    ruleId: rule.id, worksheetId: rule.worksheetId, cell: rule.cell, label: rule.label,
    status, reason, feedback, pointsEarned: status === "correct" ? points : 0, pointsPossible: points,
  });
  if (!cell || !cell.raw.trim()) return result("unanswered", "empty", "Não respondida. Preencha esta célula e verifique novamente.");
  if (cell.error) return result("incorrect", "formula-error", `A fórmula contém um erro. ${rule.feedback}`);
  if (rule.requireFormula && !cell.formula?.startsWith("=")) return result("incorrect", "formula-required", `Use uma fórmula nesta resposta. ${rule.feedback}`);

  const value = cell.calculatedValue;
  let correct: boolean;
  if (rule.type === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) return result("incorrect", "not-number", `A resposta precisa produzir um número válido. ${rule.feedback}`);
    const tolerance = rule.tolerance ?? 0;
    const difference = Math.abs(value - rule.expected);
    // Exact rules remain strict. Tolerant rules include their boundary despite
    // tiny floating-point representation differences.
    const roundingMargin = tolerance > 0 ? Number.EPSILON * Math.max(1, Math.abs(value), Math.abs(rule.expected)) * 4 : 0;
    correct = difference <= tolerance + roundingMargin;
  } else {
    if (typeof value !== "string") return result("incorrect", "not-text", `A resposta precisa conter texto. ${rule.feedback}`);
    correct = value.trim().toLocaleLowerCase("pt-BR") === rule.expected.trim().toLocaleLowerCase("pt-BR");
  }
  return correct ? result("correct", "correct", "Resposta correta.") : result("incorrect", "mismatch", rule.feedback);
}
