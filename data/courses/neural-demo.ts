import type { ActivityDraft, CourseDraft } from "@/types/course";
import { neuralExerciseDefinition } from "@/data/exercises/neural-error-correction";

export const demoExercises = { [neuralExerciseDefinition.id]: neuralExerciseDefinition };
// Additional demonstration media/practices are optional; original required IDs
// retain their completion policy. Each practice has its own attempt identity.
const applicationVideo = (chapter: string, order: number): ActivityDraft => ({
  id: `${chapter}-application-video`, title: "Video Aplicação", order, required: false,
  type: "video", navigationGroup: "video-application", content: { url: `https://example.com/${chapter}/aplicacao` },
});
const lessonVideo = (chapter: string): ActivityDraft => ({
  id: `${chapter}-lesson-video`, title: "Video Aula", order: 1, required: false,
  type: "video", navigationGroup: "video-lesson", content: { url: `https://example.com/${chapter}/aula` },
});
export const demoCourse: CourseDraft = {
  id: "neural-demo", title: "Redes Neurais Aplicadas à Engenharia",
  description: "Do conceito ao processo industrial: pratique o aprendizado por correção de erro em um laboratório interativo.",
  objective: "Relacionar dados de processo, previsão e ajuste dos pesos de um neurônio.", workload: 8,
  image: { kind: "placeholder", label: "Engenharia e aprendizado aplicado" },
  service: "standalone-course", status: "draft", updatedAt: "2026-10-23T12:00:00.000Z",
  chapters: [
    { id: "fundamentos", title: "Fundamentos", order: 1, description: "Conheça o caminho antes de começar a prática.", completionPolicy: "all-required-activities", activities: [
      { id: "intro-video", title: "Boas-vindas à engenharia aplicada", order: 1, required: true, type: "video", navigationGroup: "video-lesson", content: { url: "https://example.com/introducao", durationMinutes: 5 } },
      applicationVideo("intro", 2),
      ...Array.from({ length: 6 }, (_, index): ActivityDraft => ({
        id: `fundamentos-lab-${index + 1}`, title: `Lab ${index + 1}`, order: index + 3, required: false,
        type: "spreadsheet-exercise", navigationGroup: "laboratory", content: { exerciseId: neuralExerciseDefinition.id },
      })),
      { id: "intro-text", title: "Como um neurônio aprende", order: 9, required: true, type: "text", content: { text: "Um neurônio combina entradas e pesos para produzir uma previsão. A diferença entre a saída real e a prevista orienta a correção dos pesos.\nNeste curso, você investigará esse processo usando dados normalizados de uma linha industrial." } },
      { id: "intro-material", title: "Roteiro de estudo", order: 10, required: false, type: "material", content: { text: "Anote suas hipóteses sobre o erro e a taxa de aprendizado. Este material é complementar.", url: "https://example.com/roteiro", fileName: "roteiro-de-estudo.pdf" } },
    ] },
    { id: "correcao", title: "Correção de Erro", order: 2, description: "Experimente, verifique e interprete seus resultados.", completionPolicy: "all-required-activities", activities: [
      lessonVideo("correcao"), applicationVideo("correcao", 2),
      { id: "neural-lab", title: "Laboratório de correção de erro", order: 3, required: true, type: "spreadsheet-exercise", navigationGroup: "laboratory", content: { exerciseId: neuralExerciseDefinition.id } },
      { id: "lab-context", title: "Desafio do processo industrial", order: 4, required: true, type: "text", content: { text: "Uma linha de chapas de aço precisa prever o desvio de espessura. Use velocidade e temperatura normalizadas para treinar o neurônio. Preencha as respostas no Lab e utilize Verificar respostas." } },
    ] },
    { id: "aplicacao", title: "Aplicação Industrial", order: 3, description: "Conecte o aprendizado às decisões de engenharia.", completionPolicy: "all-required-activities", activities: [
      lessonVideo("aplicacao"), applicationVideo("aplicacao", 2),
      { id: "industrial-text", title: "Do resultado à decisão", order: 3, required: true, type: "text", content: { text: "Compare as curvas de saída real e prevista. Observe o erro absoluto e reflita sobre a estabilidade do treinamento antes de recomendar uma mudança no processo." } },
      { id: "reflection", title: "Reflexão final", order: 4, required: true, type: "assessment", content: { description: "Explique para si como a taxa de aprendizado afeta a atualização dos pesos. Esta reflexão demonstrativa tem conclusão manual, sem prova automática." } },
    ] },
  ],
};
