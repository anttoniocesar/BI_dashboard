import { LocalExerciseLab } from "@/components/storage/LocalExerciseLab";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { neuralExerciseDefinition } from "@/data/exercises/neural-error-correction";
import { DemoLabExit } from "@/components/navigation/DemoLabExit";

export default function Home() {
  return (
    <main className="lab-shell">
      <header className="lab-header">
        <BrandLogo environment="Lab" />
        <span className="lab-label">AMBIENTE DE EXPERIMENTAÇÃO</span>
        <DemoLabExit />
      </header>
      <section className="workspace" aria-labelledby="lab-title">
        <LocalExerciseLab definition={neuralExerciseDefinition} />
        <footer className="workspace-footer"><span>BI.Society Lab · {neuralExerciseDefinition.ui?.documentLabel}</span><span>Explore os dados. Construa conhecimento.</span></footer>
      </section>
    </main>
  );
}
