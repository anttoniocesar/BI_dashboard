import type { SupabaseClient } from "@supabase/supabase-js";
import type { MonitoringRepository } from "./MonitoringRepository";
import type { MonitoringCourseData } from "../../types/monitoring";
import { databaseError } from "./SupabaseAdminRepository";
import { DataError } from "../data/http";
export class SupabaseMonitoringRepository implements MonitoringRepository {
  constructor(private client: SupabaseClient) {}
  private async request(courseId: string | null = null, userId: string | null = null) {
    const { data,error } = await this.client.rpc("teacher_course_progress",{ requested_course:courseId, requested_student:userId });
    if (error?.code === "P0002") throw new DataError("Aluno não disponível neste curso.",404);
    if (error) databaseError(error);
    return data as MonitoringCourseData[];
  }
  listTeacherCourses() { return this.request(); }
  async getCourseStudents(courseId: string) { return (await this.request(courseId))[0]; }
  async getStudentDetail(courseId: string,userId: string) { return (await this.request(courseId,userId))[0]; }
}
