import { test, expect } from "@playwright/test";
import { createAdminFixtures } from "../data/admin/demo";
import { applyCourseOperation } from "../lib/courses/authoring";
import { ExerciseInUseError } from "../lib/courses/exerciseDeletion";
import { exerciseKey } from "../lib/repositories/CourseRepository";
import { LocalCourseRepository, COURSE_STORAGE_KEY } from "../lib/repositories/InMemoryCourseRepository";

import { deletionWorkspace } from "./fixtures/exercise-deletion";
const state = createAdminFixtures(), teacher = state.users.find(u => u.id === "teacher-neural")!;
const operation = {operation:"delete-exercise" as const,id:"lab-2",version:"0.1-draft"};

test("Excluir exercício: ID estável, nomes iguais, outros dados intactos e versão removida",() => {
  const before = deletionWorkspace(), next = applyCourseOperation(before,operation,teacher,state);
  expect(next.exercises.map(e => e.id)).toEqual(["lab-1","duplicate"]);
  expect(next.courses).toEqual(before.courses);
  expect(next.definitions[exerciseKey(operation.id,operation.version)]).toBeUndefined();
  expect(next.definitions[exerciseKey("duplicate",operation.version)]).toEqual(before.definitions[exerciseKey("duplicate",operation.version)]);
  expect(before.exercises).toHaveLength(3);
});
for (const status of ["draft","published","archived"] as const) test(`Excluir exercício: bloqueio no domínio para curso ${status}`,() => {
  const workspace = deletionWorkspace(); workspace.courses[0].status = status;
  try { applyCourseOperation(workspace,{...operation,id:"lab-1"},teacher,state); throw new Error("Exclusão indevida"); }
  catch (cause) {
    expect(cause).toBeInstanceOf(ExerciseInUseError);
    expect((cause as ExerciseInUseError).usages[0]).toMatchObject({course:"Curso Teste Completo",chapter:"Capítulo 1 — Introdução",activity:"Lab"});
  }
  expect(workspace.exercises).toHaveLength(3);
});
test("Excluir exercício: referência legada sem versão bloqueia; outra versão fica intacta",() => {
  let workspace = deletionWorkspace();
  const entry = structuredClone(workspace.exercises[0]); entry.draft.version = "0.2-draft";
  workspace = applyCourseOperation(workspace,{operation:"save-exercise",exercise:entry},teacher,state);
  const next = applyCourseOperation(workspace,{...operation,id:"lab-1",version:"0.2-draft"},teacher,state);
  expect(next.exercises.find(e => e.id === "lab-1")?.definition.version).toBe("0.1-draft");
  const activity = workspace.courses[0].chapters[0].activities[0];
  if (activity.type === "spreadsheet-exercise") delete activity.content.exerciseVersion;
  expect(() => applyCourseOperation(workspace,{...operation,id:"lab-1",version:"0.2-draft"},teacher,state)).toThrow(ExerciseInUseError);
});
test("Excluir exercício: somente proprietário, identidade inexistente e alunos recusados",() => {
  const workspace = deletionWorkspace();
  expect(() => applyCourseOperation(workspace,operation,{...teacher,id:"other"},state)).toThrow("não autorizado");
  expect(() => applyCourseOperation(workspace,{...operation,id:"missing"},teacher,state)).toThrow("não encontrado");
  expect(() => applyCourseOperation(workspace,operation,state.users.find(u => u.id === "student-cesar")!,state)).toThrow("professores");
});
test("Excluir exercício: persistência em novo repositório e falha de storage sem remoção em memória",async () => {
  const values = new Map([[COURSE_STORAGE_KEY,JSON.stringify(deletionWorkspace())],["unrelated","preservado"]]);
  const storage = {getItem:(key:string) => values.get(key) ?? null,setItem:(key:string,value:string) => {values.set(key,value);}};
  const failing = new LocalCourseRepository(teacher,state,{...storage,setItem:() => {throw new Error("quota");}});
  await expect(failing.execute(operation)).rejects.toThrow("quota"); expect((await failing.load()).exercises).toHaveLength(3);
  await new LocalCourseRepository(teacher,state,storage).execute(operation);
  expect((await new LocalCourseRepository(teacher,state,storage).load()).exercises.map(e => e.id)).toEqual(["lab-1","duplicate"]);
  expect(values.get("unrelated")).toBe("preservado");
});
test("Excluir exercício: repositório relê vínculo salvo por outra instância",async () => {
  const values = new Map([[COURSE_STORAGE_KEY,JSON.stringify(deletionWorkspace())]]);
  const storage = {getItem:(key:string) => values.get(key) ?? null,setItem:(key:string,value:string) => {values.set(key,value);}};
  const stale = new LocalCourseRepository(teacher,state,storage), other = new LocalCourseRepository(teacher,state,storage);
  const course = (await other.load()).courses[0];
  course.chapters[0].activities.push({id:"new",title:"Novo vínculo",type:"spreadsheet-exercise",order:2,required:false,content:{exerciseId:operation.id,exerciseVersion:operation.version}});
  await other.execute({operation:"save-course",course});
  await expect(stale.execute(operation)).rejects.toThrow(ExerciseInUseError);
});
