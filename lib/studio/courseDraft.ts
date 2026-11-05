import { journeyIssues, resolvedJourney } from "../courses/journey";
import type { ActivityDraft, ChapterDraft, CourseDraft, ExerciseLibrary } from "@/types/course";
import { validateExerciseDefinition } from "@/lib/exercises/definition";
import { navigationGroupIssue } from "@/lib/learn/chapter-navigation";

export const activityLabels = { video: "Vídeo", text: "Texto", material: "Material", "spreadsheet-exercise": "Exercício Lab", assessment: "Avaliação" } as const;
export type CourseDetails = Pick<CourseDraft, "title" | "description" | "objective" | "workload" | "image">;
export function createCourse(details: CourseDetails): CourseDraft {
  const id=`course-${crypto.randomUUID()}`;
  return { ...structuredClone(details), id, courseFamilyId:id,versionNumber:1,status: "draft", service: "standalone-course", chapters: [], updatedAt: new Date().toISOString() };
}
export function createChapter(title: string): ChapterDraft {
  return { id: `chapter-${crypto.randomUUID()}`, title, order: 1, completionPolicy: "all-required-activities", activities: [] };
}
export function ordered<T extends { order: number }>(items: T[]): T[] { return items.map((item, index) => ({ ...item, order: index + 1 })); }
export function moveOrdered<T extends { id: string; order: number }>(items: T[], id: string, delta: -1 | 1): T[] {
  const index = items.findIndex(item => item.id === id), target = index + delta;
  if (index < 0 || target < 0 || target >= items.length) return items;
  const next = [...items]; [next[index], next[target]] = [next[target], next[index]];
  return ordered(next);
}
export function upsertActivity(chapter: ChapterDraft, activity: ActivityDraft): ChapterDraft {
  const exists = chapter.activities.some(item => item.id === activity.id);
  return { ...chapter, activities: ordered(exists ? chapter.activities.map(item => item.id === activity.id ? structuredClone(activity) : item) : [...chapter.activities, structuredClone(activity)]) };
}
export function validateCourseDraft(course: CourseDraft, library: ExerciseLibrary): string[] {
  const issues: string[] = journeyIssues(resolvedJourney(course.chapters));
  if (!course.title.trim()) issues.push("O curso precisa de um título.");
  if (!Number.isFinite(course.workload) || course.workload < 0) issues.push("Carga horária deve ser um número maior ou igual a zero.");
  if (!["draft", "published", "archived"].includes(course.status) || course.service !== "standalone-course") issues.push("Tipo ou status do curso inválido.");
  if (!course.chapters.length) issues.push("O curso precisa de pelo menos um capítulo.");
  const ids = new Set<string>([course.id]);
  function checkId(id: string) { if (!id || ids.has(id)) issues.push("Há uma identidade ausente ou duplicada na estrutura."); ids.add(id); }
  course.chapters.forEach((chapter, index) => {
    checkId(chapter.id);
    const chapterName = chapter.title.trim() || `Capítulo ${index + 1}`;
    if (!chapter.title.trim()) issues.push(`${chapterName}: informe o título.`);
    if (chapter.order !== index + 1) issues.push(`${chapterName}: ordem inválida.`);
    if (chapter.completionPolicy !== "all-required-activities") issues.push(`${chapterName}: critério de conclusão inválido.`);
    chapter.activities.forEach((activity, activityIndex) => {
      checkId(activity.id);
      const name = activity.title.trim() || `Atividade ${activityIndex + 1}`;
      if (!activity.title.trim()) issues.push(`${chapterName}: atividade precisa de título.`);
      if (!Object.hasOwn(activityLabels, activity.type)) { issues.push(`${name}: tipo de atividade inválido.`); return; }
      if (typeof activity.required !== "boolean" || activity.order !== activityIndex + 1) issues.push(`${name}: obrigatoriedade ou ordem inválida.`);
      const groupIssue = navigationGroupIssue(activity);
      if (groupIssue) issues.push(groupIssue);
      if (activity.type === "spreadsheet-exercise") {
        const key = activity.content.exerciseVersion ? JSON.stringify([activity.content.exerciseId,activity.content.exerciseVersion]) : activity.content.exerciseId;
        const entry = Object.hasOwn(library,key) ? library[key] : Object.hasOwn(library, activity.content.exerciseId) ? library[activity.content.exerciseId] : undefined;
        if (!entry) issues.push(`${name}: selecione um exercício disponível nesta sessão.`);
        else try { validateExerciseDefinition(entry.definition); if (activity.content.exerciseVersion && activity.content.exerciseVersion !== entry.definition.version) issues.push(`${name}: versão do exercício indisponível.`); } catch { issues.push(`${name}: definição de exercício inválida.`); }
      }
      if (activity.type === "video") {
        if (!isHttpUrl(activity.content.url)) issues.push(`${name}: informe uma URL HTTP/HTTPS de vídeo.`);
        if (activity.content.durationMinutes !== undefined && (!Number.isFinite(activity.content.durationMinutes) || activity.content.durationMinutes < 0)) issues.push(`${name}: duração inválida.`);
      }
      if ((activity.type === "text" || activity.type === "material") && activity.content.url && !isHttpUrl(activity.content.url)) issues.push(`${name}: URL de material inválida.`);
    });
  });
  return issues;
}
export function isHttpUrl(value: string): boolean {
  try { const url = new URL(value); return url.protocol === "https:" || url.protocol === "http:"; } catch { return false; }
}
