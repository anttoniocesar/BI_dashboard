import type { ExerciseDefinition } from "./exercise";
import type { ExerciseDraft } from "./exercise-draft";

export type CourseStatus = "draft" | "published" | "archived";
export type ActivityType = "video" | "text" | "material" | "spreadsheet-exercise" | "assessment";
export type ChapterActivityGroup = "video-lesson" | "video-application" | "laboratory";
type ActivityBase = { id: string; sourceActivityId?: string; title: string; order: number; required: boolean; navigationGroup?: ChapterActivityGroup };
export type ActivityDraft = ActivityBase & (
  | { type: "video"; content: { url: string; durationMinutes?: number } }
  | { type: "text" | "material"; content: { text: string; url?: string; fileName?: string } }
  | { type: "spreadsheet-exercise"; content: { exerciseId: string; exerciseVersion?: string } }
  | { type: "assessment"; content: { description: string } }
);
export type ChapterDraft = {
  trailPointId?: string;
  id: string; sourceChapterId?: string; title: string; description?: string; order: number;
  completionPolicy: "all-required-activities";
  activities: ActivityDraft[];
};
export type CourseDraft = {
  id: string; title: string; description: string; objective: string; workload: number;
  courseFamilyId?: string; versionNumber?: number; basedOnCourseId?: string; publishedAt?: string;
  image: { kind: "placeholder"; label: string };
  service: "standalone-course"; status: CourseStatus;
  chapters: ChapterDraft[]; updatedAt: string; createdAt?: string; createdBy?: string; createdByName?: string;
};
export type StudioExercise = { id: string; draft: ExerciseDraft; definition: ExerciseDefinition; updatedAt: string; createdBy?: string };
export type ExerciseLibrary = Record<string, StudioExercise>;
