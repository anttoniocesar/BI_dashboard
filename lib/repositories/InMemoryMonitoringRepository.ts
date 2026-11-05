import type { AdminState } from "../../types/admin";
import type { MonitoringRepository } from "./MonitoringRepository";
import type { ProgressRow } from "./LearnRepository";
import { hasRole } from "../admin/permissions";
import { releasedCourseIds } from "../admin/session";
import { DataError } from "../data/http";
export class InMemoryMonitoringRepository implements MonitoringRepository {
  constructor(private state: () => AdminState, private actorId: string, private rows: (userId: string) => ProgressRow[]) {}
  private read(courseId?: string, userId?: string) {
    const state = this.state();
    const actor = state.users.find(user => user.id === this.actorId);
    if (!actor || actor.status !== "active" || !hasRole(actor,"teacher")) throw new DataError("Acesso não autorizado.",403);
    const ids = [...new Set(state.courseTeachers.filter(link => link.userId === actor.id).map(link => link.courseId))];
    if (courseId && !ids.includes(courseId)) throw new DataError("Acesso não autorizado.",403);
    const courses = (courseId ? [courseId] : ids).map(id => ({ courseId:id, students:state.users.filter(user => releasedCourseIds(state,user.id).includes(id) && (!userId || user.id === userId)).map(user => ({ userId:user.id,name:user.name,registrationCode:state.enrollments.find(item => item.userId === user.id && item.status === "active")!.registrationCode,rows:this.rows(user.id).filter(row => row.course_id === id) })) }));
    if (userId && !courses.some(course => course.students.length)) throw new DataError("Aluno não disponível neste curso.",404);
    return courses;
  }
  async listTeacherCourses() { return this.read(); }
  async getCourseStudents(courseId: string) { return this.read(courseId)[0]; }
  async getStudentDetail(courseId: string,userId: string) { return this.read(courseId,userId)[0]; }
}
