import {test,expect} from "@playwright/test";
import {PGlite} from "@electric-sql/pglite";
import {readFile} from "node:fs/promises";
import {createCourse,createChapter} from "../lib/studio/courseDraft";
import {neuralExerciseDefinition} from "../data/exercises/neural-error-correction";
import {serializeExercise} from "../lib/storage/exerciseSessionCodec";
import type {CourseWorkspace} from "../lib/repositories/CourseRepository";
import {cloneWorkbook} from "../lib/spreadsheet/workbook";

test("Autoria PostgreSQL: migrations, catálogo único, RLS, reabertura, progresso e tentativa preservados",async()=>{
 const db=new PGlite();
 try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',created_at timestamptz default now());create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to authenticated,anon,service_role;`);
  for(const file of ["202610230001_admin_auth_progress.sql","202610230002_teacher_monitoring.sql","202610240001_exercise_attempts.sql","202610240002_course_authoring.sql","202610240003_course_catalog_seed.sql","202610260001_replace_activity_exercise.sql","202610260002_course_versions.sql"])await db.exec(await readFile(`supabase/migrations/${file}`,"utf8"));
  await db.exec(await readFile("supabase/seed.sql","utf8"));
  const teacher="10000000-0000-4000-8000-000000000001",student="10000000-0000-4000-8000-000000000002",other="10000000-0000-4000-8000-000000000003",admin="10000000-0000-4000-8000-000000000004";
  for(const [id,role] of [[teacher,"teacher"],[student,"student"],[other,"teacher"],[admin,"admin"]]) {await db.query("insert into auth.users(id,email) values($1,$2)",[id,`${id}@test.invalid`]);await db.query("insert into public.user_roles(user_id,role) values($1,$2)",[id,role]);}
  const asUser=async(id:string,role="authenticated")=>{await db.exec("reset role");await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec(`set role ${role}`);};
  const load=async()=> (await db.query<{data:CourseWorkspace}>("select public.course_workspace() data")).rows[0].data;
  const write=async(payload:unknown,actor=teacher)=>{await asUser("","service_role");await db.query("select public.save_course_authoring($1,$2)",[actor,JSON.stringify(payload)]);};
  const course=createCourse({title:"Curso de Teste",description:"Descrição",objective:"Objetivo",workload:8,image:{kind:"placeholder",label:"Capa"}}),chapter=createChapter("Capítulo 1");
  chapter.activities=[{id:"a",title:"Lab",type:"spreadsheet-exercise",order:1,required:true,navigationGroup:"laboratory",content:{exerciseId:neuralExerciseDefinition.id,exerciseVersion:neuralExerciseDefinition.version}}];course.chapters=[chapter];
  await write({operation:"save-course",id:course.id,course});await asUser(teacher);expect((await load()).courses[0].createdBy).toBe(teacher);
  await expect(db.query("select public.save_course_authoring($1,$2)",[teacher,JSON.stringify({operation:"archive",id:course.id,course})])).rejects.toThrow();
  await expect(db.query("update public.courses set title='invaded' where id=$1",[course.id])).rejects.toThrow();
  await asUser(other);expect((await load()).courses).toEqual([]);await expect(write({operation:"archive",id:course.id,course},other)).rejects.toThrow("Denied");
  await asUser(admin);expect((await load()).courses.map(c=>c.id)).toEqual(expect.arrayContaining(["neural-demo","neural-pilot","chapter-navigation-demo",course.id]));expect((await load()).exercises).toEqual([]);
  await db.query("select public.admin_command($1)",[JSON.stringify({type:"enroll",userId:student})]);await db.query("select public.admin_command($1)",[JSON.stringify({type:"assign-service",userId:student,serviceId:"00000000-0000-4000-8000-000000000001"})]);
  const service=(await db.query<{id:string}>("select id from public.user_services where user_id=$1",[student])).rows[0].id;
  await expect(db.query("select public.admin_command($1)",[JSON.stringify({type:"grant-course",userServiceId:service,courseId:course.id})])).rejects.toThrow("No published version");
  await asUser(student);expect((await load()).courses).toEqual([]);
  course.status="published";await write({operation:"publish",id:course.id,course});await asUser(admin);await db.query("select public.admin_command($1)",[JSON.stringify({type:"grant-course",userServiceId:service,courseId:course.id})]);await asUser(student);
  expect((await load()).courses[0].chapters[0].activities).toEqual(chapter.activities);expect((await load()).exercises).toEqual([]);await expect(db.exec("select author_draft from public.course_exercises")).rejects.toThrow();
  await db.query("select public.save_student_progress($1,$2,$3,'completed')",[course.id,chapter.id,"a"]);
  const identity={courseId:course.id,chapterId:chapter.id,activityId:"a",exerciseId:neuralExerciseDefinition.id,exerciseVersion:neuralExerciseDefinition.version};
  const state=serializeExercise(neuralExerciseDefinition,{workbook:cloneWorkbook(neuralExerciseDefinition.workbook),activeSheet:"treinamento",selections:{},validation:"never"});state.cells=[{worksheetId:"treinamento",address:"F2",raw:"=1+2"}];
  await db.query("select public.exercise_attempt_operation('save',$1,$2)",[JSON.stringify(identity),JSON.stringify(state)]);
  course.title="Curso de Teste – Versão 2";await expect(write({operation:"save-course",id:course.id,course})).rejects.toThrow("immutable");course.title="Curso de Teste";await asUser(student);expect((await load()).courses[0].title).toBe(course.title);
  expect((await db.query("select * from public.student_progress")).rows).toHaveLength(1);expect((await db.query<{data:{state:{cells:unknown[]}}}>("select public.exercise_attempt_operation('load',$1) data",[JSON.stringify(identity)])).rows[0].data.state.cells).toEqual(state.cells);
  await asUser(teacher);expect((await load()).courses[0].chapters[0].id).toBe(chapter.id);expect((await db.query("select public.teacher_course_progress() data")).rows).toHaveLength(1);
  course.status="archived";await write({operation:"archive",id:course.id,course});await asUser(student);expect((await load()).courses).toEqual([]);await expect(db.query("select public.exercise_attempt_operation('load',$1)",[JSON.stringify(identity)])).rejects.toThrow("Denied");
  await db.exec("reset role");expect((await db.query("select * from public.exercise_attempts")).rows).toHaveLength(1);expect((await db.query("select * from public.student_progress")).rows).toHaveLength(1);
  expect((await db.query("select * from public.courses where id in ('neural-demo','neural-pilot','chapter-navigation-demo')")).rows).toHaveLength(3);
 } finally {await db.close();}
});
