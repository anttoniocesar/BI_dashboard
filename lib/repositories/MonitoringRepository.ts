import type { MonitoringCourseData } from "../../types/monitoring";
export interface MonitoringRepository {
  listTeacherCourses(): Promise<MonitoringCourseData[]>;
  getCourseStudents(courseId: string): Promise<MonitoringCourseData>;
  getStudentDetail(courseId: string, userId: string): Promise<MonitoringCourseData>;
}
