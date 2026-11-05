import {test,expect} from "@playwright/test";
import {deletionWorkspace} from "./fixtures/exercise-deletion";
import {createAdminFixtures} from "../data/admin/demo";
import {applyCourseOperation} from "../lib/courses/authoring";
import {courseFamilyId,courseVersion,latestPublished,courseForNewGrant} from "../lib/courses/versions";
import {LocalCourseRepository,COURSE_STORAGE_KEY} from "../lib/repositories/InMemoryCourseRepository";
import {ExerciseInUseError} from "../lib/courses/exerciseDeletion";
const state=createAdminFixtures(),teacher=state.users.find(u=>u.id==="teacher-neural")!;
function setup(){let workspace=deletionWorkspace();workspace=applyCourseOperation(workspace,{operation:"publish",id:workspace.courses[0].id},teacher,state);return workspace;}
const clone=(workspace:ReturnType<typeof setup>,actor=teacher)=>applyCourseOperation(workspace,{operation:"create-course-revision",sourceCourseId:workspace.courses[0].id,expectedUpdatedAt:workspace.courses[0].updatedAt},actor,state);
test("Versões: cópia profunda completa, novos IDs, rastreabilidade e exercícios sem duplicação",()=>{
 const before=setup(),after=clone(before),v1=after.courses[0],v2=after.courses[1];
 expect(v1).toEqual(before.courses[0]);expect(v2).toMatchObject({courseFamilyId:courseFamilyId(v1),versionNumber:2,basedOnCourseId:v1.id,status:"draft",title:v1.title,description:v1.description,objective:v1.objective,workload:v1.workload,image:v1.image});expect(v2.publishedAt).toBeUndefined();
 expect(v2.chapters[0].id).not.toBe(v1.chapters[0].id);expect(v2.chapters[0].sourceChapterId).toBe(v1.chapters[0].id);
 expect(v2.chapters[0].activities[0]).toEqual({...v1.chapters[0].activities[0],id:v2.chapters[0].activities[0].id,sourceActivityId:v1.chapters[0].activities[0].id});
 expect(v2.chapters[0].activities[0].id).not.toBe(v1.chapters[0].activities[0].id);expect(after.exercises).toEqual(before.exercises);expect(after.definitions).toEqual(before.definitions);
 v2.chapters[0].title="Alterado";expect(v1.chapters[0].title).not.toBe("Alterado");
});
test("Versões: um rascunho por família, origem/revisão e autorização",()=>{
 const before=setup(),after=clone(before);expect(()=>clone(after)).toThrow("Já existe");
 expect(()=>applyCourseOperation(before,{operation:"create-course-revision",sourceCourseId:before.courses[0].id,expectedUpdatedAt:"stale"},teacher,state)).toThrow("Recarregue");
 expect(()=>clone(before,{...teacher,id:"stranger"})).toThrow("autorizado");
 expect(()=>clone(before,state.users.find(u=>u.id==="admin-demo")!)).not.toThrow();
 expect(()=>clone(before,state.users.find(u=>u.id==="student-cesar")!)).toThrow("autorizado");
});
test("Versões: published imutável para metadados, capítulos, atividades e texto",()=>{
 const before=setup();for(const mutate of [(c:typeof before.courses[0])=>{c.title="Título";},(c:typeof before.courses[0])=>{c.chapters=[];},(c:typeof before.courses[0])=>{c.chapters[0].activities[0].required=false;}]){const changed=structuredClone(before.courses[0]);mutate(changed);expect(()=>applyCourseOperation(before,{operation:"save-course",course:changed},teacher,state)).toThrow("imutável");}
 expect(()=>applyCourseOperation(before,{operation:"delete-draft",id:before.courses[0].id},teacher,state)).toThrow();
});
test("Versões: editar v2, substituir Lab, publicar e manter v1/proteção histórica",()=>{
 let workspace=clone(setup());const v1=structuredClone(workspace.courses[0]),v2=workspace.courses[1],ch=v2.chapters[0],a=ch.activities[0];
 workspace=applyCourseOperation(workspace,{operation:"replace-activity-exercise",id:v2.id,chapterId:ch.id,activityId:a.id,previousExerciseId:"lab-1",previousExerciseVersion:"0.1-draft",nextExerciseId:"lab-2",nextExerciseVersion:"0.1-draft",expectedUpdatedAt:v2.updatedAt},teacher,state);
 workspace=applyCourseOperation(workspace,{operation:"publish",id:v2.id},teacher,state);expect(latestPublished(workspace.courses,courseFamilyId(v1))?.id).toBe(v2.id);expect(workspace.courses[0]).toEqual(v1);
 for(const id of ["lab-1","lab-2"])expect(()=>applyCourseOperation(workspace,{operation:"delete-exercise",id,version:"0.1-draft"},teacher,state)).toThrow(ExerciseInUseError);
 const next=applyCourseOperation(workspace,{operation:"create-course-revision",sourceCourseId:v2.id,expectedUpdatedAt:workspace.courses[1].updatedAt},teacher,state);expect(next.courses.at(-1)?.versionNumber).toBe(3);
});
test("Versões: acessos existentes fixos; novos resolvem latest por número, sem migrar acesso não iniciado",()=>{
 let workspace=clone(setup());workspace=applyCourseOperation(workspace,{operation:"publish",id:workspace.courses[1].id},teacher,state);const[v1,v2]=workspace.courses;
 const granted=structuredClone(state);granted.courseAccess.push({userServiceId:"service-cesar",courseId:v1.id});expect(courseForNewGrant(workspace.courses,granted,"service-cesar",v2.id).id).toBe(v1.id);
 expect(courseForNewGrant(workspace.courses,state,"service-cesar",v1.id).id).toBe(v2.id);expect(courseVersion(v2)).toBe(2);
});
test("Versões: descarte só rascunho, v1 preservada e recriação possível",()=>{
 const after=clone(setup()),next=applyCourseOperation(after,{operation:"delete-draft",id:after.courses[1].id},teacher,state);expect(next.courses).toEqual([after.courses[0]]);expect(clone(next).courses[1].versionNumber).toBe(2);
});
test("Versões: persistência, reabertura, falha sem cópia parcial e concorrência entre instâncias",async()=>{
 const before=setup(),values=new Map([[COURSE_STORAGE_KEY,JSON.stringify(before)],["attempts","historical"]]);const storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);}};
 const operation={operation:"create-course-revision" as const,sourceCourseId:before.courses[0].id,expectedUpdatedAt:before.courses[0].updatedAt};
 const failed=new LocalCourseRepository(teacher,state,{...storage,setItem:()=>{throw new Error("quota");}});await expect(failed.execute(operation)).rejects.toThrow("quota");expect((await failed.load()).courses).toHaveLength(1);
 const a=new LocalCourseRepository(teacher,state,storage),b=new LocalCourseRepository(teacher,state,storage);const results=await Promise.allSettled([a.execute(operation),b.execute(operation)]);expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(1);expect((await new LocalCourseRepository(teacher,state,storage).load()).courses).toHaveLength(2);expect(values.get("attempts")).toBe("historical");
});
