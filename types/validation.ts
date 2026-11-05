type ValidationRuleBase = {
  id: string;
  worksheetId: string;
  cell: string;
  label: string;
  requireFormula?: boolean;
  points?: number;
  feedback: string;
};

export type ValidationRule = ValidationRuleBase & (
  | { type: "number"; expected: number; tolerance?: number }
  | { type: "text"; expected: string }
);
export type ExerciseValidationConfig = { rules: ValidationRule[]; minimumScore: number };
export type ValidationStatus = "correct" | "incorrect" | "unanswered";
export type ValidationReason = "correct" | "empty" | "formula-required" | "formula-error" | "not-number" | "not-text" | "mismatch";

// Public presentation model: never contains expected answers, formulas or tolerances.
export type CellValidationResult = {
  ruleId: string;
  worksheetId: string;
  cell: string;
  label: string;
  status: ValidationStatus;
  reason: ValidationReason;
  feedback: string;
  pointsEarned: number;
  pointsPossible: number;
};
export type ExerciseValidationResult = {
  cells: CellValidationResult[];
  totalCount: number;
  correctCount: number;
  reviewCount: number;
  unansweredCount: number;
  earnedPoints: number;
  possiblePoints: number;
  accuracyPercent: number;
  scorePercent: number;
  minimumScore: number;
  completed: boolean;
};
