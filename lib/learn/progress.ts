import type { CourseDraft } from "@/types/course";
import type { CourseAccessPolicy, StudentCourseProgress } from "@/types/student-progress";

export const defaultCourseAccess: CourseAccessPolicy = { sequentialChapters: true };
export function initialProgress(courseId: string): StudentCourseProgress {
  return { courseId, completedActivities: [], currentChapterId: null };
}
export function inOrder<T extends { order: number }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.order - b.order);
}
export function courseProgress(course: CourseDraft, progress: StudentCourseProgress, policy = defaultCourseAccess) {
  const done = new Set(progress.courseId === course.id ? progress.completedActivities : []);
  let precedingComplete = true;
  const chapters = inOrder(course.chapters).map(chapter => {
    const required = chapter.activities.filter(activity => activity.required);
    const completedCount = required.filter(activity => done.has(activity.id)).length;
    // Empty chapters cannot finish. A nonempty chapter with only optional work
    // satisfies its required-work policy without forcing optional completion.
    const completed = chapter.activities.length > 0 && completedCount === required.length;
    const available = !policy.sequentialChapters || precedingComplete;
    precedingComplete = precedingComplete && completed;
    return { id: chapter.id, requiredCount: required.length, completedCount, completed, available,
      percent: required.length ? Math.round(completedCount / required.length * 100) : completed ? 100 : 0 };
  });
  const current = chapters.find(chapter => chapter.id === progress.currentChapterId && chapter.available && !chapter.completed)
    ?? chapters.find(chapter => chapter.available && !chapter.completed);
  const requiredCount = chapters.reduce((sum, chapter) => sum + chapter.requiredCount, 0);
  const completedCount = chapters.reduce((sum, chapter) => sum + chapter.completedCount, 0);
  const completedChapters = chapters.filter(chapter => chapter.completed).map(chapter => chapter.id);
  const completed = chapters.length > 0 && completedChapters.length === chapters.length;
  return { chapters: chapters.map(chapter => ({ ...chapter, status: chapter.completed ? "Concluído" as const : !chapter.available ? "Bloqueado" as const : chapter.id === current?.id ? "Atual" as const : "Disponível" as const })),
    completedChapters, currentChapterId: current?.id ?? null, requiredCount, completedCount, completed,
    percent: completed ? 100 : requiredCount ? Math.min(99, Math.round(completedCount / requiredCount * 100)) : 0 };
}
export function completeActivity(course: CourseDraft, progress: StudentCourseProgress, chapterId: string, activityId: string, policy = defaultCourseAccess): StudentCourseProgress {
  const chapter = course.chapters.find(item => item.id === chapterId);
  if (!chapter?.activities.some(item => item.id === activityId) || !courseProgress(course, progress, policy).chapters.find(item => item.id === chapterId)?.available || progress.completedActivities.includes(activityId)) return progress;
  return { ...progress, completedActivities: [...progress.completedActivities, activityId], currentChapterId: chapterId };
}
