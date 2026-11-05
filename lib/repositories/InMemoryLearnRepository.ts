import type { AdminState } from "../../types/admin";
import { studentIdentity, releasedCourseIds } from "../admin/session";
import { LearnRepositoryBase, progressFromRows, type ProgressRow } from "./LearnRepository";
import type { ProgressWrite } from "../data/validation";
import { requireCourseAccess } from "../auth/access";
import { DataError } from "../data/http";
export class InMemoryLearnRepository extends LearnRepositoryBase {
  private rows = new Map<string, ProgressRow>();
  constructor(private state: () => AdminState, private userId: string) { super(); }
  getRows() { return [...this.rows.values()].map(row => ({ ...row })); }
  async load() { return { identity: studentIdentity(this.state(), this.userId), courseIds: releasedCourseIds(this.state(), this.userId), progress: progressFromRows(this.getRows()), rows: this.getRows(), teachers: [] }; }
  async saveProgress(input: ProgressWrite) {
    const state=this.state();
    if (!requireCourseAccess(state,state.users.find(user => user.id===this.userId) ?? null,input.courseId)) throw new DataError("Curso não liberado.",403);
    const key = JSON.stringify([input.courseId,input.chapterId,input.activityId]);
    const previous = this.rows.get(key);
    const now = new Date().toISOString();
    this.rows.set(key, { course_id: input.courseId, chapter_id: input.chapterId, activity_id: input.activityId, status: previous?.status === "completed" ? "completed" : input.status, updated_at: now, completed_at: previous?.completed_at ?? (input.status === "completed" ? now : null) });
  }
}
