import type { StudioExercise } from "../../types/course";
import { buildDefinition } from "../studio/exerciseDraft";

export function isValidStudioExercise(entry: StudioExercise): boolean {
  try {
    const definition = buildDefinition(entry.draft);
    return !!entry.id && entry.id === definition.id && entry.id === entry.definition.id && definition.version === entry.definition.version;
  } catch { return false; }
}
/** Local course revisions must change even for two mutations in one millisecond. */
export function nextCourseTimestamp(previous?: string) {
  const before = previous ? Date.parse(previous) : NaN;
  return new Date(Math.max(Date.now(),Number.isFinite(before) ? before + 1 : 0)).toISOString();
}
