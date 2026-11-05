"use client";
import { useEffect, useMemo, useRef } from "react";
import { ExerciseLab } from "@/components/storage/ExerciseLab";
import { VolatileExerciseRepository } from "@/lib/storage/VolatileExerciseRepository";
import type { ExerciseDefinition } from "@/types/exercise";

/** Fresh repository for every entry. Unmounting discards all simulated answers. */
export function ExercisePreview({ definition, test, onExit }: { definition: ExerciseDefinition; test: boolean; onExit: () => void }) {
  const repository = useMemo(() => new VolatileExerciseRepository(), []);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); return () => repository.discard(); }, [repository]);
  return <div className="studio-student-view">
    <header className="studio-preview-banner"><div><h1 ref={heading} tabIndex={-1}>{test ? "Teste do exercício" : "Visualização como aluno"}</h1><p>Simulação temporária. Ao sair, as respostas serão descartadas.</p></div><button className="studio-secondary" onClick={onExit}>{test ? "Sair do teste" : "Voltar ao editor"}</button></header>
    <ExerciseLab definition={definition} repository={repository} />
  </div>;
}
