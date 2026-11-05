import type { ExerciseDefinition } from "@/types/exercise";
import type { ExerciseSession } from "@/types/exercise-session";
import type { ExercisePersistenceContext, ExerciseRepository, SaveResult } from "@/types/exercise-repository";
import { clearExerciseState, deserializeExercise, loadExerciseState, saveExerciseState, serializeExercise } from "./exerciseStorage";

export class LocalStorageExerciseRepository implements ExerciseRepository {
  constructor(private readonly definition: ExerciseDefinition, private readonly storage?: Storage) {}

  private check(context: ExercisePersistenceContext) {
    if (context.exerciseId !== this.definition.id || context.exerciseVersion !== this.definition.version || context.userId !== undefined || context.attemptId !== undefined) {
      throw new Error("Contexto incompatível com o repositório local anônimo.");
    }
  }

  async load(context: ExercisePersistenceContext): Promise<ExerciseSession | null> {
    this.check(context);
    const result = loadExerciseState(this.definition, this.storage);
    if (result.error) throw new Error("Não foi possível carregar o exercício.");
    return result.session ? serializeExercise(this.definition, result.session, result.session.lastSavedAt) : null;
  }

  async save(context: ExercisePersistenceContext, session: ExerciseSession): Promise<SaveResult> {
    return this.saveOnExit(context, session);
  }

  saveOnExit(context: ExercisePersistenceContext, session: ExerciseSession): SaveResult {
    this.check(context);
    const restored = deserializeExercise(this.definition, session);
    if (!restored) throw new Error("Sessão inválida.");
    const lastSavedAt = saveExerciseState(this.definition, restored, this.storage);
    if (!lastSavedAt) throw new Error("Não foi possível salvar o exercício.");
    return { lastSavedAt };
  }

  async clear(context: ExercisePersistenceContext): Promise<void> {
    this.check(context);
    if (!clearExerciseState(this.definition, this.storage)) throw new Error("Não foi possível apagar a sessão.");
  }
}
