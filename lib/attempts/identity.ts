import type { ExercisePersistenceContext } from "../../types/exercise-repository";
import type { AttemptIdentity } from "../../types/exercise-attempt";
export function attemptIdentity(context: ExercisePersistenceContext): AttemptIdentity {
  let route: unknown;
  try { route = JSON.parse(context.attemptId ?? ""); } catch { throw new Error("Identidade de tentativa inválida."); }
  if (!Array.isArray(route) || route.length !== 3 || [...route, context.exerciseId, context.exerciseVersion].some(value => typeof value !== "string" || !value.trim() || value.length > 160)) throw new Error("Identidade de tentativa inválida.");
  return { courseId: route[0], chapterId: route[1], activityId: route[2], exerciseId: context.exerciseId, exerciseVersion: context.exerciseVersion };
}
