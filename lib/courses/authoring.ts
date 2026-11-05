import type { CourseDraft, ExerciseLibrary } from "../../types/course";
import type { AdminState, User } from "../../types/admin";
import { hasRole } from "../admin/permissions";
import { requireCourseAccess } from "../auth/access";
import { DataError } from "../data/http";
import { buildDefinition } from "../studio/exerciseDraft";
import { validateCourseDraft } from "../studio/courseDraft";
import { exerciseKey, type CourseOperation, type CourseWorkspace } from "../repositories/CourseRepository";
import { exerciseUsages, ExerciseInUseError } from "./exerciseDeletion";
import { isValidStudioExercise, nextCourseTimestamp } from "./exerciseReplacement";
import { copyCourseRevision, courseFamilyId, courseVersion } from "./versions";
import { TRAIL_POINTS, resolvedJourney } from "./journey";
const canonicalJSON = (value:unknown) => JSON.stringify(value,(_key,item)=>item && typeof item==="object" && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])) : item);

export function canEditCourse(course: CourseDraft, user: User | null, state: AdminState) {
  return hasRole(user, "teacher") && (course.createdBy === user!.id || state.courseTeachers.some(link => [course.id,course.basedOnCourseId,courseFamilyId(course)].includes(link.courseId) && link.userId === user!.id));
}
export function visibleWorkspace(workspace: CourseWorkspace, user: User | null, state: AdminState): CourseWorkspace {
  const courses = workspace.courses.filter(course => hasRole(user, "admin") || canEditCourse(course, user, state) || (course.status === "published" && requireCourseAccess(state, user, course.id)));
  const exercises = workspace.exercises.filter(entry => hasRole(user, "teacher") && (entry.createdBy === user!.id || courses.some(course => canEditCourse(course,user,state) && course.chapters.some(ch => ch.activities.some(a => a.type === "spreadsheet-exercise" && a.content.exerciseId === entry.id && (!a.content.exerciseVersion || a.content.exerciseVersion === entry.definition.version))))));
  const definitions: CourseWorkspace["definitions"] = {};
  for (const course of courses) for (const chapter of course.chapters) for (const activity of chapter.activities) if (activity.type === "spreadsheet-exercise") {
    const { exerciseId, exerciseVersion } = activity.content;
    const key = exerciseVersion ? exerciseKey(exerciseId, exerciseVersion) : exerciseId;
    if (workspace.definitions[key]) definitions[key] = workspace.definitions[key];
  }
  for (const entry of exercises) definitions[exerciseKey(entry.id,entry.definition.version)] = buildDefinition(entry.draft,true);
  return structuredClone({ courses, exercises, definitions });
}
export function courseIssues(course: CourseDraft, workspace: CourseWorkspace) {
  const library: ExerciseLibrary = {};
  for (const chapter of course.chapters) for (const activity of chapter.activities) if (activity.type === "spreadsheet-exercise") {
    const entry = workspace.exercises.find(entry => entry.id === activity.content.exerciseId && entry.definition.version === activity.content.exerciseVersion);
    if (entry) library[exerciseKey(entry.id,entry.definition.version)] = entry;
  }
  return validateCourseDraft(course,library);
}
export function applyCourseOperation(workspace: CourseWorkspace, operation: CourseOperation, user: User, state: AdminState, usedCourseIds: string[] = []): CourseWorkspace {
  workspace={...workspace,courses:workspace.courses.map(c=>({...c,courseFamilyId:courseFamilyId(c),versionNumber:courseVersion(c)}))};
  if(operation.operation==="create-course-revision"){
    const source=workspace.courses.find(c=>c.id===operation.sourceCourseId);
    if(!source)throw new DataError("Curso não encontrado.",404);
    if(!hasRole(user,"admin")&&!canEditCourse(source,user,state))throw new DataError("Curso não autorizado.",403);
    if(source.updatedAt!==operation.expectedUpdatedAt)throw new DataError("O curso foi alterado. Recarregue antes de criar nova versão.",409);
    const revision=copyCourseRevision(source,workspace.courses,user.id,user.name);
    return {...structuredClone(workspace),courses:[...structuredClone(workspace.courses),revision]};
  }
  if (!hasRole(user,"teacher")) throw new DataError("Somente professores autorizados podem editar.",403);
  const next = structuredClone(workspace), now = new Date().toISOString();
  if (operation.operation === "delete-exercise") {
    const entry = next.exercises.find(item => item.id === operation.id && item.definition.version === operation.version);
    if (!entry) throw new DataError("Exercício não encontrado.", 404);
    const usages = exerciseUsages(next.courses, operation.id, operation.version);
    if (entry.createdBy !== user.id && !next.courses.some(course => usages.some(usage => usage.courseId === course.id) && canEditCourse(course,user,state))) throw new DataError("Exercício não autorizado.", 403);
    if (usages.length) throw new ExerciseInUseError(usages);
    next.exercises = next.exercises.filter(item => !(item.id === operation.id && item.definition.version === operation.version));
    delete next.definitions[exerciseKey(operation.id, operation.version)];
    return next;
  }
  if (operation.operation === "save-exercise") {
    const entry = structuredClone(operation.exercise), definition = buildDefinition(entry.draft);
    if (entry.id !== definition.id || !definition.id || !definition.version) throw new DataError("Identidade do exercício inválida.");
    const old = next.exercises.find(item => item.id === entry.id && item.definition.version === definition.version);
    const referenced = next.courses.filter(course => course.chapters.some(ch => ch.activities.some(a => a.type === "spreadsheet-exercise" && a.content.exerciseId === entry.id && a.content.exerciseVersion === definition.version)));
    if (old && old.createdBy !== user.id && !referenced.some(course => canEditCourse(course,user,state))) throw new DataError("Exercício não autorizado.",403);
    if (old && referenced.some(course => course.status !== "draft") && canonicalJSON(old.draft) !== canonicalJSON(entry.draft)) throw new DataError("Esta versão já foi publicada. Informe uma nova versão do exercício antes de salvar.",409);
    entry.definition = definition; entry.createdBy = old?.createdBy ?? user.id; entry.updatedAt = now;
    next.exercises = next.exercises.filter(item => !(item.id === entry.id && item.definition.version === definition.version)).concat(entry);
    next.definitions[exerciseKey(entry.id,definition.version)] = buildDefinition(entry.draft,true);
    return next;
  }
  const id = operation.operation === "save-course" ? operation.course.id : operation.id;
  const old = next.courses.find(course => course.id === id);
  if (old && !canEditCourse(old,user,state)) throw new DataError("Curso não autorizado.",403);
  if (!old && operation.operation !== "save-course") throw new DataError("Curso não encontrado.",404);
  if (operation.operation === "replace-activity-exercise") {
    if (old!.status !== "draft") throw new DataError("Atividade publicada deve ser preservada. Crie uma nova versão do curso para trocar o Lab e manter o histórico.",409);
    const activity = old!.chapters.find(chapter => chapter.id === operation.chapterId)?.activities.find(item => item.id === operation.activityId);
    if (!activity || activity.type !== "spreadsheet-exercise") throw new DataError("Atividade Lab não encontrada.",404);
    if (old!.updatedAt !== operation.expectedUpdatedAt || activity.content.exerciseId !== operation.previousExerciseId || (activity.content.exerciseVersion ?? null) !== operation.previousExerciseVersion) throw new DataError("O curso foi alterado em outra aba ou sessão. Recarregue o curso antes de substituir.",409);
    if (activity.content.exerciseId === operation.nextExerciseId && (!activity.content.exerciseVersion || activity.content.exerciseVersion === operation.nextExerciseVersion)) throw new DataError("Selecione outro exercício ou versão.");
    const entry = next.exercises.find(item => item.id === operation.nextExerciseId && item.definition.version === operation.nextExerciseVersion);
    if (!entry || !isValidStudioExercise(entry)) throw new DataError("O novo exercício não está disponível ou é inválido.");
    const usages = exerciseUsages(next.courses,entry.id,entry.definition.version);
    if (entry.createdBy !== user.id && !next.courses.some(course => usages.some(usage => usage.courseId === course.id) && canEditCourse(course,user,state))) throw new DataError("Exercício não autorizado.",403);
    activity.content = {exerciseId:entry.id,exerciseVersion:entry.definition.version};
    old!.updatedAt = nextCourseTimestamp(old!.updatedAt);
    return next;
  }
  if (operation.operation === "delete-draft") {
    if (old!.status !== "draft" || old!.publishedAt || usedCourseIds.includes(id) || state.courseAccess.some(access => access.courseId === id)) throw new DataError("Curso em uso. Arquive para preservar o histórico.",409);
    next.courses = next.courses.filter(course => course.id !== id); return next;
  }
  if (operation.operation === "save-course") {
    if(old && old.status!=="draft")throw new DataError("Versão publicada é imutável. Use Criar nova versão para alterar o conteúdo.",409);
    const course = structuredClone(operation.course);
    const assigned = course.chapters.filter(ch => ch.trailPointId !== undefined);
    if (assigned.some(ch => !TRAIL_POINTS.some(p => p.id === ch.trailPointId)) || new Set(assigned.map(ch => ch.trailPointId)).size !== assigned.length) throw new DataError("Ponto da jornada inválido ou ocupado. TOP é reservado à conclusão.");
    const previousChapters = old ? resolvedJourney(old.chapters) : [];
    const pointsChanged = assigned.some(ch => previousChapters.find(previous => previous.id === ch.id)?.trailPointId !== ch.trailPointId);
    if (pointsChanged) {
      let previous = 0;
      for (const ch of [...course.chapters].sort((a,b) => a.order-b.order)) {
        const point = TRAIL_POINTS.find(p => p.id === ch.trailPointId);
        if (!point) continue; // Incomplete drafts remain editable; publication requires all points.
        if ((ch.order === 1 && point.id !== "P1") || point.order <= previous) throw new DataError("O primeiro capítulo deve começar em P1 e a jornada deve respeitar a ordem da trilha.");
        previous = point.order;
      }
    }
    if (!course.id || course.id.length > 160 || !course.title.trim() || !Array.isArray(course.chapters) || !Number.isFinite(course.workload) || course.workload < 0) throw new DataError("Dados do curso inválidos.");
    course.createdBy = old ? old.createdBy : user.id; course.createdByName = old ? old.createdByName : user.name; course.createdAt = old?.createdAt ?? now; course.updatedAt = nextCourseTimestamp(old?.updatedAt); course.status = old?.status ?? "draft";
    course.courseFamilyId=old?courseFamilyId(old):course.id;course.versionNumber=old?courseVersion(old):1;
    if(old?.basedOnCourseId)course.basedOnCourseId=old.basedOnCourseId;else delete course.basedOnCourseId;
    if(old?.publishedAt)course.publishedAt=old.publishedAt;else delete course.publishedAt;
    for(const chapter of course.chapters){
      const previous=old?.chapters.find(ch=>ch.id===chapter.id);
      if(previous?.sourceChapterId)chapter.sourceChapterId=previous.sourceChapterId;else delete chapter.sourceChapterId;
      for(const activity of chapter.activities){const source=previous?.activities.find(a=>a.id===activity.id);if(source?.sourceActivityId)activity.sourceActivityId=source.sourceActivityId;else delete activity.sourceActivityId;}
    }
    // Lab references are immutable pairs. Legacy UI values are pinned at the first save.
    for (const ch of course.chapters) for (const a of ch.activities) if (a.type === "spreadsheet-exercise" && !a.content.exerciseVersion) a.content.exerciseVersion = next.exercises.find(entry => entry.id === a.content.exerciseId)?.definition.version;
    next.courses = next.courses.filter(item => item.id !== id).concat(course); return next;
  }
  if (operation.operation === "publish") {
    if(old!.status!=="draft")throw new DataError("Somente rascunhos podem ser publicados.",409);
    const issues = courseIssues(old!,next); if (issues.length) throw new DataError(issues.join(" "));
    old!.status = "published";
    old!.publishedAt=now;
  } else old!.status = "archived";
  old!.updatedAt = nextCourseTimestamp(old!.updatedAt); return next;
}
