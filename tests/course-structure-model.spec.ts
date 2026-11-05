import { test, expect } from "@playwright/test";
import { createCourse, createChapter, moveOrdered, ordered, upsertActivity, validateCourseDraft } from "../lib/studio/courseDraft";
import { createDraft, buildDefinition } from "../lib/studio/exerciseDraft";
import { simpleSumDefinition } from "./fixtures/simple-sum";
import type { ActivityDraft, ExerciseLibrary } from "../types/course";

const details = { title: "Engenharia aplicada", description: "Descrição", objective: "Aplicar conceitos", workload: 8, image: { kind: "placeholder" as const, label: "Capa" } };
function library(): ExerciseLibrary {
  const draft = createDraft(simpleSumDefinition);
  return { [draft.id]: { id: draft.id, draft, definition: buildDefinition(draft), updatedAt: new Date().toISOString() } };
}

test("Curso: criação independente, identidades estáveis, serviço avulso e rascunho incompleto validável", () => {
  const first = createCourse(details), second = createCourse(details);
  expect(first.id).not.toBe(second.id); expect(first.status).toBe("draft"); expect(first.service).toBe("standalone-course");
  expect(validateCourseDraft(first, {})).toEqual(["O curso precisa de pelo menos um capítulo."]);
  expect(first.image).not.toBe(details.image); expect(first.updatedAt).toMatch(/^\d{4}-/);
  const chapter = createChapter("Fundamentos");
  expect(chapter.completionPolicy).toBe("all-required-activities");
  first.chapters = [chapter]; expect(validateCourseDraft(first, {})).toEqual([]);
  expect("chapters" in simpleSumDefinition).toBe(false);
});

test("Curso: ordenar/remover normaliza posições sem mutação ou identidade baseada em índice", () => {
  const chapters = ordered([createChapter("Um"), createChapter("Dois"), createChapter("Três")]);
  const moved = moveOrdered(chapters, chapters[2].id, -1);
  expect(moved.map(item => item.title)).toEqual(["Um", "Três", "Dois"]);
  expect(moved.map(item => item.order)).toEqual([1, 2, 3]);
  expect(moved[1].id).toBe(chapters[2].id); expect(chapters[1].title).toBe("Dois");
  expect(moveOrdered(chapters, chapters[0].id, -1)).toBe(chapters);
  const remaining = ordered(moved.filter(item => item.id !== chapters[0].id));
  expect(remaining.map(item => item.order)).toEqual([1, 2]); expect(remaining[0].id).toBe(chapters[2].id);
});

test("Curso: atividades tipadas, edição, reordenação e exclusão independentes dos capítulos", () => {
  const chapter = createChapter("Atividades");
  const video: ActivityDraft = { id: "video", title: "Aula", type: "video", order: 1, required: true, content: { url: "https://example.com/aula", durationMinutes: 12 } };
  const text: ActivityDraft = { id: "text", title: "Introdução", type: "text", order: 2, required: false, content: { text: "Texto", url: "https://example.com/texto", fileName: "apoio.pdf" } };
  const material: ActivityDraft = { id: "material", title: "Material", type: "material", order: 3, required: true, content: { text: "Apoio", fileName: "apoio.pdf" } };
  const assessment: ActivityDraft = { id: "assessment", title: "Avaliação", type: "assessment", order: 4, required: true, content: { description: "Estrutura inicial" } };
  let next = chapter;
  for (const activity of [video, text, material, assessment]) next = upsertActivity(next, activity);
  expect(chapter.activities).toEqual([]); expect(next.activities.map(item => item.order)).toEqual([1, 2, 3, 4]);
  next = upsertActivity(next, { ...video, title: "Aula atualizada" });
  expect(next.activities).toHaveLength(4); expect(next.activities[0].id).toBe("video");
  next.activities = moveOrdered(next.activities, "text", -1);
  expect(next.activities[0].id).toBe("text"); expect(next.activities[0].required).toBe(false);
  next.activities = ordered(next.activities.filter(item => item.id !== "assessment"));
  expect(next.activities).toHaveLength(3);
  const course = createCourse(details); course.chapters = [next]; expect(validateCourseDraft(course, {})).toEqual([]);
});

test("Curso: Lab referencia uma definição canônica e acompanha alterações salvas na biblioteca", () => {
  const exercises = library(), course = createCourse(details);
  const activity: ActivityDraft = { id: "lab", title: "Soma", type: "spreadsheet-exercise", required: true, order: 1, content: { exerciseId: simpleSumDefinition.id } };
  course.chapters = [upsertActivity(createChapter("Lab"), activity)];
  expect(validateCourseDraft(course, exercises)).toEqual([]);
  expect(Object.keys(course.chapters[0].activities[0].content)).toEqual(["exerciseId"]);
  const copy = structuredClone(exercises[simpleSumDefinition.id].draft); copy.workbook.worksheets[0].cells.A1 = "50";
  exercises[copy.id] = { ...exercises[copy.id], draft: copy, definition: buildDefinition(copy) };
  expect(exercises[(activity.content).exerciseId].definition.workbook.worksheets[0].cells.A1).toBe("50");
  expect(course.chapters[0].activities[0].content).toEqual({ exerciseId: simpleSumDefinition.id });
  expect(simpleSumDefinition.workbook.worksheets[0].cells.A1).toBe("10");
  expect(validateCourseDraft(course, {})).toContain("Soma: selecione um exercício disponível nesta sessão.");
});

test("Curso: valida título, tipo, URL inerte, obrigatoriedade, identidades e definição Lab inválida", () => {
  const course = createCourse({ ...details, title: "", workload: -1 });
  const chapter = createChapter("");
  chapter.activities = [{ id: chapter.id, title: "", type: "unknown", order: 1, required: true, content: {} } as unknown as ActivityDraft];
  course.chapters = [chapter]; const issues = validateCourseDraft(course, {});
  expect(issues.some(issue => issue.includes("título"))).toBe(true);
  expect(issues.some(issue => issue.includes("tipo de atividade"))).toBe(true);
  expect(issues.some(issue => issue.includes("duplicada"))).toBe(true);
  chapter.activities = [{ id: "video", title: "Vídeo inválido", type: "video", order: 1, required: true, content: { url: "javascript:alert(1)", durationMinutes: -1 } }];
  expect(validateCourseDraft(course, {}).some(issue => issue.includes("HTTP/HTTPS"))).toBe(true);
  const exercises = library(); exercises[simpleSumDefinition.id].definition = { ...simpleSumDefinition, title: "" };
  chapter.activities = [{ id: "lab", title: "Lab", type: "spreadsheet-exercise", order: 1, required: true, content: { exerciseId: simpleSumDefinition.id } }];
  expect(validateCourseDraft(course, exercises)).toContain("Lab: definição de exercício inválida.");
});
