import {test,expect} from "@playwright/test";
import {createAdminFixtures} from "../data/admin/demo";
import {createCourse,createChapter,moveOrdered} from "../lib/studio/courseDraft";
import {createDraft,buildDefinition} from "../lib/studio/exerciseDraft";
import {simpleSumDefinition} from "./fixtures/simple-sum";
import {applyCourseOperation,visibleWorkspace} from "../lib/courses/authoring";
import {emptyWorkspace,exerciseKey} from "../lib/repositories/CourseRepository";
import {LocalCourseRepository,COURSE_STORAGE_KEY} from "../lib/repositories/InMemoryCourseRepository";

const state=createAdminFixtures(), teacher=state.users.find(u=>u.id==="teacher-neural")!, student=state.users.find(u=>u.id==="student-cesar")!;
const details={title:"Curso de Teste",description:"Descrição",objective:"Objetivo",workload:8,image:{kind:"placeholder" as const,label:"Capa"}};
function setup() {
 let workspace=emptyWorkspace(); const draft=createDraft(simpleSumDefinition), definition=buildDefinition(draft);
 workspace=applyCourseOperation(workspace,{operation:"save-exercise",exercise:{id:draft.id,draft,definition,updatedAt:""}},teacher,state);
 const course=createCourse(details), ch=createChapter("Capítulo 1");
 ch.activities=[{id:"a",title:"Video Aula",order:1,required:true,navigationGroup:"video-lesson",type:"video",content:{url:"https://example.com/a"}},{id:"b",title:"Video Aplicação",order:2,required:true,navigationGroup:"video-application",type:"video",content:{url:"https://example.com/b"}},{id:"lab",title:"Lab",order:3,required:true,navigationGroup:"laboratory",type:"spreadsheet-exercise",content:{exerciseId:draft.id,exerciseVersion:draft.version}}]; course.chapters=[ch];
 workspace=applyCourseOperation(workspace,{operation:"save-course",course},teacher,state);
 return {workspace,course:workspace.courses[0],draft};
}
test("Autoria: persistência demo reabre repositório, metadados, capítulos, atividades e Lab",async()=>{
 const storage=new Map<string,string>(); const adapter={getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>{storage.set(k,v);}};
 const {workspace}=setup(); const repo=new LocalCourseRepository(teacher,state,adapter);
 await repo.execute({operation:"save-exercise",exercise:workspace.exercises[0]}); await repo.execute({operation:"save-course",course:workspace.courses[0]});
 const reopened=await new LocalCourseRepository(teacher,state,adapter).load(); expect(reopened).toEqual(await repo.load()); expect(storage.has(COURSE_STORAGE_KEY)).toBe(true);
 expect(reopened.courses[0].createdBy).toBe(teacher.id);expect(reopened.courses[0].chapters[0].activities[2].content).toHaveProperty("exerciseVersion");
 const failing=new LocalCourseRepository(teacher,state,{...adapter,setItem:()=>{throw new Error("quota");}});
 await expect(failing.execute({operation:"archive",id:workspace.courses[0].id})).rejects.toThrow("quota"); expect((await failing.load()).courses[0].status).toBe("draft");
});
test("Autoria: publicação exige estrutura/referências, aluno só lê publicado com CourseAccess",()=>{
 const {workspace,course}=setup();expect(visibleWorkspace(workspace,student,state).courses).toEqual([]);
 const granted=structuredClone(state);granted.courseAccess.push({userServiceId:"service-cesar",courseId:course.id});
 expect(visibleWorkspace(workspace,student,granted).courses).toEqual([]);
 const published=applyCourseOperation(workspace,{operation:"publish",id:course.id},teacher,state);
 const view=visibleWorkspace(published,student,granted);expect(view.courses).toHaveLength(1);expect(view.exercises).toEqual([]);expect(Object.keys(view.definitions)).toHaveLength(1);
 expect(visibleWorkspace(published,student,state).courses).toEqual([]);
 const invalid=createCourse(details);const saved=applyCourseOperation(workspace,{operation:"save-course",course:invalid},teacher,state);
 expect(()=>applyCourseOperation(saved,{operation:"publish",id:invalid.id},teacher,state)).toThrow("capítulo");
 const missing=structuredClone(workspace);missing.exercises=[];expect(()=>applyCourseOperation(missing,{operation:"publish",id:course.id},teacher,state)).toThrow("exercício");
});
test("Autoria: título/reordenação preservam identidades; versão publicada e remoção ficam protegidas",()=>{
 const {workspace,course,draft}=setup();let next=workspace;
 const changed=structuredClone(next.courses[0]);changed.title="Curso de Teste – Versão 2";changed.chapters[0].activities=moveOrdered(changed.chapters[0].activities,"b",-1);
 next=applyCourseOperation(next,{operation:"save-course",course:changed},teacher,state);expect(next.courses[0].id).toBe(course.id);expect(next.courses[0].chapters[0].id).toBe(course.chapters[0].id);expect(next.courses[0].chapters[0].activities.map(a=>a.id)).toEqual(["b","a","lab"]);
 next=applyCourseOperation(next,{operation:"publish",id:course.id},teacher,state);
 expect(next.definitions[exerciseKey(draft.id,draft.version)]).toEqual(workspace.definitions[exerciseKey(draft.id,draft.version)]);
 const altered={...draft,title:"Alterado"};expect(()=>applyCourseOperation(next,{operation:"save-exercise",exercise:{...next.exercises[0],draft:altered}},teacher,state)).toThrow("nova versão");
 changed.chapters[0].activities.pop();expect(()=>applyCourseOperation(next,{operation:"save-course",course:changed},teacher,state)).toThrow("imutável");
 expect(()=>applyCourseOperation(next,{operation:"delete-draft",id:course.id},teacher,state)).toThrow("Arquive");
});
test("Autoria: isolamento entre professores, Admin somente leitura, archive e draft sem uso",()=>{
 const {workspace,course}=setup(), other={...teacher,id:"other"};expect(()=>applyCourseOperation(workspace,{operation:"save-course",course},other,state)).toThrow("autorizado");
 expect(visibleWorkspace(workspace,other,state).courses).toEqual([]);const admin=state.users.find(u=>u.id==="admin-demo")!;expect(visibleWorkspace(workspace,admin,state).courses).toHaveLength(1);expect(()=>applyCourseOperation(workspace,{operation:"publish",id:course.id},admin,state)).toThrow("professores");
 expect(()=>applyCourseOperation(workspace,{operation:"delete-draft",id:course.id},teacher,state,[course.id])).toThrow("Arquive");
 expect(applyCourseOperation(workspace,{operation:"delete-draft",id:course.id},teacher,state).courses).toEqual([]);
 const archived=applyCourseOperation(workspace,{operation:"archive",id:course.id},teacher,state);expect(archived.courses[0].status).toBe("archived");expect(visibleWorkspace(archived,student,state).courses).toEqual([]);
});
