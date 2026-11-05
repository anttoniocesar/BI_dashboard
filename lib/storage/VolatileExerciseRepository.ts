import type { ExercisePersistenceContext, ExerciseRepository } from "@/types/exercise-repository";
import type { ExerciseSession } from "@/types/exercise-session";

/** Journey-scoped storage only. No browser storage, server persistence or unload guarantee. */
export class VolatileExerciseRepository implements ExerciseRepository {
  private sessions = new Map<string, ExerciseSession>();
  private key(context: ExercisePersistenceContext) { return JSON.stringify([context.exerciseId, context.exerciseVersion, context.userId, context.attemptId]); }
  async load(context: ExercisePersistenceContext) {
    const session = this.sessions.get(this.key(context));
    return session ? structuredClone(session) : null;
  }
  async save(context: ExercisePersistenceContext, session: ExerciseSession) {
    if (session.exerciseId !== context.exerciseId || session.exerciseVersion !== context.exerciseVersion) throw new Error("Identidade de rascunho incompatível.");
    const lastSavedAt = new Date().toISOString();
    this.sessions.set(this.key(context), structuredClone({ ...session, lastSavedAt }));
    return { lastSavedAt };
  }
  async clear(context: ExercisePersistenceContext) { this.sessions.delete(this.key(context)); }
  discard() { this.sessions.clear(); }
}
