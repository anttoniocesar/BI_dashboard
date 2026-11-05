import { hasPermission } from "../admin/permissions";
import { requireCourseAccess } from "../auth/access";
import { ATTEMPT_BYTES, parseAttempt } from "../attempts/validation";
import { DataError } from "../data/http";
import { jsonBody, type AuthorizedContext } from "./api";
import type { SupabaseExerciseRepository } from "../repositories/SupabaseExerciseRepository";
import { serverEvent } from "./logging";
import type { SupabaseCourseRepository } from "../repositories/SupabaseCourseRepository";
export async function attemptRequest(request: Request, resolve: () => Promise<AuthorizedContext & { attempts: SupabaseExerciseRepository; courses?: SupabaseCourseRepository }>) {
  const context = await resolve();
  if (request.headers.get("x-expected-user") !== context.user.id) throw new DataError("A sessão mudou. Entre novamente antes de salvar.", 409);
  if (!hasPermission(context.user, "course:study")) throw new DataError("Acesso não autorizado.", 403);
  const input = parseAttempt(await jsonBody(request, ATTEMPT_BYTES),context.courses ? await context.courses.load() : undefined);
  if (!requireCourseAccess(context.state, context.user, input.identity.courseId)) throw new DataError("Curso não liberado.", 403);
  try { return await context.attempts.operate(input.operation, input.identity, input.state); }
  catch (cause) { serverEvent("persistence_failure", 503); throw cause; }
}
