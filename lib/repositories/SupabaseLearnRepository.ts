import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminState } from "../../types/admin";
import { LearnRepositoryBase, progressFromRows, type ProgressRow } from "./LearnRepository";
import { studentIdentity, releasedCourseIds } from "../admin/session";
import { databaseError } from "./SupabaseAdminRepository";
import type { ProgressWrite } from "../data/validation";
export class SupabaseLearnRepository extends LearnRepositoryBase {
  constructor(private client: SupabaseClient, private state: AdminState, private userId: string) { super(); }
  async load() {
    const [rows, teachers] = await Promise.all([
      this.client.from("student_progress").select("course_id,chapter_id,activity_id,status,updated_at,completed_at").eq("user_id", this.userId),
      this.client.rpc("course_teacher_names"),
    ]);
    if (rows.error) databaseError(rows.error);
    if (teachers.error) databaseError(teachers.error);
    return { identity: studentIdentity(this.state,this.userId), courseIds: releasedCourseIds(this.state,this.userId), progress: progressFromRows(rows.data as ProgressRow[]), rows: rows.data as ProgressRow[], teachers: teachers.data as { courseId: string; name: string }[] };
  }
  async saveProgress(input: ProgressWrite) {
    // No user ID argument: PostgreSQL resolves auth.uid() itself.
    const { error } = await this.client.rpc("save_student_progress", { course: input.courseId, chapter: input.chapterId, activity: input.activityId, progress_status: input.status });
    if (error) databaseError(error);
  }
}
