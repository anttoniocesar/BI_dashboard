import type { ProgressRow } from "../lib/repositories/LearnRepository";

export type StudentLearningStatus = "not-started" | "in-progress" | "completed";
/** Only educational identity and rows for one authorized course. No email or Lab data. */
export interface MonitoredStudent {
  userId: string;
  name: string;
  registrationCode: string;
  rows: ProgressRow[];
}
export interface MonitoringCourseData { courseId: string; students: MonitoredStudent[] }
