import type { CellPosition } from "./spreadsheet";

export type CellRole = "provided" | "calculated" | "editable" | "answer";
export type WorksheetCellRules = {
  default: CellRole;
  ranges?: { range: string; role: CellRole }[];
  cells?: Record<string, CellRole>;
};
export type WorkbookCellRules = Record<string, WorksheetCellRules>;
export type ResolvedCellRule = { role: CellRole; readOnly: boolean };
export type CellRuleResolver = (worksheetId: string, position: CellPosition) => ResolvedCellRule;
