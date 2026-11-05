import type { ExerciseDefinition } from "@/types/exercise";
import type { ExerciseSnapshot, RestoredExercise } from "@/types/exercise-session";
import { deserializeExercise, serializeExercise } from "./exerciseSessionCodec";
export { deserializeExercise, serializeExercise } from "./exerciseSessionCodec";
export const exerciseStorageKey = (definition: ExerciseDefinition): string => definition.persistence?.key ?? `bi-society:lab:${encodeURIComponent(definition.id)}:${encodeURIComponent(definition.version)}:exercise-state:v1`;
export function loadExerciseState(definition: ExerciseDefinition, storage?: Pick<Storage, "getItem">): { session: RestoredExercise | null; error: boolean } {
  try {
    const raw = (storage ?? window.localStorage).getItem(exerciseStorageKey(definition));
    if (raw === null) return { session: null, error: false };
    try { return { session: deserializeExercise(definition, JSON.parse(raw)), error: false }; }
    catch { return { session: null, error: false }; }
  } catch { return { session: null, error: true }; }
}
export function saveExerciseState(definition: ExerciseDefinition, snapshot: ExerciseSnapshot, storage?: Pick<Storage, "setItem">): string | null {
  try {
    const session = serializeExercise(definition, snapshot);
    (storage ?? window.localStorage).setItem(exerciseStorageKey(definition), JSON.stringify(session));
    return session.lastSavedAt;
  } catch { return null; }
}
export function clearExerciseState(definition: ExerciseDefinition, storage?: Pick<Storage, "removeItem">): boolean {
  try { (storage ?? window.localStorage).removeItem(exerciseStorageKey(definition)); return true; }
  catch { return false; }
}
