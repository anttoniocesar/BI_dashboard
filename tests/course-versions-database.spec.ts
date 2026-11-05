import {test,expect} from "@playwright/test";
import {PGlite} from "@electric-sql/pglite";
import {readFile} from "node:fs/promises";
import {createCourse,createChapter} from "../lib/studio/courseDraft";
import {neuralExerciseDefinition} from "../data/exercises/neural-error-correction";
import {exerciseManifest} from "../lib/courses/manifest";
import type {CourseWorkspace} from "../lib/repositories/CourseRepository";
import {serializeExercise} from "../lib/storage/exerciseSessionCodec";
import {cloneWorkbook} from "../lib/spreadsheet/workbook";

test("Versões PostgreSQL: migration, cópia atômica, draft único, histórico, acesso físico e imutabilidade",async()=>{
 const db=new PGlite();try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',created_at timestamptz default now());create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to authenticated,anon,service_role;`);
  for(const file of ["202610230001_admin_auth_progress.sql","202610230002_teacher_monitoring.sql","202610240001_exercise_attempts.sql","202610240002_course_authoring.sql","202610240003_course_catalog_seed.sql","202610260001_replace_activity_exercise.sql","202610260002_course_versions.sql","202610270001_course_journey.sql"])await db.exec(await readFile(`supabase/migrations/${file}`,"utf8"));
  await db.exec(await readFile("supabase/seed.sql","utf8"));
  const teacher="10000000-0000-4000-8000-000000000001",student="10000000-0000-4000-8000-000000000002",fresh="10000000-0000-4000-8000-000000000003",admin="10000000-0000-4000-8000-000000000004";
  for(const[id,role]of[[teacher,"teacher"],[student,"student"],[fresh,"student"],[admin,"admin"]]){await db.query("insert into auth.users(id,email) values($1,$2)",[id,`${id}@test.invalid`]);await db.query("insert into public.user_roles(user_id,role) values($1,$2)",[id,role]);}
  const asUser=async(id:string,role="authenticated")=>{await db.exec("reset role");await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec(`set role ${role}`);};
  const load=async()=>{await asUser(teacher);return(await db.query<{data:CourseWorkspace}>("select public.course_workspace() data")).rows[0].data;};
  const write=async(payload:unknown)=>{await asUser("","service_role");return db.query("select public.save_course_authoring($1,$2)",[teacher,JSON.stringify(payload)]);};
  const definition={...structuredClone(neuralExerciseDefinition),id:"versioned-lab"};await write({operation:"save-exercise",exercise:{id:definition.id,draft:definition,definition},definition,manifest:exerciseManifest(definition)});
  const course=createCourse({title:"Curso Teste Completo",description:"Descrição",objective:"Objetivo",workload:3,image:{kind:"placeholder",label:"Capa"}}),ch=createChapter("Introdução");
  ch.activities=[{id:"lab",title:"Lab",type:"spreadsheet-exercise",order:1,required:true,content:{exerciseId:definition.id,exerciseVersion:definition.version}},{id:"video",title:"Vídeo",type:"video",order:2,required:false,content:{url:"https://example.com/video.mp4",durationMinutes:3}}];ch.trailPointId="P1";course.chapters=[ch];
  await write({operation:"save-course",id:course.id,course});await write({operation:"publish",id:course.id,course:{...course,status:"published"}});const v1=(await load()).courses.find(c=>c.id===course.id)!;
  expect(v1).toMatchObject({versionNumber:1,courseFamilyId:v1.id,publishedAt:expect.any(String)});
  const services=new Map<string,string>();for(const id of[student,fresh]){await asUser(admin);for(const command of[{type:"enroll",userId:id},{type:"assign-service",userId:id,serviceId:"00000000-0000-4000-8000-000000000001"}])await db.query("select public.admin_command($1)",[JSON.stringify(command)]);services.set(id,(await db.query<{id:string}>("select id from public.user_services where user_id=$1",[id])).rows[0].id);}
  await asUser(admin);await db.query("select public.admin_command($1)",[JSON.stringify({type:"grant-course",userServiceId:services.get(student),courseId:v1.id})]);await asUser(student);
  await db.query("select public.save_student_progress($1,$2,'video','in-progress')",[v1.id,ch.id]);
  const identity={courseId:v1.id,chapterId:ch.id,activityId:"lab",exerciseId:definition.id,exerciseVersion:definition.version};
  const savedState=serializeExercise(definition,{workbook:cloneWorkbook(definition.workbook),activeSheet:"treinamento",selections:{},validation:"never"});savedState.cells=[{worksheetId:"treinamento",address:"F2",raw:"=42"}];
  await db.query("select public.exercise_attempt_operation('save',$1,$2)",[JSON.stringify(identity),JSON.stringify(savedState)]);
  await db.exec("reset role");const history=(await db.query("select * from public.student_progress")).rows;const attempts=(await db.query("select * from public.exercise_attempts")).rows;expect(attempts).toHaveLength(1);
  const payload={sourceCourseId:v1.id,expectedUpdatedAt:v1.updatedAt,newCourseId:"course-version-2"};
  await asUser(teacher);await expect(db.query("select public.create_course_revision($1,$2)",[teacher,JSON.stringify(payload)])).rejects.toThrow();
  const clone=async(value:unknown,actor=teacher)=>{await asUser("","service_role");return db.query("select public.create_course_revision($1,$2)",[actor,JSON.stringify(value)]);};
  await expect(clone(payload,fresh)).rejects.toThrow("Denied");await expect(clone({...payload,expectedUpdatedAt:"2000-01-01"})).rejects.toThrow("Source changed");
  await clone(payload);const v2=(await load()).courses.find(c=>c.id===payload.newCourseId)!;expect(v2).toMatchObject({courseFamilyId:v1.id,versionNumber:2,basedOnCourseId:v1.id,status:"draft",title:v1.title});
  expect(v1.chapters[0].trailPointId).toBe("P1");expect(v2.chapters[0].trailPointId).toBe("P1");
  expect(v2.chapters[0].sourceChapterId).toBe(ch.id);expect(v2.chapters[0].id).not.toBe(ch.id);expect(v2.chapters[0].activities[0].sourceActivityId).toBe("lab");expect(v2.chapters[0].activities[1].content).toEqual(v1.chapters[0].activities[1].content);
  await expect(clone({...payload,newCourseId:"duplicate-draft"})).rejects.toThrow("Active draft exists");
  await expect(write({operation:"save-course",id:v1.id,course:{...v1,title:"Mutated"}})).rejects.toThrow("immutable");
  await db.exec("reset role");await expect(db.query("update public.course_activities set title='Mutated' where course_id=$1",[v1.id])).rejects.toThrow("immutable");await expect(db.query("delete from public.courses where id=$1",[v1.id])).rejects.toThrow("Preserve");
  await write({operation:"save-course",id:v2.id,course:{...v2,title:"Curso Teste Completo v2"}});const edited=(await load()).courses.find(c=>c.id===v2.id)!;await write({operation:"publish",id:v2.id,course:{...edited,status:"published"}});
  await asUser(admin);for(const id of[student,fresh])await db.query("select public.admin_command($1)",[JSON.stringify({type:"grant-course",userServiceId:services.get(id),courseId:v1.id})]);
  const accesses=(await db.query<{user_service_id:string;course_id:string}>("select * from public.course_access")).rows;expect(accesses.filter(a=>a.user_service_id===services.get(student)).map(a=>a.course_id)).toEqual([v1.id]);expect(accesses.filter(a=>a.user_service_id===services.get(fresh)).map(a=>a.course_id)).toEqual([v2.id]);
  await db.exec("reset role");expect((await db.query("select * from public.student_progress")).rows).toEqual(history);expect((await db.query("select * from public.exercise_attempts")).rows).toEqual(attempts);
  await asUser(student);expect((await db.query<{data:CourseWorkspace}>("select public.course_workspace() data")).rows[0].data.courses.map(c=>c.id)).toEqual([v1.id]);await asUser(fresh);expect((await db.query<{data:CourseWorkspace}>("select public.course_workspace() data")).rows[0].data.courses.map(c=>c.id)).toEqual([v2.id]);
 }finally{await db.close();}
});
