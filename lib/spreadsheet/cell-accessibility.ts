import type { CellRole } from "@/types/cell-rules";
import type { CellValidationResult } from "@/types/validation";

const roleDescriptions: Record<CellRole, string> = {
  provided: "Fornecida, protegida.",
  calculated: "Calculada, protegida.",
  answer: "Resposta editável.",
  editable: "Editável.",
};
const evaluationDescriptions = {
  correct: "Resposta correta.",
  incorrect: "Precisa de revisão.",
  unanswered: "Não respondida, precisa de revisão.",
};

/** Describes only the displayed content and public status, never grading rules. */
export function cellAccessibleDescription(value: string, role: CellRole, result?: CellValidationResult, isValidationTarget = false, error?: string): string {
  return [
    value === "" ? "Célula vazia." : `Valor ${value}.`,
    roleDescriptions[role],
    result ? evaluationDescriptions[result.status] : role === "answer" || isValidationTarget ? "Não verificada." : "",
    error ? `Erro de fórmula: ${error}.` : "",
    result?.status === "correct" ? "" : result?.feedback ?? "",
  ].filter(Boolean).join(" ");
}
