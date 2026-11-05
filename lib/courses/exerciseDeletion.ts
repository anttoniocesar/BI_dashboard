import type { CourseDraft } from "../../types/course";
import { DataError } from "../data/http";

export type ExerciseUsage = { courseId: string; chapterId: string; activityId: string; course: string; chapter: string; activity: string };

/** Legacy references without a version block every version of the same ID. */
export function exerciseUsages(courses: CourseDraft[], id: string, version: string): ExerciseUsage[] {
  return courses.flatMap(course => course.chapters.flatMap(chapter => chapter.activities
    .filter(activity => activity.type === "spreadsheet-exercise" && activity.content.exerciseId === id &&
      (!activity.content.exerciseVersion || activity.content.exerciseVersion === version))
    .map(activity => ({ courseId: course.id, chapterId: chapter.id, activityId: activity.id, course: course.title, chapter: chapter.title, activity: activity.title }))));
}

export class ExerciseInUseError extends DataError {
  constructor(public usages: ExerciseUsage[]) {
    super("Este exercício está vinculado a uma atividade e não pode ser excluído.", 409);
    this.name = "ExerciseInUseError";
  }
}
