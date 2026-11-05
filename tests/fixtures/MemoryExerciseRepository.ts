import type { ExercisePersistenceContext, ExerciseRepository, SaveResult } from "../../types/exercise-repository";
import type { ExerciseSession } from "../../types/exercise-session";

type Operation = "load" | "save" | "clear";
type Behavior = { delay?: number; fail?: boolean; gate?: Promise<void> };
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Test-only remote simulation. A behavior is captured when each operation starts. */
export class MemoryExerciseRepository implements ExerciseRepository {
  readonly sessions = new Map<string, ExerciseSession>();
  readonly calls: { operation: Operation; context: ExercisePersistenceContext; session?: ExerciseSession }[] = [];
  readonly behavior: Record<Operation, Behavior> = { load: {}, save: {}, clear: {} };
  private key(context: ExercisePersistenceContext) {
    return JSON.stringify([context.exerciseId, context.exerciseVersion, context.userId, context.attemptId]);
  }
  seed(context: ExercisePersistenceContext, session: ExerciseSession) { this.sessions.set(this.key(context), copy(session)); }
  peek(context: ExercisePersistenceContext) { const session = this.sessions.get(this.key(context)); return session ? copy(session) : null; }
  private async wait(operation: Operation) {
    const { delay, fail, gate } = this.behavior[operation];
    if (gate) await gate;
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    if (fail) throw new Error(`Falha simulada: ${operation}`);
  }
  async load(context: ExercisePersistenceContext) {
    this.calls.push({ operation: "load", context: { ...context } });
    await this.wait("load");
    return this.peek(context);
  }
  async save(context: ExercisePersistenceContext, session: ExerciseSession): Promise<SaveResult> {
    const snapshot = copy(session);
    this.calls.push({ operation: "save", context: { ...context }, session: snapshot });
    await this.wait("save");
    this.seed(context, snapshot);
    return { lastSavedAt: snapshot.lastSavedAt };
  }
  async clear(context: ExercisePersistenceContext) {
    this.calls.push({ operation: "clear", context: { ...context } });
    await this.wait("clear");
    this.sessions.delete(this.key(context));
  }
}
