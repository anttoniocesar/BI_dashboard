import type { CellPosition, Workbook } from "./spreadsheet";

export type ValidationCheckpoint = "never" | "verified" | "unverified";
export type StudentCell = { worksheetId: string; address: string; raw: string };
export type ExerciseSession = {
  version: 1;
  exerciseId: string;
  exerciseVersion: string;
  cells: StudentCell[];
  activeSheet: string;
  selections: Record<string, CellPosition>;
  validation: ValidationCheckpoint;
  lastSavedAt: string;
};
export type ExerciseSnapshot = {
  workbook: Workbook;
  activeSheet: string;
  selections: Record<string, CellPosition>;
  validation: ValidationCheckpoint;
};
export type RestoredExercise = ExerciseSnapshot & { lastSavedAt: string };
export type SaveState = { status: "idle" | "saving" | "saved" | "error"; lastSavedAt: string | null };
