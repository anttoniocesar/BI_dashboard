import { DataError } from "../data/http";
import { record, exactKeys, text } from "../data/validation";
import { applyCourseOperation } from "../courses/authoring";
import { exerciseManifest } from "../courses/manifest";
import type { CourseOperation } from "../repositories/CourseRepository";
import type { SupabaseCourseRepository } from "../repositories/SupabaseCourseRepository";
import { createSupabaseServiceClient } from "../supabase/server";
import { jsonBody, type AuthorizedContext } from "./api";

export function parseCourseOperation(value: unknown): CourseOperation {
  const input = record(value), operation = text(input.operation);
  if (operation === "save-course") {
    exactKeys(input,["operation","course"]); const course = record(input.course);
    text(course.id); text(course.title); if(typeof course.description!=="string" || typeof course.objective!=="string")throw new DataError("Descrição inválida.");
    if (!Array.isArray(course.chapters) || course.chapters.length>200 || typeof course.workload!=="number") throw new DataError("Dados do curso inválidos.");
    const ids = new Set<string>();
    for (const ch of course.chapters) {
      const chapter=record(ch), id=text(chapter.id); if(ids.has(id))throw new DataError("IDs duplicados."); ids.add(id); text(chapter.title,160,true);
      if(!Number.isSafeInteger(chapter.order) || Number(chapter.order)<1 || chapter.completionPolicy!=="all-required-activities" || (chapter.description!==undefined && typeof chapter.description!=="string"))throw new DataError("Capítulo inválido.");
      if (!Array.isArray(chapter.activities) || chapter.activities.length>500) throw new DataError("Atividades inválidas.");
      for (const a of chapter.activities) {
        const activity=record(a), aid=text(activity.id); if(ids.has(aid))throw new DataError("IDs duplicados."); ids.add(aid); text(activity.title,160,true);
        if(!["video","text","material","assessment","spreadsheet-exercise"].includes(text(activity.type)))throw new DataError("Tipo inválido.");
        if(!Number.isSafeInteger(activity.order) || Number(activity.order)<1 || typeof activity.required!=="boolean")throw new DataError("Atividade inválida.");
        if(activity.navigationGroup!==undefined && !["video-lesson","video-application","laboratory"].includes(String(activity.navigationGroup)))throw new DataError("Grupo de navegação inválido.");
        const content=record(activity.content);
        const primary=activity.type==="video" ? "url" : activity.type==="assessment" ? "description" : activity.type==="spreadsheet-exercise" ? "exerciseId" : "text";
        if(typeof content[primary]!=="string")throw new DataError("Conteúdo da atividade inválido.");
        if(["url","fileName","exerciseVersion"].some(key=>content[key]!==undefined && typeof content[key]!=="string"))throw new DataError("Metadata da atividade inválida.");
        if(content.durationMinutes!==undefined && (typeof content.durationMinutes!=="number" || !Number.isFinite(content.durationMinutes) || content.durationMinutes<0))throw new DataError("Duração inválida.");
      }
    }
    const image=record(course.image); if(image.kind!=="placeholder" || typeof image.label!=="string" || course.service!=="standalone-course")throw new DataError("Curso inválido.");
  } else if (operation === "save-exercise") { exactKeys(input,["operation","exercise"]); const entry=record(input.exercise); text(entry.id); record(entry.draft); }
  else if(operation==="create-course-revision"){
    exactKeys(input,["operation","sourceCourseId","expectedUpdatedAt"]);text(input.sourceCourseId);text(input.expectedUpdatedAt);
    if(!Number.isFinite(Date.parse(String(input.expectedUpdatedAt))))throw new DataError("Revisão inválida.");
  }
  else if (operation === "delete-exercise") { exactKeys(input,["operation","id","version"]); text(input.id); text(input.version); }
  else if (operation === "replace-activity-exercise") {
    exactKeys(input,["operation","id","chapterId","activityId","previousExerciseId","previousExerciseVersion","nextExerciseId","nextExerciseVersion","expectedUpdatedAt"]);
    for (const key of ["id","chapterId","activityId","previousExerciseId","nextExerciseId","nextExerciseVersion","expectedUpdatedAt"]) text(input[key]);
    if (input.previousExerciseVersion !== null) text(input.previousExerciseVersion);
    if (!Number.isFinite(Date.parse(String(input.expectedUpdatedAt)))) throw new DataError("Revisão do curso inválida.");
  }
  else if (["publish","archive","delete-draft"].includes(operation)) { exactKeys(input,["operation","id"]); text(input.id); }
  else throw new DataError("Operação inválida.");
  return input as CourseOperation;
}
export async function courseRequest(request: Request, resolve:()=>Promise<AuthorizedContext & {courses:SupabaseCourseRepository}>) {
  const context=await resolve();
  if(request.headers.get("x-expected-user")!==context.user.id)throw new DataError("A sessão mudou. Entre novamente.",409);
  const before=await context.courses.load();
  if(request.method==="GET")return before;
  const operation=parseCourseOperation(await jsonBody(request,2097152));
  let next;
  try { next=applyCourseOperation(before,operation,context.user,context.state); }
  catch(cause) { if(cause instanceof DataError)throw cause; throw new DataError("Estrutura de autoria inválida."); }
  // No atomic deletion RPC exists yet. Never fall back to demo persistence or
  // issue a service-role delete without database-level reference/history checks.
  if (operation.operation === "delete-exercise") throw new DataError("A exclusão de exercícios no Supabase ainda não está disponível. Nenhum dado foi removido.",501);
  if(operation.operation==="create-course-revision"){
    const revision=next.courses.find(c=>c.basedOnCourseId===operation.sourceCourseId&&c.status==="draft")!;
    await context.courses.createRevision(context.user.id,operation,revision.id,createSupabaseServiceClient());return context.courses.load();
  }
  if (operation.operation === "replace-activity-exercise") {
    await context.courses.replaceExercise(context.user.id,operation,createSupabaseServiceClient());
    return context.courses.load();
  }
  const payload: Record<string,unknown>={operation:operation.operation};
  if(operation.operation==="save-exercise") {
    const entry=next.exercises.find(e=>e.id===operation.exercise.id && e.definition.version===operation.exercise.draft.version)!;
    payload.exercise=entry; payload.definition=next.definitions[JSON.stringify([entry.id,entry.definition.version])]; payload.manifest=exerciseManifest(entry.definition);
  } else {
    const id=operation.operation==="save-course" ? operation.course.id : operation.id;
    payload.id=id; payload.course=next.courses.find(c=>c.id===id);
  }
  await context.courses.write(context.user.id,payload,createSupabaseServiceClient());
  return context.courses.load();
}
