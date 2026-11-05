import type { CourseDraft } from "../../types/course";
import type { AdminState } from "../../types/admin";
import { DataError } from "../data/http";

export const courseFamilyId = (course:CourseDraft) => course.courseFamilyId ?? course.id;
export const courseVersion = (course:CourseDraft) => course.versionNumber ?? 1;
export function latestPublished(courses:CourseDraft[], familyId:string) {
  return courses.filter(c=>courseFamilyId(c)===familyId && c.status==="published").sort((a,b)=>courseVersion(b)-courseVersion(a))[0];
}
export function courseFamilies(courses:CourseDraft[]) {
  const families=new Map<string,CourseDraft[]>();
  for(const course of courses){const key=courseFamilyId(course);families.set(key,[...(families.get(key)??[]),course]);}
  return [...families.values()].map(versions=>versions.sort((a,b)=>courseVersion(b)-courseVersion(a)));
}
/** Existing access is a persisted physical-version pin, including before first visit.
 * New grants resolve latest publication; granting again never silently migrates a user. */
export function courseForNewGrant(courses:CourseDraft[],state:AdminState,userServiceId:string,requestedId:string) {
  const requested=courses.find(c=>c.id===requestedId || courseFamilyId(c)===requestedId);
  if(!requested)throw new DataError("Curso não encontrado.",404);
  const family=courseFamilyId(requested),userId=state.userServices.find(s=>s.id===userServiceId)?.userId;
  const links=state.userServices.filter(s=>s.userId===userId).map(s=>s.id);
  const existing=courses.filter(c=>courseFamilyId(c)===family && c.status==="published" && state.courseAccess.some(a=>links.includes(a.userServiceId)&&a.courseId===c.id)).sort((a,b)=>courseVersion(a)-courseVersion(b))[0];
  const result=existing ?? latestPublished(courses,family);
  if(!result)throw new DataError("Publique o curso antes de liberar acesso.");
  return result;
}
export function copyCourseRevision(source:CourseDraft,all:CourseDraft[],actorId:string,actorName:string):CourseDraft {
  if(source.status!=="published")throw new DataError("Crie uma nova versão a partir de um curso publicado.",409);
  const family=courseFamilyId(source),versions=all.filter(c=>courseFamilyId(c)===family);
  if(versions.some(c=>c.status==="draft"))throw new DataError("Já existe uma versão em rascunho deste curso. Abra o rascunho existente.",409);
  const now=new Date().toISOString();actorId=source.createdBy??actorId;actorName=source.createdByName??actorName;
  const result:CourseDraft={...structuredClone(source),id:`course-${crypto.randomUUID()}`,courseFamilyId:family,versionNumber:Math.max(...versions.map(courseVersion))+1,basedOnCourseId:source.id,status:"draft",createdBy:actorId,createdByName:actorName,createdAt:now,updatedAt:now,
    chapters:source.chapters.map(ch=>({...structuredClone(ch),id:`chapter-${crypto.randomUUID()}`,sourceChapterId:ch.id,activities:ch.activities.map(a=>({...structuredClone(a),id:`activity-${crypto.randomUUID()}`,sourceActivityId:a.id}))}))};
  delete result.publishedAt;
  return result;
}
