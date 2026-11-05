// Exercise-specific binding used by the unchanged stage 7–9 regression scenarios.
import { neuralExerciseDefinition as definition } from "../../data/exercises/neural-error-correction";
import * as generic from "../../lib/storage/exerciseStorage";
import type { ExerciseSnapshot } from "../../types/exercise-session";
export const EXERCISE_STORAGE_KEY = generic.exerciseStorageKey(definition);
export const serializeExercise = (snapshot: ExerciseSnapshot) => generic.serializeExercise(definition, snapshot);
export const deserializeExercise = (value: unknown) => generic.deserializeExercise(definition, value);
export const loadExerciseState = (storage?: Pick<Storage, "getItem">) => generic.loadExerciseState(definition, storage);
export const saveExerciseState = (snapshot: ExerciseSnapshot, storage?: Pick<Storage, "setItem">) => generic.saveExerciseState(definition, snapshot, storage);
export const clearExerciseState = (storage?: Pick<Storage, "removeItem">) => generic.clearExerciseState(definition, storage);
