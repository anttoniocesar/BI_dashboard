import type { ExerciseSession } from "./exercise-session";

export type ExercisePersistenceContext = {
  exerciseId: string;
  exerciseVersion: string;
  userId?: string;
  attemptId?: string;
};

export type SaveResult = { lastSavedAt: string };

/** Resolve only after persistence succeeds; reject failures. Calls are ordered by the session controller. */
export interface ExerciseRepository {
  readonly requireSuccessfulLoad?: boolean;
  load(context: ExercisePersistenceContext): Promise<ExerciseSession | null>;
  save(context: ExercisePersistenceContext, session: ExerciseSession): Promise<SaveResult>;
  clear(context: ExercisePersistenceContext): Promise<void>;
  /** Local-only best-effort capability; all adapter writes must finish synchronously to preserve ordering. */
  saveOnExit?(context: ExercisePersistenceContext, session: ExerciseSession): SaveResult;
}
