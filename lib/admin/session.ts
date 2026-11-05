import type { AdminState, AdminStatus, Role, StudentIdentity, User } from "../../types/admin";
import { hasPermission, hasRole, rolePermissions } from "./permissions";

export type AdminCommand =
  | { type: "create-user"; id: string; name: string; email: string; roles: Role[]; status: AdminStatus; createdAt: string }
  | { type: "update-user"; userId: string; name: string; email: string; roles: Role[]; status: AdminStatus }
  | { type: "enroll"; id: string; userId: string; createdAt: string }
  | { type: "enrollment-status"; id: string; status: AdminStatus }
  | { type: "assign-service"; id: string; userId: string; serviceId: string }
  | { type: "service-status"; id: string; status: AdminStatus }
  | { type: "grant-course"; userServiceId: string; courseId: string }
  | { type: "revoke-course"; userServiceId: string; courseId: string }
  | { type: "assign-teacher"; userId: string; courseId: string };

function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function validStatus(status: AdminStatus) {
  requireValue(status === "active" || status === "inactive", "Status inválido.");
}
function userFields(state: AdminState, input: Pick<User, "name" | "email" | "roles" | "status">, exceptId?: string) {
  requireValue(input.name.trim(), "Informe o nome.");
  requireValue(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()), "Informe um email válido.");
  requireValue(!state.users.some(user => user.id !== exceptId && user.email.toLowerCase() === input.email.trim().toLowerCase()), "Email já cadastrado nesta sessão.");
  requireValue(input.roles.length && input.roles.every(role => Object.hasOwn(rolePermissions, role)), "Selecione pelo menos um perfil válido.");
  validStatus(input.status);
}
/** Pure, unique within the supplied session. Registration is independent of the user ID. */
export function generateRegistrationCode(enrollments: AdminState["enrollments"], year: number): string {
  requireValue(Number.isInteger(year) && year >= 1000 && year <= 9999, "Ano de matrícula inválido.");
  const prefix = String(year);
  const used = new Set(enrollments.map(item => item.registrationCode));
  for (let sequence = 1; sequence <= 99999; sequence++) {
    const code = prefix + String(sequence).padStart(5, "0");
    if (!used.has(code)) return code;
  }
  throw new Error("Faixa de matrículas esgotada para este ano.");
}

/** All mutations check permissions here, independently of button visibility. No authentication is implied. */
export function applyAdminCommand(state: AdminState, actorId: string, command: AdminCommand, courseIds: readonly string[]): AdminState {
  const serviceOperation = ["assign-service", "service-status", "grant-course", "revoke-course"].includes(command.type);
  requireValue(hasPermission(state.users.find(user => user.id === actorId), serviceOperation ? "services:manage" : "users:manage"), "Perfil sem permissão para esta operação.");
  if (command.type === "create-user") {
    userFields(state, command);
    requireValue(command.id && !state.users.some(user => user.id === command.id), "Identificador de usuário já utilizado.");
    const { type: _type, ...user } = command;
    return { ...state, users: [...state.users, { ...user, name: user.name.trim(), email: user.email.trim().toLowerCase(), roles: [...new Set(user.roles)] }] };
  }
  if (command.type === "update-user") {
    requireValue(state.users.some(user => user.id === command.userId), "Usuário não encontrado.");
    userFields(state, command, command.userId);
    return { ...state, users: state.users.map(user => user.id === command.userId ? { ...user, name: command.name.trim(), email: command.email.trim().toLowerCase(), status: command.status, roles: [...new Set(command.roles)] } : user) };
  }
  if (command.type === "enrollment-status" || command.type === "service-status") {
    validStatus(command.status);
    if (command.type === "enrollment-status") {
      requireValue(state.enrollments.some(item => item.id === command.id), "Matrícula não encontrada.");
      return { ...state, enrollments: state.enrollments.map(item => item.id === command.id ? { ...item, status: command.status } : item) };
    }
    requireValue(state.userServices.some(item => item.id === command.id), "Vínculo não encontrado.");
    return { ...state, userServices: state.userServices.map(item => item.id === command.id ? { ...item, status: command.status } : item) };
  }
  if (command.type === "revoke-course") {
    requireValue(state.userServices.some(item => item.id === command.userServiceId), "Vínculo não encontrado.");
    return { ...state, courseAccess: state.courseAccess.filter(item => item.userServiceId !== command.userServiceId || item.courseId !== command.courseId) };
  }
  if (command.type === "grant-course") {
    const link = state.userServices.find(item => item.id === command.userServiceId);
    requireValue(link?.status === "active", "Selecione um vínculo de serviço ativo.");
    requireStudent(state, link.userId);
    requireValue(state.enrollments.some(item => item.userId === link.userId && item.status === "active"), "É necessária uma matrícula ativa.");
    requireValue(courseIds.includes(command.courseId), "Curso não encontrado na sessão.");
    if (state.courseAccess.some(item => item.userServiceId === link.id && item.courseId === command.courseId)) return state;
    return { ...state, courseAccess: [...state.courseAccess, { userServiceId: link.id, courseId: command.courseId }] };
  }
  if (command.type === "assign-teacher") {
    requireValue(hasRole(state.users.find(user => user.id === command.userId), "teacher"), "É necessário um professor ativo.");
    requireValue(courseIds.includes(command.courseId), "Curso não encontrado na sessão.");
    if (state.courseTeachers.some(item => item.userId === command.userId && item.courseId === command.courseId)) return state;
    return { ...state, courseTeachers: [...state.courseTeachers, { userId: command.userId, courseId: command.courseId }] };
  }
  requireStudent(state, command.userId);
  if (command.type === "enroll") {
    requireValue(!state.enrollments.some(item => item.userId === command.userId), "Usuário já possui matrícula; altere seu status.");
    requireValue(command.id && !state.enrollments.some(item => item.id === command.id), "Identificador de matrícula já utilizado.");
    const date = new Date(command.createdAt);
    requireValue(Number.isFinite(date.getTime()), "Data inválida.");
    const year = Number(new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "America/Sao_Paulo" }).format(date));
    return { ...state, enrollments: [...state.enrollments, { id: command.id, userId: command.userId, registrationCode: generateRegistrationCode(state.enrollments, year), status: "active", createdAt: command.createdAt }] };
  }
  requireValue(state.enrollments.some(item => item.userId === command.userId && item.status === "active"), "Gere ou ative a matrícula antes de atribuir serviço.");
  requireValue(state.services.some(item => item.id === command.serviceId), "Serviço não encontrado.");
  requireValue(!state.userServices.some(item => item.userId === command.userId && item.serviceId === command.serviceId), "Serviço já vinculado; altere seu status.");
  requireValue(command.id && !state.userServices.some(item => item.id === command.id), "Identificador de vínculo já utilizado.");
  return { ...state, userServices: [...state.userServices, { id: command.id, userId: command.userId, serviceId: command.serviceId, status: "active" }] };
}
function requireStudent(state: AdminState, userId: string) {
  requireValue(hasRole(state.users.find(user => user.id === userId), "student"), "É necessário um aluno ativo.");
}
export function releasedCourseIds(state: AdminState, userId: string): string[] {
  if (!hasRole(state.users.find(user => user.id === userId), "student") || !state.enrollments.some(item => item.userId === userId && item.status === "active")) return [];
  const links = state.userServices.filter(item => item.userId === userId && item.status === "active");
  return [...new Set(state.courseAccess.filter(item => links.some(link => link.id === item.userServiceId && state.services.some(service => service.id === link.serviceId))).map(item => item.courseId))];
}
export function studentIdentity(state: AdminState, userId: string): StudentIdentity | null {
  const user = state.users.find(item => item.id === userId);
  if (!user) return null;
  return { userId: user.id, name: user.name, initials: user.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join(""), enrollment: state.enrollments.find(item => item.userId === userId && item.status === "active")?.registrationCode ?? null, caption: "Perfil demonstrativo" };
}
