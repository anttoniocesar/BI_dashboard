"use client";

import { useEffect } from "react";
import type { ExerciseSnapshot, SaveState } from "@/types/exercise-session";
import type { ExercisePersistenceController } from "@/lib/storage/ExercisePersistenceController";

export { AUTOSAVE_DELAY } from "@/lib/storage/ExercisePersistenceController";
export function useExerciseAutosave(controller: ExercisePersistenceController | undefined, snapshot: ExerciseSnapshot, onStatus: (state: SaveState) => void) {
  useEffect(() => controller?.subscribe(onStatus), [controller, onStatus]);
  useEffect(() => { controller?.update(snapshot); }, [controller, snapshot]);
  useEffect(() => {
    if (!controller) return;
    const flush = () => controller.flushOnExit();
    const hidden = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [controller]);
}
