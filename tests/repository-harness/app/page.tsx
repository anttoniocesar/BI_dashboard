"use client";

import { useEffect, useState } from "react";
import { ExerciseLab } from "../../../components/storage/ExerciseLab";
import { neuralExerciseDefinition } from "../../../data/exercises/neural-error-correction";
import { simpleSumDefinition } from "../../fixtures/simple-sum";
import { MemoryExerciseRepository } from "../../fixtures/MemoryExerciseRepository";
import type { ExerciseSession } from "../../../types/exercise-session";
import type { ExerciseDefinition } from "../../../types/exercise";

declare global {
  interface Window {
    repositoryOptions?: { sum?: boolean; seed?: ExerciseSession; loadDelay?: number; loadFail?: boolean; importedDefinition?: ExerciseDefinition };
    testRepository: MemoryExerciseRepository;
    remountLab: () => void;
  }
}

/** Isolated test application, never a route in the student application. */
export default function Harness() {
  const [setup, setSetup] = useState<{ repository: MemoryExerciseRepository; definition: ExerciseDefinition }>();
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    const options = window.repositoryOptions ?? {};
    const definition = options.importedDefinition ?? (options.sum ? simpleSumDefinition : neuralExerciseDefinition);
    const repository = new MemoryExerciseRepository();
    if (options.seed) repository.seed({ exerciseId: definition.id, exerciseVersion: definition.version }, options.seed);
    repository.behavior.load = { delay: options.loadDelay, fail: options.loadFail };
    window.testRepository = repository;
    window.remountLab = () => setGeneration(value => value + 1);
    setSetup({ repository, definition });
  }, []);
  return setup ? <ExerciseLab key={generation} definition={setup.definition} repository={setup.repository} /> : null;
}
