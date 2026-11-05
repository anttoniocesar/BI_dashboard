"use client";

import { useMemo } from "react";
import { LocalStorageExerciseRepository } from "@/lib/storage/LocalStorageExerciseRepository";
import type { ExerciseDefinition } from "@/types/exercise";
import { ExerciseLab } from "./ExerciseLab";

/** Browser composition boundary; class instances cannot cross the Server Component boundary. */
export function LocalExerciseLab({ definition }: { definition: ExerciseDefinition }) {
  const repository = useMemo(() => new LocalStorageExerciseRepository(definition), [definition]);
  return <ExerciseLab definition={definition} repository={repository} />;
}
