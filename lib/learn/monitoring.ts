import type { CourseDraft } from "../../types/course";
import type { MonitoredStudent, StudentLearningStatus } from "../../types/monitoring";
import type { StudentCourseProgress } from "../../types/student-progress";
import { courseProgress, initialProgress, inOrder } from "./progress";
import { progressFromRows, type ProgressRow } from "../repositories/LearnRepository";

export const learningStatusLabels: Record<StudentLearningStatus,string> = {
  "not-started": "Não iniciado", "in-progress": "Em andamento", completed: "Concluído",
};
export function formatLearningDate(value: string | null | undefined) {
  return value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat("pt-BR", { timeZone:"America/Sao_Paulo", dateStyle:"short", timeStyle:"short" }).format(new Date(value)) : "Sem registro";
}
export function learningProjection(course: CourseDraft, source: ProgressRow[], supplied?: StudentCourseProgress, now = Date.now()) {
  const rows = source.filter(row => row.course_id === course.id && course.chapters.some(chapter => chapter.id === row.chapter_id && (!row.activity_id || chapter.activities.some(activity => activity.id === row.activity_id))));
  const progress = supplied ?? progressFromRows(rows)[course.id] ?? initialProgress(course.id);
  const summary = courseProgress(course,progress);
  const ordered = [...rows].sort((a,b) => b.updated_at.localeCompare(a.updated_at));
  const last = ordered.find(row => row.activity_id);
  const lastActivity = course.chapters.flatMap(chapter => chapter.activities).find(activity => activity.id === last?.activity_id);
  const currentId = progress.currentChapterId ?? ordered[0]?.chapter_id ?? summary.currentChapterId;
  const currentChapter = course.chapters.find(chapter => chapter.id === currentId);
  const updatedAt = ordered[0]?.updated_at ?? null;
  const started = rows.some(row => row.status !== "not-started") || progress.completedActivities.length > 0 || !!progress.currentChapterId;
  const status: StudentLearningStatus = summary.completed ? "completed" : started ? "in-progress" : "not-started";
  return { ...summary, status, currentChapter, lastActivity, lastActivityAt:last?.updated_at ?? null, updatedAt,
    noRecentActivity: !updatedAt || now - Date.parse(updatedAt) > 7 * 86400000,
    chaptersDetail: inOrder(course.chapters).map(chapter => {
      const state = summary.chapters.find(item => item.id === chapter.id)!;
      const chapterRows = rows.filter(row => row.chapter_id === chapter.id);
      const status: StudentLearningStatus = state.completed ? "completed" : chapterRows.some(row => row.status !== "not-started") || chapter.activities.some(activity => progress.completedActivities.includes(activity.id)) || progress.currentChapterId === chapter.id ? "in-progress" : "not-started";
      return { chapter, state, status, activities: inOrder(chapter.activities).map(activity => {
        const row = chapterRows.find(item => item.activity_id === activity.id);
        const status: StudentLearningStatus = progress.completedActivities.includes(activity.id) ? "completed" : row?.status === "in-progress" ? "in-progress" : "not-started";
        return { activity, status, completedAt: row?.completed_at ?? null };
      }) };
    }),
  };
}
export function monitoredStudents(course: CourseDraft, students: MonitoredStudent[], now = Date.now()) {
  return students.map(student => ({ ...student, learning: learningProjection(course,student.rows,undefined,now) }));
}
export function monitoringSummary(course: CourseDraft, students: MonitoredStudent[], now = Date.now()) {
  const list = monitoredStudents(course,students,now);
  return { total:list.length, started:list.filter(item => item.learning.status !== "not-started").length,
    completed:list.filter(item => item.learning.completed).length,
    inProgress:list.filter(item => item.learning.status === "in-progress").length,
    average:list.length ? Math.round(list.reduce((sum,item) => sum+item.learning.percent,0)/list.length) : 0,
    inactive:list.filter(item => item.learning.noRecentActivity).length };
}
export function filterMonitoringStudents(students: ReturnType<typeof monitoredStudents>, status: string, search: string, sort: string) {
  const query = search.trim().toLocaleLowerCase("pt-BR");
  return students.filter(item => (status === "all" || item.learning.status === status) && `${item.name} ${item.registrationCode}`.toLocaleLowerCase("pt-BR").includes(query))
    .sort((a,b) => (sort === "progress" ? b.learning.percent-a.learning.percent : sort === "recent" ? (b.learning.lastActivityAt ?? "").localeCompare(a.learning.lastActivityAt ?? "") : 0) || a.name.localeCompare(b.name,"pt-BR"));
}
