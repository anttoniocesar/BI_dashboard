import { DataError } from "./http";
import type { AdminCommand } from "../admin/session";
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new DataError("Dados inválidos.");
  return value as Record<string, unknown>;
}
export function text(value: unknown, max = 160, allowEmpty = false): string {
  if (typeof value !== "string" || (!allowEmpty && !value.trim()) || value.length > max || /[\u0000-\u001f]/.test(value)) throw new DataError("Dados inválidos.");
  return value.trim();
}
export function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  if (Object.keys(value).some(key => !keys.includes(key)) || keys.some(key => !(key in value))) throw new DataError("Dados inválidos.");
}
export function parseLogin(value: unknown) {
  const data = record(value); exactKeys(data, ["identifier", "password"]);
  text(data.password,4096);
  return { identifier: text(data.identifier, 254), password: data.password as string };
}
const commandKeys: Record<string, string[]> = {
  "create-user": ["id", "name", "email", "roles", "status", "createdAt"],
  "update-user": ["userId", "name", "email", "roles", "status"],
  enroll: ["id", "userId", "createdAt"], "enrollment-status": ["id", "status"],
  "assign-service": ["id", "userId", "serviceId"], "service-status": ["id", "status"],
  "grant-course": ["userServiceId", "courseId"], "revoke-course": ["userServiceId", "courseId"], "assign-teacher": ["userId", "courseId"],
};
export function parseAdminCommand(value: unknown): AdminCommand {
  const data = record(value); const type = text(data.type, 40);
  if (type !== data.type) throw new DataError("Operação inválida.");
  if (!Object.hasOwn(commandKeys, type)) throw new DataError("Operação inválida.");
  exactKeys(data, ["type", ...commandKeys[type]]);
  for (const [key, entry] of Object.entries(data)) {
    if (key === "roles") {
      if (!Array.isArray(entry) || !entry.length || entry.length > 3 || new Set(entry).size !== entry.length || entry.some(role => !["student", "teacher", "admin"].includes(role))) throw new DataError("Perfis inválidos.");
    } else if (key === "status") { if (entry !== "active" && entry !== "inactive") throw new DataError("Status inválido."); }
    else { text(entry, key === "email" ? 254 : 160); }
  }
  if ("email" in data && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.email))) throw new DataError("Email inválido.");
  if ("createdAt" in data && !Number.isFinite(Date.parse(String(data.createdAt)))) throw new DataError("Data inválida.");
  for (const key of ["userId", "serviceId", "userServiceId"]) if (key in data && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(data[key]))) throw new DataError("Identificador inválido.");
  return structuredClone(data) as AdminCommand;
}
export interface ProgressWrite { courseId: string; chapterId: string; activityId: string; status: "in-progress" | "completed" }
export function parseProgress(value: unknown): ProgressWrite {
  const data = record(value); exactKeys(data, ["courseId", "chapterId", "activityId", "status"]);
  if (data.status !== "in-progress" && data.status !== "completed") throw new DataError("Status inválido.");
  const activityId = text(data.activityId, 160, true);
  if (!activityId && data.status === "completed") throw new DataError("Atividade inválida.");
  return { courseId: text(data.courseId), chapterId: text(data.chapterId), activityId, status: data.status };
}
