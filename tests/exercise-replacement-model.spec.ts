import { test, expect } from "@playwright/test";
import { createAdminFixtures } from "../data/admin/demo";
import { deletionWorkspace } from "./fixtures/exercise-deletion";
import { applyCourseOperation } from "../lib/courses/authoring";
import { exerciseUsages, ExerciseInUseError } from "../lib/courses/exerciseDeletion";
import { LocalCourseRepository, COURSE_STORAGE_KEY } from "../lib/repositories/InMemoryCourseRepository";
import type { CourseWorkspace, ReplaceActivityExercise } from "../lib/repositories/CourseRepository";

const state=createAdminFixtures(),teacher=state.users.find(u=>u.id==="teacher-neural")!;
export const replacementOperation=(workspace:CourseWorkspace):ReplaceActivityExercise=>({operation:"replace-activity-exercise",id:workspace.courses[0].id,chapterId:workspace.courses[0].chapters[0].id,activityId:"lab",previousExerciseId:"lab-1",previousExerciseVersion:"0.1-draft",nextExerciseId:"lab-2",nextExerciseVersion:"0.1-draft",expectedUpdatedAt:workspace.courses[0].updatedAt});

test("Substituir: troca atômica, mantém atividade/metadados e integra proteção de exclusão",()=>{
  const before=deletionWorkspace(),operation=replacementOperation(before),next=applyCourseOperation(before,operation,teacher,state);
  expect(before.courses[0].chapters[0].activities[0].content).toEqual({exerciseId:"lab-1",exerciseVersion:"0.1-draft"});
  expect(next.courses[0].chapters[0].activities[0]).toEqual({...before.courses[0].chapters[0].activities[0],content:{exerciseId:"lab-2",exerciseVersion:"0.1-draft"}});
  expect(next.exercises).toEqual(before.exercises);expect(next.definitions).toEqual(before.definitions);
  expect(exerciseUsages(next.courses,"lab-1","0.1-draft")).toEqual([]);
  expect(()=>applyCourseOperation(next,{operation:"delete-exercise",id:"lab-1",version:"0.1-draft"},teacher,state)).not.toThrow();
  expect(()=>applyCourseOperation(next,{operation:"delete-exercise",id:"lab-2",version:"0.1-draft"},teacher,state)).toThrow(ExerciseInUseError);
});
test("Substituir: mantém proteção do antigo quando há outro vínculo",()=>{
  const before=deletionWorkspace();before.courses[0].chapters[0].activities.push({...structuredClone(before.courses[0].chapters[0].activities[0]),id:"other",order:2});
  const next=applyCourseOperation(before,replacementOperation(before),teacher,state);
  expect(exerciseUsages(next.courses,"lab-1","0.1-draft")).toHaveLength(1);
  expect(()=>applyCourseOperation(next,{operation:"delete-exercise",id:"lab-1",version:"0.1-draft"},teacher,state)).toThrow(ExerciseInUseError);
});
for(const status of ["published","archived"] as const)test(`Substituir: curso ${status} preserva histórico e recusa troca`,()=>{
  const before=deletionWorkspace();before.courses[0].status=status;const snapshot=structuredClone(before),access=structuredClone(state);
  expect(()=>applyCourseOperation(before,replacementOperation(before),teacher,state,[before.courses[0].id])).toThrow("preservada");
  expect(before).toEqual(snapshot);expect(state).toEqual(access);
});
test("Substituir: revisão e vínculo anterior recusam alterações concorrentes",()=>{
  const before=deletionWorkspace(),operation=replacementOperation(before);
  const edited=applyCourseOperation(before,{operation:"save-course",course:{...before.courses[0],title:"Alterado em outra aba"}},teacher,state);
  expect(()=>applyCourseOperation(edited,operation,teacher,state)).toThrow("outra aba");
  const replaced=applyCourseOperation(before,operation,teacher,state);
  expect(()=>applyCourseOperation(replaced,{...operation,expectedUpdatedAt:replaced.courses[0].updatedAt},teacher,state)).toThrow("outra aba");
  expect(edited.courses[0].title).toBe("Alterado em outra aba");
});
test("Substituir: versões distintas e nomes iguais usam ID + versão",()=>{
  let before=deletionWorkspace();const entry=structuredClone(before.exercises[0]);entry.draft.version="0.2-draft";
  before=applyCourseOperation(before,{operation:"save-exercise",exercise:entry},teacher,state);
  const next=applyCourseOperation(before,{...replacementOperation(before),nextExerciseId:"lab-1",nextExerciseVersion:"0.2-draft"},teacher,state);
  expect(next.courses[0].chapters[0].activities[0].content).toEqual({exerciseId:"lab-1",exerciseVersion:"0.2-draft"});
  const duplicate=applyCourseOperation(before,{...replacementOperation(before),nextExerciseId:"duplicate"},teacher,state);
  expect(duplicate.courses[0].chapters[0].activities[0].content).toHaveProperty("exerciseId","duplicate");
});
test("Substituir: mesmo exercício, inexistente, inválido e atividade não Lab são recusados",()=>{
  const before=deletionWorkspace(),operation=replacementOperation(before);
  expect(()=>applyCourseOperation(before,{...operation,nextExerciseId:"lab-1"},teacher,state)).toThrow("outro exercício");
  expect(()=>applyCourseOperation(before,{...operation,nextExerciseId:"missing"},teacher,state)).toThrow("inválido");
  const invalid=structuredClone(before);invalid.exercises[1].draft.id="mismatch";
  expect(()=>applyCourseOperation(invalid,operation,teacher,state)).toThrow("inválido");
  before.courses[0].chapters[0].activities[0]={id:"lab",title:"Texto",type:"text",content:{text:"Texto"},required:true,order:1};
  expect(()=>applyCourseOperation(before,operation,teacher,state)).toThrow("Lab não encontrada");
});
test("Substituir: autorização de professor e biblioteca é verificada no domínio",()=>{
  const before=deletionWorkspace(),operation=replacementOperation(before);
  expect(()=>applyCourseOperation(before,operation,{...teacher,id:"other"},state)).toThrow("Curso não autorizado");
  before.exercises[1].createdBy="other";
  expect(()=>applyCourseOperation(before,operation,teacher,state)).toThrow("Exercício não autorizado");
  expect(()=>applyCourseOperation(before,operation,state.users.find(u=>u.id==="student-cesar")!,state)).toThrow("professores");
});
test("Substituir: persistência, falha sem estado parcial e dados de histórico intactos",async()=>{
  const before=deletionWorkspace(),values=new Map([[COURSE_STORAGE_KEY,JSON.stringify(before)],["attempts","respostas anteriores"],["progress","histórico"]]);
  const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);}};
  const failing=new LocalCourseRepository(teacher,state,{...storage,setItem:()=>{throw new Error("quota");}});
  await expect(failing.execute(replacementOperation(before))).rejects.toThrow("quota");expect((await failing.load()).courses).toEqual(before.courses);
  await new LocalCourseRepository(teacher,state,storage).execute(replacementOperation(before));
  const reopened=await new LocalCourseRepository(teacher,state,storage).load();
  expect(reopened.courses[0].chapters[0].activities[0].content).toHaveProperty("exerciseId","lab-2");
  expect(values.get("attempts")).toBe("respostas anteriores");expect(values.get("progress")).toBe("histórico");
});
test("Substituir: outra instância atualiza curso antes da confirmação, sem sobrescrita",async()=>{
  const before=deletionWorkspace(),values=new Map([[COURSE_STORAGE_KEY,JSON.stringify(before)]]);
  const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);}};
  const stale=new LocalCourseRepository(teacher,state,storage),other=new LocalCourseRepository(teacher,state,storage);
  await other.execute({operation:"save-course",course:{...before.courses[0],description:"Nova revisão"}});
  await expect(stale.execute(replacementOperation(before))).rejects.toThrow("outra aba");
  expect((await new LocalCourseRepository(teacher,state,storage).load()).courses[0].description).toBe("Nova revisão");
});
