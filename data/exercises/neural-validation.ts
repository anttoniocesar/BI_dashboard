import type { ExerciseValidationConfig } from "@/types/validation";

// Fixed initial exercise targets. This module is separate from the presentation.
export const exerciseValidationConfig: ExerciseValidationConfig = {
  minimumScore: 70,
  rules: [
    { id: "predicted-output", worksheetId: "treinamento", cell: "F2", label: "Saída prevista", type: "number", expected: 0.16, tolerance: 0.0001, requireFormula: true, points: 10, feedback: "Revise o cálculo da saída prevista." },
    { id: "training-error", worksheetId: "treinamento", cell: "H2", label: "Erro", type: "number", expected: 0.14, tolerance: 0.0001, requireFormula: true, points: 10, feedback: "Verifique se utilizou saída real menos saída prevista." },
    { id: "new-weight-one", worksheetId: "treinamento", cell: "I2", label: "Novo w1", type: "number", expected: 0.2028, tolerance: 0.0001, requireFormula: true, points: 15, feedback: "Revise a taxa de aprendizado e as referências utilizadas na atualização do peso." },
    { id: "new-weight-two", worksheetId: "treinamento", cell: "J2", label: "Novo w2", type: "number", expected: 0.3056, tolerance: 0.0001, requireFormula: true, points: 15, feedback: "Revise a taxa de aprendizado e as referências utilizadas na atualização do peso." },
    { id: "mean-absolute-error", worksheetId: "resultados", cell: "B8", label: "MAE", type: "number", expected: 0.23885997636184, tolerance: 0.000001, requireFormula: true, points: 20, feedback: "Revise os erros absolutos das amostras e o intervalo usado para calcular a média." },
  ],
};
