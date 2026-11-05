import type { ActivityDraft, CourseDraft } from "@/types/course";
import { demoCourse } from "./neural-demo";
import { neuralExerciseDefinition } from "@/data/exercises/neural-error-correction";

/** Independent demonstration: original neural course and its criteria stay intact. */
const activities: ActivityDraft[] = [
  { id: "navigation-lesson", title: "Video Aula", type: "video", navigationGroup: "video-lesson", order: 1, required: true,
    content: { url: "https://example.com/aula", durationMinutes: 5 } },
  { id: "navigation-application", title: "Video Aplicação", type: "video", navigationGroup: "video-application", order: 2, required: true,
    content: { url: "https://example.com/aplicacao", durationMinutes: 5 } },
  ...Array.from({ length: 6 }, (_, index): ActivityDraft => ({
    id: `navigation-lab-${index + 1}`, title: `Lab ${index + 1}`, order: index + 3, required: true,
    type: "spreadsheet-exercise", navigationGroup: "laboratory", content: { exerciseId: neuralExerciseDefinition.id },
  })),
];
export const chapterNavigationDemo: CourseDraft = {
  ...demoCourse, id: "chapter-navigation-demo", title: "Navegação de capítulo — demonstração A/B/C",
  description: "Demonstração da navegação com dois vídeos e seis atividades de laboratório independentes.",
  chapters: [{ id: "fundamentos", title: "Fundamentos", order: 1, description: "Aula, aplicação e prática no mesmo Lab.",
    completionPolicy: "all-required-activities", activities }],
};
