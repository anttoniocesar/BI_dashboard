import { test, expect } from "@playwright/test";
import { chapterNavigation, navigationGroupIssue } from "../lib/learn/chapter-navigation";
import { chapterNavigationDemo } from "../data/courses/chapter-navigation-demo";
import { demoCourse } from "../data/courses/neural-demo";
import { courseProgress, initialProgress } from "../lib/learn/progress";

test("Navegação: configuração define A/B/C independente da posição física e sem mutação", () => {
  const original = structuredClone(chapterNavigationDemo.chapters[0].activities);
  const shuffled = [...original].reverse().map((activity, index) => ({ ...activity, order: index + 1 }));
  const snapshot = structuredClone(shuffled);
  const result = chapterNavigation(shuffled);
  expect(result.map(item => item.prefix)).toEqual(["A", "B", "C.1", "C.2", "C.3", "C.4", "C.5", "C.6"]);
  expect(result[0].activity.navigationGroup).toBe("video-lesson");
  expect(result[1].activity.navigationGroup).toBe("video-application");
  expect(result[2].activity.id).toBe("navigation-lab-6");
  expect(shuffled).toEqual(snapshot);
});

test("Navegação: zero, um e mais de seis Labs sem criar atividades ausentes", () => {
  const base = chapterNavigationDemo.chapters[0].activities;
  for (const count of [0, 1, 6, 9]) {
    const labs = Array.from({ length: count }, (_, index) => ({ ...base[2], id: `lab-${index}`, title: `Prática ${index + 1}`, order: index + 3 }));
    const result = chapterNavigation([...base.slice(0, 2), ...labs]);
    expect(result).toHaveLength(count + 2);
    expect(result.filter(item => item.group === "laboratory").map(item => item.prefix)).toEqual(labs.map((_, index) => `C.${index + 1}`));
    expect(result.at(-1)?.label).toBe(count ? `Prática ${count}` : "Video Aplicação");
  }
});

test("Navegação: legado, conteúdo complementar e metadata inválida nunca descartam atividade", () => {
  const legacy = ["intro-video", "intro-text", "intro-material"].map(id => {
    const activity = structuredClone(demoCourse.chapters[0].activities.find(item => item.id === id)!);
    delete activity.navigationGroup; return activity;
  });
  expect(chapterNavigation(legacy).map(item => item.prefix)).toEqual(["A", "B", "C"]);
  const mixed = [...chapterNavigationDemo.chapters[0].activities, ...legacy];
  expect(new Set(chapterNavigation(mixed).map(item => item.activity.id)).size).toBe(mixed.length);
  expect(navigationGroupIssue({ ...legacy[1], navigationGroup: "laboratory" })).toContain("incompatível");
  expect(navigationGroupIssue(chapterNavigationDemo.chapters[0].activities[2])).toBeNull();
  const invalid = { ...legacy[1], navigationGroup: "laboratory" as const };
  expect(chapterNavigation([invalid])[0].activity).toBe(invalid);
});

test("Navegação: agrupamento não modifica denominador, obrigatoriedade nem regras de progresso", () => {
  const before = courseProgress(chapterNavigationDemo, initialProgress(chapterNavigationDemo.id));
  const course = structuredClone(chapterNavigationDemo);
  course.chapters[0].activities = chapterNavigation(course.chapters[0].activities).map(item => item.activity);
  expect(courseProgress(course, initialProgress(course.id))).toEqual(before);
  expect(course.chapters[0].activities.filter(item => item.required)).toHaveLength(8);
});

test("Neural principal: padrão configurado, seis Labs independentes e obrigatórias originais preservadas", () => {
  const items = chapterNavigation(demoCourse.chapters[0].activities);
  expect(items.map(item => item.prefix)).toEqual(["A", "B", "C.1", "C.2", "C.3", "C.4", "C.5", "C.6", "D", "E"]);
  const labs = items.filter(item => item.group === "laboratory");
  expect(labs.map(item => item.activity.title)).toEqual(["Lab 1", "Lab 2", "Lab 3", "Lab 4", "Lab 5", "Lab 6"]);
  const activities = demoCourse.chapters.flatMap(chapter => chapter.activities);
  expect(new Set(activities.map(item => item.id)).size).toBe(activities.length);
  expect(activities.filter(item => item.required).map(item => item.id).sort()).toEqual([
    "intro-video", "intro-text", "lab-context", "neural-lab", "industrial-text", "reflection",
  ].sort());
  for (const chapter of demoCourse.chapters) {
    const navigation = chapterNavigation(chapter.activities);
    expect(navigation.slice(0, 2).map(item => item.group)).toEqual(["video-lesson", "video-application"]);
    for (const activity of chapter.activities.filter(item => item.type === "spreadsheet-exercise")) {
      expect(activity.navigationGroup).toBe("laboratory");
      expect(Object.keys(activity.content)).toEqual(["exerciseId"]);
    }
  }
  expect(courseProgress(demoCourse, initialProgress(demoCourse.id))).toMatchObject({ completedCount: 0, requiredCount: 6 });
});
