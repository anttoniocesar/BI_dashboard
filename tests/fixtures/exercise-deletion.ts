import { createAdminFixtures } from "../../data/admin/demo";
import { createDraft, buildDefinition } from "../../lib/studio/exerciseDraft";
import { createCourse, createChapter } from "../../lib/studio/courseDraft";
import { simpleSumDefinition } from "./simple-sum";
import { applyCourseOperation } from "../../lib/courses/authoring";
import { emptyWorkspace } from "../../lib/repositories/CourseRepository";

const state = createAdminFixtures(), teacher = state.users.find(u => u.id === "teacher-neural")!;
export function deletionWorkspace() {
  let workspace = emptyWorkspace();
  for (const [id,title] of [["lab-1","laboratorio_1.xlsx"],["lab-2","laboratorio_2.xlsx"],["duplicate","laboratorio_2.xlsx"]]) {
    const draft = {...createDraft(simpleSumDefinition),id,title};
    workspace = applyCourseOperation(workspace,{operation:"save-exercise",exercise:{id,draft,definition:buildDefinition(draft),updatedAt:""}},teacher,state);
  }
  const course = createCourse({title:"Curso Teste Completo",description:"Descrição",objective:"Objetivo",workload:1,image:{kind:"placeholder",label:"Capa"}});
  const chapter = createChapter("Capítulo 1 — Introdução");
  chapter.activities = [{id:"lab",title:"Lab",type:"spreadsheet-exercise",order:1,required:true,content:{exerciseId:"lab-1",exerciseVersion:"0.1-draft"}}];
  course.chapters = [chapter];
  return applyCourseOperation(workspace,{operation:"save-course",course},teacher,state);
}
