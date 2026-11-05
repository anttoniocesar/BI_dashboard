"use client";

import { useState } from "react";
import type { CalculatedWorkbook, Workbook } from "@/types/spreadsheet";
import type { ExerciseValidationConfig, ExerciseValidationResult } from "@/types/validation";
import { validateExercise } from "@/lib/validation/validateExercise";
import type { ValidationCheckpoint } from "@/types/exercise-session";

export function useExerciseValidation(workbook: Workbook, calculated: CalculatedWorkbook, config: ExerciseValidationConfig, hasPendingChanges: boolean, initialCheckpoint: ValidationCheckpoint = "never") {
  const [checked, setChecked] = useState<{ source: Workbook; result: ExerciseValidationResult } | null>(() => initialCheckpoint === "verified" ? { source: workbook, result: validateExercise(calculated, config) } : null);
  // No automatic revalidation. A changed workbook (or draft) makes the previous
  // result stale, including calculated answers that depend on edited cells.
  const evaluation = checked?.source === workbook && !hasPendingChanges ? checked.result : null;
  return {
    evaluation,
    hasPreviousCheck: checked !== null || initialCheckpoint === "unverified",
    checkpoint: (evaluation ? "verified" : checked !== null || initialCheckpoint === "unverified" ? "unverified" : "never") as ValidationCheckpoint,
    verify: (source = workbook, snapshot = calculated) => setChecked({ source, result: validateExercise(snapshot, config) }),
  };
}
