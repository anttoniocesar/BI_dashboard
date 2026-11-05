import { DataError } from "../data/http";
import { hasPermission } from "../admin/permissions";
import { requireCourseAccess } from "../auth/access";
import { parseAdminCommand, parseProgress, record } from "../data/validation";
import type { AdminState, User } from "../../types/admin";
import type { AdminRepository } from "../repositories/AdminRepository";
import type { LearnRepository } from "../repositories/LearnRepository";
import { serverEvent } from "./logging";
import type { SupabaseCourseRepository } from "../repositories/SupabaseCourseRepository";
import {courseForNewGrant} from "../courses/versions";

export interface AuthorizedContext { user: User; state: AdminState; admin: AdminRepository; learn: LearnRepository; courses?: SupabaseCourseRepository }
export async function jsonBody(request: Request, limit = 16384): Promise<unknown> {
  const origin = request.headers.get("origin");
  if (origin && origin !== (process.env.APP_ORIGIN?.trim() || new URL(request.url).origin)) throw new DataError("Origem não permitida.", 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new DataError("Envie dados JSON.", 415);
  const reader = request.body?.getReader(); let size = 0; const chunks: Uint8Array[] = [];
  if (!reader) throw new DataError("Dados inválidos.");
  while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > limit) { await reader.cancel(); throw new DataError("Requisição muito grande.", 413); } chunks.push(value); }
  try { const bytes = new Uint8Array(size); let offset=0; for (const chunk of chunks) { bytes.set(chunk,offset); offset+=chunk.length; } return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new DataError("JSON inválido."); }
}
export async function apiResponse(action: () => Promise<unknown>) {
  try { return Response.json(await action(), { headers: { "Cache-Control": "private, no-store" } }); }
  catch (cause) { const error = cause instanceof DataError ? cause : new DataError("Serviço indisponível. Tente novamente.",503); serverEvent(error.status === 401 || error.status === 403 ? "authorization_failure" : "api_failure", error.status); return Response.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "private, no-store" } }); }
}
export async function adminRequest(request: Request, resolve: () => Promise<AuthorizedContext>) {
  const context = await resolve();
  if (!hasPermission(context.user,"users:manage") && !hasPermission(context.user,"services:manage")) throw new DataError("Acesso não autorizado.",403);
  if (request.method === "GET") return context.state;
  let command = parseAdminCommand(await jsonBody(request));
  const serviceOperation = ["assign-service","service-status","grant-course","revoke-course"].includes(command.type);
  if (!hasPermission(context.user,serviceOperation ? "services:manage" : "users:manage")) throw new DataError("Acesso não autorizado.",403);
  if ((command.type==="grant-course" || command.type==="assign-teacher") && context.courses) {
    const courses=(await context.courses.load()).courses;
    let selectedId=command.courseId;
    if(command.type==="grant-course"){selectedId=courseForNewGrant(courses,context.state,command.userServiceId,command.courseId).id;command={...command,courseId:selectedId};}
    const course=courses.find(c=>c.id===selectedId);
    if (!course || (command.type==="grant-course" && course.status!=="published")) throw new DataError("Publique o curso antes de liberar acesso.");
  }
  return context.admin.execute(command,context.user.id,[]);
}
export async function learnRequest(request: Request, resolve: () => Promise<AuthorizedContext>) {
  const context = await resolve();
  // Consistency assertion only. Identity/authorization still come from the verified session.
  const expected = request.headers.get("x-expected-user");
  if (expected && expected !== context.user.id) throw new DataError("A sessão mudou. Entre novamente antes de salvar.",409);
  if (!hasPermission(context.user,"course:study")) throw new DataError("Acesso não autorizado.",403);
  if (request.method === "GET") return context.learn.load();
  const input = parseProgress(await jsonBody(request));
  if (!requireCourseAccess(context.state,context.user,input.courseId)) throw new DataError("Curso não liberado.",403);
  await context.learn.saveProgress(input);
  return { saved: true };
}
export function emptyPayload(value: unknown) { if (Object.keys(record(value)).length) throw new DataError("Dados inválidos."); }
