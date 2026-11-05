import type { ExerciseDefinition } from "./exercise";
import type { Workbook } from "./spreadsheet";
import type { NormalizedWorkbook } from "@/lib/excel-import/types";

/** Mutable authoring data; never aliases the readonly master or imported file. */
export type ExerciseDraft = Omit<ExerciseDefinition, "workbook"> & {
  workbook: Workbook;
  importedWorkbook?: NormalizedWorkbook;
};
