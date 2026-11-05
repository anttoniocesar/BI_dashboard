import { record, exactKeys, text } from "../data/validation";
import { DataError } from "../data/http";
import { courseCatalog } from "../courses/catalog";
import { neuralExerciseDefinition } from "../../data/exercises/neural-error-correction";
import { deserializeExercise, serializeExercise } from "../storage/exerciseSessionCodec";
import type { AttemptIdentity } from "../../types/exercise-attempt";
import type { ExerciseSession } from "../../types/exercise-session";
import type { CourseWorkspace } from "../repositories/CourseRepository";
import { exerciseKey } from "../repositories/CourseRepository";
export const ATTEMPT_BYTES = 262144;
export function parseAttempt(value: unknown, workspace?: CourseWorkspace) {
  const input = record(value);
  if (!["load", "save", "clear"].includes(String(input.operation))) throw new DataError("Operação inválida.");
  exactKeys(input, input.operation === "save" ? ["operation", "identity", "state"] : ["operation", "identity"]);
  const rawIdentity = record(input.identity);
  exactKeys(rawIdentity, ["courseId", "chapterId", "activityId", "exerciseId", "exerciseVersion"]);
  const identity = Object.fromEntries(Object.entries(rawIdentity).map(([key, value]) => [key, text(value)])) as AttemptIdentity;
  const course = (workspace?.courses ?? courseCatalog([])).find(course => course.id === identity.courseId && course.status === "published");
  const activity = course?.chapters.find(chapter => chapter.id === identity.chapterId)?.activities.find(activity => activity.id === identity.activityId);
  const definition = workspace ? workspace.definitions[exerciseKey(identity.exerciseId,identity.exerciseVersion)] : neuralExerciseDefinition;
  if (!definition || !activity || activity.type !== "spreadsheet-exercise" || activity.content.exerciseId !== identity.exerciseId || (activity.content.exerciseVersion && activity.content.exerciseVersion !== identity.exerciseVersion) || definition.id !== identity.exerciseId || definition.version !== identity.exerciseVersion) throw new DataError("Atividade ou versão do exercício indisponível.", 404);
  let state: ExerciseSession | undefined;
  if (input.operation === "save") {
    const raw = record(input.state);
    exactKeys(raw, ["version", "exerciseId", "exerciseVersion", "cells", "activeSheet", "selections", "validation", "lastSavedAt"]);
    if (!Array.isArray(raw.cells) || raw.cells.length > 2000) throw new DataError("Estado da tentativa inválido.");
    for (const cell of raw.cells) {
      const entry = record(cell); exactKeys(entry, ["worksheetId", "address", "raw"]);
      if (typeof entry.raw !== "string" || entry.raw.length > 16384) throw new DataError("Conteúdo de célula inválido.");
    }
    for (const selection of Object.values(record(raw.selections))) exactKeys(record(selection), ["row", "column"]);
    const restored = deserializeExercise(definition, raw);
    if (!restored || raw.exerciseId !== identity.exerciseId || raw.exerciseVersion !== identity.exerciseVersion) throw new DataError("Estado da tentativa inválido.");
    state = serializeExercise(definition, restored);
  }
  return { operation: input.operation as "load" | "save" | "clear", identity, state };
}
