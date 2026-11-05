import type { MonitoringRepository } from "./MonitoringRepository";
import type { MonitoringCourseData } from "../../types/monitoring";
import { dataRequest } from "../data/http";
export class HttpMonitoringRepository implements MonitoringRepository {
  private request(courseId?: string, userId?: string) {
    const query = new URLSearchParams();
    if (courseId) query.set("courseId",courseId);
    if (userId) query.set("userId",userId);
    return dataRequest<MonitoringCourseData[]>(`/api/monitoring?${query}`);
  }
  listTeacherCourses() { return this.request(); }
  async getCourseStudents(courseId: string) { return (await this.request(courseId))[0]; }
  async getStudentDetail(courseId: string,userId: string) { return (await this.request(courseId,userId))[0]; }
}
