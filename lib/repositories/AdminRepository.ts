import type { AdminState, User, Role } from "../../types/admin";
import type { AdminCommand } from "../admin/session";
export interface AdminResult { state: AdminState; userId?: string }
export interface AdminRepository {
  load(): Promise<AdminState>;
  execute(command: AdminCommand, actorId: string, courseIds: string[]): Promise<AdminResult>;
  listUsers(): Promise<User[]>;
  getUser(id: string): Promise<User | null>;
  listEnrollments(): Promise<AdminState["enrollments"]>;
}
export abstract class AdminRepositoryBase implements AdminRepository {
  abstract load(): Promise<AdminState>;
  abstract execute(command: AdminCommand, actorId: string, courseIds: string[]): Promise<AdminResult>;
  async listUsers() { return (await this.load()).users; }
  async getUser(id: string) { return (await this.listUsers()).find(user => user.id === id) ?? null; }
  async listEnrollments() { return (await this.load()).enrollments; }
  createUser(command: Extract<AdminCommand, { type: "create-user" }>, actor: string, courses: string[]) { return this.execute(command, actor, courses); }
  updateUser(command: Extract<AdminCommand, { type: "update-user" }>, actor: string, courses: string[]) { return this.execute(command, actor, courses); }
  createEnrollment(userId: string, actor: string) { return this.execute({ type: "enroll", userId, id: crypto.randomUUID(), createdAt: new Date().toISOString() }, actor, []); }
  async assignRole(userId: string, role: Role, actor: string) { const user = await this.getUser(userId); if (!user) throw new Error("Usuário não encontrado."); return this.execute({ type: "update-user", userId, name: user.name, email: user.email, status: user.status, roles: [...new Set([...user.roles, role])] }, actor, []); }
  async removeRole(userId: string, role: Role, actor: string) { const user = await this.getUser(userId); if (!user) throw new Error("Usuário não encontrado."); return this.execute({ type: "update-user", userId, name: user.name, email: user.email, status: user.status, roles: user.roles.filter(item => item !== role) }, actor, []); }
  assignService(userId: string, serviceId: string, actor: string) { return this.execute({ type: "assign-service", userId, serviceId, id: crypto.randomUUID() }, actor, []); }
  updateUserService(id: string, status: "active" | "inactive", actor: string) { return this.execute({ type: "service-status", id, status }, actor, []); }
  grantCourseAccess(userServiceId: string, courseId: string, actor: string, courses: string[]) { return this.execute({ type: "grant-course", userServiceId, courseId }, actor, courses); }
  revokeCourseAccess(userServiceId: string, courseId: string, actor: string) { return this.execute({ type: "revoke-course", userServiceId, courseId }, actor, []); }
  assignTeacher(userId: string, courseId: string, actor: string, courses: string[]) { return this.execute({ type: "assign-teacher", userId, courseId }, actor, courses); }
}
