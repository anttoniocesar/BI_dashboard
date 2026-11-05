import type { WorkbookCellRules } from "@/types/cell-rules";

// IDs match the worksheets in createInitialWorkbook. No rules live in the UI.
export const exerciseCellRules: WorkbookCellRules = {
  dados: { default: "provided" },
  treinamento: {
    default: "calculated",
    ranges: [
      { range: "A1:L1", role: "provided" },
      { range: "F2:F6", role: "answer" },
      { range: "H2:J6", role: "answer" },
    ],
  },
  resultados: {
    default: "calculated",
    ranges: [{ range: "A1:L1", role: "provided" }],
    cells: { A8: "provided" },
  },
  analise: {
    default: "provided",
    cells: { B3: "answer", B6: "answer", B9: "answer" },
  },
};
