import type { ExerciseSession } from "./exercise-session";
export type AttemptIdentity = { courseId: string; chapterId: string; activityId: string; exerciseId: string; exerciseVersion: string };
export type ExerciseAttempt = AttemptIdentity & { id: string; userId: string; status: "draft" | "submitted"; createdAt: string; updatedAt: string; submittedAt: string | null; state: ExerciseSession | null };
