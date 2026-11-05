import { test, expect } from "@playwright/test";
import { demoCourse } from "../data/courses/neural-demo";
import { completeActivity, courseProgress, initialProgress } from "../lib/learn/progress";
import { compatibleVideoUrl, safeWebUrl } from "../lib/learn/content";
import { neuralExerciseDefinition } from "../data/exercises/neural-error-correction";
import { createDraft, buildDefinition } from "../lib/studio/exerciseDraft";
import { validateExerciseDefinition } from "../lib/exercises/definition";

test("Aprendizado: sequência, obrigatórias, opcionais, conclusão e imutabilidade", () => {
  let progress = initialProgress(demoCourse.id);
  const original = structuredClone(progress);
  expect(courseProgress(demoCourse, progress).chapters.map(chapter => chapter.available)).toEqual([true, false, false]);
  expect(completeActivity(demoCourse, progress, "correcao", "neural-lab")).toBe(progress);
  progress = completeActivity(demoCourse, progress, "fundamentos", "intro-video");
  expect(courseProgress(demoCourse, progress).chapters[0]).toMatchObject({ completedCount: 1, percent: 50, completed: false });
  progress = completeActivity(demoCourse, progress, "fundamentos", "intro-text");
  expect(courseProgress(demoCourse, progress).chapters[1].available).toBe(true);
  expect(progress.completedActivities).not.toContain("intro-material");
  expect(completeActivity(demoCourse, progress, "fundamentos", "intro-text")).toBe(progress);
  for (const [chapter, activity] of [["correcao", "lab-context"], ["correcao", "neural-lab"], ["aplicacao", "industrial-text"], ["aplicacao", "reflection"]]) progress = completeActivity(demoCourse, progress, chapter, activity);
  expect(courseProgress(demoCourse, progress)).toMatchObject({ completed: true, percent: 100, completedCount: 6, requiredCount: 6, completedChapters: ["fundamentos", "correcao", "aplicacao"] });
  expect(original).toEqual(initialProgress(demoCourse.id));
});

test("Aprendizado: política livre, ordem explícita e progresso de outro curso isolado", () => {
  const shuffled = { ...demoCourse, chapters: [...demoCourse.chapters].reverse() };
  const progress = { ...initialProgress("other"), completedActivities: ["intro-text", "intro-video"] };
  expect(courseProgress(shuffled, progress).chapters.map(chapter => chapter.id)).toEqual(["fundamentos", "correcao", "aplicacao"]);
  expect(courseProgress(shuffled, progress).completedCount).toBe(0);
  expect(courseProgress(shuffled, initialProgress(shuffled.id), { sequentialChapters: false }).chapters.every(chapter => chapter.available)).toBe(true);
});

test("Aprendizado: estados vazios, atividade inexistente e capítulos apenas opcionais", () => {
  const progress = initialProgress(demoCourse.id);
  expect(courseProgress({ ...demoCourse, chapters: [] }, progress)).toMatchObject({ completed: false, percent: 0 });
  const empty = { ...demoCourse, chapters: [{ ...demoCourse.chapters[0], activities: [] }] };
  expect(courseProgress(empty, progress).chapters[0]).toMatchObject({ completed: false, percent: 0 });
  expect(completeActivity(empty, progress, "fundamentos", "absent")).toBe(progress);
  const optional = { ...demoCourse, chapters: [{ ...demoCourse.chapters[0], activities: [demoCourse.chapters[0].activities[2]] }] };
  expect(courseProgress(optional, progress)).toMatchObject({ completed: true, percent: 100 });
});

test("Aprendizado: URLs e vídeo não aceitam execução arbitrária", () => {
  for (const url of ["javascript:alert(1)", "data:text/html,example", "file:///test", "//example.com", "https://user:password@example.com"]) {
    expect(safeWebUrl(url)).toBeNull(); expect(compatibleVideoUrl(url)).toBeNull();
  }
  expect(safeWebUrl("https://example.com/material")).toBe("https://example.com/material");
  expect(compatibleVideoUrl("https://example.com/a.mp4?q=1")).toBe("https://example.com/a.mp4?q=1");
  for (const url of ["http://example.com/a.mp4", "https://example.com/watch", "https://example.com/a.mp4.html"]) expect(compatibleVideoUrl(url)).toBeNull();
});

test("Aprendizado: definição do aluno esvazia solução de autoria e preserva mestre/gráficos", () => {
  const draft = createDraft(neuralExerciseDefinition);
  draft.workbook.worksheets.find(sheet => sheet.id === "treinamento")!.cells.F2 = "=12345";
  const definition = buildDefinition(draft, true);
  expect(() => validateExerciseDefinition(definition)).not.toThrow();
  expect(definition.workbook.worksheets.find(sheet => sheet.id === "treinamento")!.cells.F2).toBeUndefined();
  expect(draft.workbook.worksheets.find(sheet => sheet.id === "treinamento")!.cells.F2).toBe("=12345");
  expect(definition.charts).toEqual(neuralExerciseDefinition.charts);
});
