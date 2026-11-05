import { hasRole } from "../admin/permissions";
import { DataError } from "../data/http";
import { text } from "../data/validation";
import type { User } from "../../types/admin";
import type { MonitoringRepository } from "../repositories/MonitoringRepository";
export async function monitoringRequest(request: Request, resolve: () => Promise<{ user:User; monitoring:MonitoringRepository }>) {
  const { user,monitoring } = await resolve();
  if (!hasRole(user,"teacher")) throw new DataError("Acesso não autorizado.",403);
  const query = new URL(request.url).searchParams;
  for (const key of query.keys()) if (!["courseId","userId"].includes(key) || query.getAll(key).length !== 1) throw new DataError("Consulta inválida.");
  const courseId = query.has("courseId") ? text(query.get("courseId")) : null;
  const userId = query.has("userId") ? text(query.get("userId")) : null;
  if (userId && (!courseId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId))) throw new DataError("Identificador inválido.");
  return courseId ? [userId ? await monitoring.getStudentDetail(courseId,userId) : await monitoring.getCourseStudents(courseId)] : monitoring.listTeacherCourses();
}
