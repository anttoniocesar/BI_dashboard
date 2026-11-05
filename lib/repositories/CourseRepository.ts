import type { CourseDraft, StudioExercise } from "../../types/course";
import type { ExerciseDefinition } from "../../types/exercise";

export const exerciseKey = (id: string, version: string) => JSON.stringify([id, version]);
export interface CourseWorkspace {
  courses: CourseDraft[];
  exercises: StudioExercise[];
  definitions: Record<string, ExerciseDefinition>;
}
export const emptyWorkspace = (): CourseWorkspace => ({ courses: [], exercises: [], definitions: {} });
export type ReplaceActivityExercise = {
  operation: "replace-activity-exercise"; id: string; chapterId: string; activityId: string;
  previousExerciseId: string; previousExerciseVersion: string | null;
  nextExerciseId: string; nextExerciseVersion: string; expectedUpdatedAt: string;
};
export type CourseOperation =
  | { operation:"create-course-revision"; sourceCourseId:string; expectedUpdatedAt:string }
  | ReplaceActivityExercise
  | { operation: "save-course"; course: CourseDraft }
  | { operation: "save-exercise"; exercise: StudioExercise }
  | { operation: "delete-exercise"; id: string; version: string }
  | { operation: "publish" | "archive" | "delete-draft"; id: string };
/** Chapter/activity operations are atomic aggregate updates, preserving entity IDs. */
export interface CourseRepository {
  load(): Promise<CourseWorkspace>;
  execute(operation: CourseOperation): Promise<CourseWorkspace>;
}
