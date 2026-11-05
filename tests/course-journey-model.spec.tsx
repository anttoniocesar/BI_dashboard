import { test, expect } from "@playwright/test";
import { renderToStaticMarkup } from "react-dom/server";
import { TRAIL_POINTS, TRAIL_TOP, distributeTrailPoints, resolvedJourney, journeyIssues, assignTrailPoint, trailPath } from "../lib/courses/journey";
import { copyCourseRevision } from "../lib/courses/versions";
import { demoCourse } from "../data/courses/neural-demo";
import { CourseJourneyBoard } from "../components/learn/CourseJourneyBoard";
import { courseProgress, initialProgress } from "../lib/learn/progress";
import { applyCourseOperation } from "../lib/courses/authoring";
import { emptyWorkspace } from "../lib/repositories/CourseRepository";
import { createAdminFixtures } from "../data/admin/demo";
const chapters = (count: number) => Array.from({ length: count }, (_, i) => ({ ...structuredClone(demoCourse.chapters[0]), id: `ch-${i}`, title: `Título ${i}`, order: i + 1, trailPointId: distributeTrailPoints(count)[i] }));
test("Jornada: 15 guias estáveis e TOP separado", () => {
 expect(TRAIL_POINTS.map(p=>p.id)).toEqual(Array.from({length:15},(_,i)=>`P${i+1}`));
 expect(TRAIL_TOP).toEqual({id:"TOP",x:72.4,y:9.5,order:16});
 expect(new Set(TRAIL_POINTS.map(p=>p.order)).size).toBe(15);
});
for(const [count,ids] of [[2,[1,13]],[3,[1,7,13]],[4,[1,5,9,13]],[5,[1,4,7,10,13]],[6,[1,3,6,8,11,13]],[8,[1,3,5,7,9,11,13,15]],[10,[1,3,4,6,7,9,10,12,13,15]],[12,[1,2,4,5,6,7,9,10,11,12,14,15]],[15,Array.from({length:15},(_,i)=>i+1)]] as [number,number[]][]) {
 test(`Jornada: distribuição determinística ${count}`,()=>{
  expect(distributeTrailPoints(count)).toEqual(ids.map(n=>`P${n}`));
  expect(journeyIssues(chapters(count))).toEqual([]);
  expect(trailPath(chapters(count))).toMatch(/72.4 9.5$/);
 });
}
for(const [label,index,point] of [["primeiro fora de P1",0,"P5"],["TOP",1,"TOP"],["inexistente",1,"P16"],["duplicado",1,"P1"],["regressivo",2,"P5"]] as [string,number,string][]) test(`Jornada: bloqueia ${label}`,()=>{
 const ch=chapters(3);expect(()=>assignTrailPoint(ch,ch[index].id,point)).toThrow();
 expect(journeyIssues(ch.map((c,i)=>i===index?{...c,trailPointId:point}:c)).length).toBeGreaterThan(0);
});
test("Jornada: ajuste manual, remoção libera ponto e reorder avisa sem corrigir",()=>{
 const original=chapters(3), changed=assignTrailPoint(original,"ch-1","P6");
 expect(changed[1].trailPointId).toBe("P6");expect(original[1].trailPointId).toBe("P7");
 const removed=changed.filter(c=>c.id!=="ch-1");expect(assignTrailPoint(removed,"ch-2","P6")[1].trailPointId).toBe("P6");
 const reordered=changed.map((c,i)=>({...c,order:3-i}));expect(journeyIssues(reordered).join()).toContain("regressiva");
 expect(resolvedJourney(reordered).map(c=>c.trailPointId)).toEqual(["P13","P6","P1"]);
});
test("Jornada: versão copia associações com novos IDs e mantém v1 isolada",()=>{
 const source={...structuredClone(demoCourse),status:"published" as const,chapters:chapters(3)};
 const next=copyCourseRevision(source,[source],"teacher","Professor");
 expect(next.chapters.map(c=>c.trailPointId)).toEqual(["P1","P7","P13"]);
 expect(next.chapters[0].sourceChapterId).toBe(source.chapters[0].id);
 next.chapters=assignTrailPoint(next.chapters,next.chapters[1].id,"P6");expect(source.chapters[1].trailPointId).toBe("P7");
});
test("Jornada: limite, novo capítulo sem posição e legado",()=>{
 expect(()=>distributeTrailPoints(16)).toThrow("até 15");
 const missing=[...chapters(3),{...chapters(1)[0],id:"new",order:4,trailPointId:undefined}];
 expect(journeyIssues(resolvedJourney(missing)).join()).toContain("Defina a posição");
 expect(resolvedJourney(demoCourse.chapters).map(c=>c.trailPointId)).toEqual(["P1","P7","P13"]);
});
test("Jornada: aluno sem guias e caminho suave termina no TOP inclusive com um capítulo",()=>{
 for(const count of [1,3,15]) {
  const course={...demoCourse,chapters:chapters(count)}, state=courseProgress(course,initialProgress(course.id));
  const html=renderToStaticMarkup(<CourseJourneyBoard course={course} chapters={state.chapters}/>);
  expect(html).not.toContain("trail-guide");expect(html).not.toMatch(/>P\d+</);
  expect(html).toContain("Conclusão do curso");expect(trailPath(course.chapters)).toContain(" C ");
  expect(trailPath(course.chapters)).toMatch(/72.4 9.5$/);
 }
});
test("Jornada: agregado bloqueia atribuições inválidas e permite avisar sobre reorder legado",()=>{
 const state=createAdminFixtures(), teacher=state.users.find(u=>u.id==="teacher-neural")!;
 const source={...structuredClone(demoCourse),status:"draft" as const,createdBy:teacher.id};
 const workspace=applyCourseOperation(emptyWorkspace(),{operation:"save-course",course:source},teacher,state);
 const course=workspace.courses[0], assigned=resolvedJourney(course.chapters);
 for(const point of ["TOP","P5",42]) {
  const invalid={...course,chapters:assigned.map((ch,i)=>i===0?{...ch,trailPointId:point as string}:ch)};
  expect(()=>applyCourseOperation(workspace,{operation:"save-course",course:invalid},teacher,state)).toThrow();
 }
 const reordered={...course,chapters:[...assigned].reverse().map((ch,i)=>({...ch,order:i+1}))};
 const saved=applyCourseOperation(workspace,{operation:"save-course",course:reordered},teacher,state);
 expect(saved.courses[0].chapters.map(ch=>ch.trailPointId)).toEqual(["P13","P7","P1"]);
 expect(journeyIssues(saved.courses[0].chapters).join()).toContain("regressiva");
 expect(()=>applyCourseOperation(saved,{operation:"publish",id:course.id},teacher,state)).toThrow();
});
