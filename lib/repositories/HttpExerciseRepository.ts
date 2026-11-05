import { dataRequest, DataError } from "../data/http";
import { attemptIdentity } from "../attempts/identity";
import type { ExerciseRepository, ExercisePersistenceContext, SaveResult } from "../../types/exercise-repository";
import type { ExerciseSession } from "../../types/exercise-session";

/** User binding is a consistency check. The API always derives its actor from cookies. */
export class HttpExerciseRepository implements ExerciseRepository {
  readonly requireSuccessfulLoad = true;
  constructor(private userId: string, private currentUser: () => string) {}
  private check() { if (!this.userId || this.currentUser() !== this.userId) throw new DataError("A sessão mudou. Entre novamente antes de salvar.", 409); }
  private async operation(context: ExercisePersistenceContext, operation: "load" | "save" | "clear", state?: ExerciseSession) {
    this.check();
    const result = await dataRequest<{ state: ExerciseSession | null; lastSavedAt: string }>("/api/attempts", { operation, identity: attemptIdentity(context), ...(state ? { state } : {}) }, { "X-Expected-User": this.userId });
    this.check(); return result;
  }
  async load(context: ExercisePersistenceContext) { return (await this.operation(context, "load")).state; }
  async save(context: ExercisePersistenceContext, state: ExerciseSession): Promise<SaveResult> { return { lastSavedAt: (await this.operation(context, "save", state)).lastSavedAt }; }
  async clear(context: ExercisePersistenceContext) { await this.operation(context, "clear"); }
}
