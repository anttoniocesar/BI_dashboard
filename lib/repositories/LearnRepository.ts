import type { StudentIdentity } from "../../types/admin";
import type { StudentCourseProgress } from "../../types/student-progress";
import type { ProgressWrite } from "../data/validation";
export interface LearnData {
  identity: StudentIdentity | null;
  courseIds: string[];
  progress: Record<string, StudentCourseProgress>;
  teachers: { courseId: string; name: string }[];
  rows?: ProgressRow[];
}
export interface LearnRepository {
  load(): Promise<LearnData>;
  getStudentIdentity(): Promise<StudentIdentity | null>;
  getReleasedCourses(): Promise<string[]>;
  getProgress(): Promise<Record<string, StudentCourseProgress>>;
  saveProgress(input: ProgressWrite): Promise<void>;
}
export abstract class LearnRepositoryBase implements LearnRepository {
  abstract load(): Promise<LearnData>;
  abstract saveProgress(input: ProgressWrite): Promise<void>;
  async getStudentIdentity() { return (await this.load()).identity; }
  async getReleasedCourses() { return (await this.load()).courseIds; }
  async getProgress() { return (await this.load()).progress; }
}
export interface ProgressRow { course_id: string; chapter_id: string; activity_id: string; status: string; updated_at: string; completed_at?: string | null }
export function progressFromRows(rows: ProgressRow[]): Record<string, StudentCourseProgress> {
  const result: Record<string, StudentCourseProgress> = {};
  for (const row of [...rows].sort((a,b) => a.updated_at.localeCompare(b.updated_at))) {
    const current = result[row.course_id] ?? { courseId: row.course_id, completedActivities: [], currentChapterId: null };
    current.currentChapterId = row.chapter_id;
    if (row.status === "completed" && row.activity_id && !current.completedActivities.includes(row.activity_id)) current.completedActivities.push(row.activity_id);
    result[row.course_id] = current;
  }
  return result;
}
