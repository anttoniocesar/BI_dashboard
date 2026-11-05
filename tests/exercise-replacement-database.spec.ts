import {test,expect} from "@playwright/test";
import {PGlite} from "@electric-sql/pglite";
import {readFile} from "node:fs/promises";
import {createCourse,createChapter} from "../lib/studio/courseDraft";
import {neuralExerciseDefinition} from "../data/exercises/neural-error-correction";
import {exerciseManifest} from "../lib/courses/manifest";
import type {CourseWorkspace} from "../lib/repositories/CourseRepository";

test("Substituir PostgreSQL: RPC atômico, autorização, revisão, rollback e histórico preservado",async()=>{
  const db=new PGlite();
  try{
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',created_at timestamptz default now());create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to authenticated,anon,service_role;`);
    for(const file of ["202610230001_admin_auth_progress.sql","202610230002_teacher_monitoring.sql","202610240001_exercise_attempts.sql","202610240002_course_authoring.sql","202610240003_course_catalog_seed.sql","202610260001_replace_activity_exercise.sql"])await db.exec(await readFile(`supabase/migrations/${file}`,"utf8"));
    const teacher="10000000-0000-4000-8000-000000000001",student="10000000-0000-4000-8000-000000000002",other="10000000-0000-4000-8000-000000000003";
    for(const [id,role] of [[teacher,"teacher"],[student,"student"],[other,"teacher"]]){await db.query("insert into auth.users(id,email) values($1,$2)",[id,`${id}@test.invalid`]);await db.query("insert into public.user_roles(user_id,role) values($1,$2)",[id,role]);}
    const asUser=async(id:string,role="authenticated")=>{await db.exec("reset role");await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec(`set role ${role}`);};
    const load=async()=>{await asUser(teacher);return (await db.query<{data:CourseWorkspace}>("select public.course_workspace() data")).rows[0].data;};
    const write=async(payload:unknown)=>{await asUser("","service_role");await db.query("select public.save_course_authoring($1,$2)",[teacher,JSON.stringify(payload)]);};
    for(const id of ["first","second"]){const definition={...structuredClone(neuralExerciseDefinition),id};await write({operation:"save-exercise",exercise:{id,draft:definition,definition},definition,manifest:exerciseManifest(definition)});}
    const course=createCourse({title:"Substituição isolada",description:"Desc",objective:"Objetivo",workload:1,image:{kind:"placeholder",label:"Capa"}}),chapter=createChapter("Capítulo");
    chapter.activities=[{id:"lab",title:"Lab",type:"spreadsheet-exercise",required:true,order:1,content:{exerciseId:"first",exerciseVersion:neuralExerciseDefinition.version}}];course.chapters=[chapter];
    await write({operation:"save-course",id:course.id,course});
    await db.exec("reset role");
    await db.query("insert into public.published_lab_activities values($1,$2,'lab','first',$3,'[]','{}')",[course.id,chapter.id,neuralExerciseDefinition.version]);
    await db.query("insert into public.exercise_attempts(user_id,course_id,chapter_id,activity_id,exercise_id,exercise_version,state) values($1,$2,$3,'lab','first',$4,$5)",[student,course.id,chapter.id,neuralExerciseDefinition.version,JSON.stringify({cells:[{raw:"=42"}]})]);
    await db.query("insert into public.student_progress(user_id,course_id,chapter_id,activity_id,status) values($1,$2,$3,'lab','in-progress')",[student,course.id,chapter.id]);
    const history=async()=>{await db.exec("reset role");return {attempts:(await db.query("select * from public.exercise_attempts")).rows,progress:(await db.query("select * from public.student_progress")).rows,published:(await db.query("select * from public.published_lab_activities")).rows};};
    const originalHistory=await history(),before=(await load()).courses.find(c=>c.id===course.id)!;
    const payload={operation:"replace-activity-exercise",id:course.id,chapterId:chapter.id,activityId:"lab",previousExerciseId:"first",previousExerciseVersion:neuralExerciseDefinition.version,nextExerciseId:"second",nextExerciseVersion:neuralExerciseDefinition.version,expectedUpdatedAt:before.updatedAt};
    await expect(db.query("select public.replace_activity_exercise($1,$2)",[teacher,JSON.stringify(payload)])).rejects.toThrow();
    const replace=async(value:unknown,actor=teacher)=>{await asUser("","service_role");return db.query("select public.replace_activity_exercise($1,$2)",[actor,JSON.stringify(value)]);};
    await expect(replace(payload,other)).rejects.toThrow("Denied");
    await expect(replace({...payload,nextExerciseId:"missing"})).rejects.toThrow("Exercise not found");
    expect((await load()).courses.find(c=>c.id===course.id)!.chapters[0].activities[0].content).toHaveProperty("exerciseId","first");
    await replace(payload);
    const after=(await load()).courses.find(c=>c.id===course.id)!;
    expect(after.chapters[0].activities[0]).toEqual({...before.chapters[0].activities[0],navigationGroup:null,content:{exerciseId:"second",exerciseVersion:neuralExerciseDefinition.version}});
    expect(after.updatedAt).not.toBe(before.updatedAt);
    await expect(replace(payload)).rejects.toThrow("Course revision changed");
    expect(await history()).toEqual(originalHistory);
    await write({operation:"publish",id:course.id,course:{...after,status:"published"}});
    const published=(await load()).courses.find(c=>c.id===course.id)!;
    await expect(replace({...payload,expectedUpdatedAt:published.updatedAt,previousExerciseId:"second",nextExerciseId:"first"})).rejects.toThrow("Preserve published activities");
    expect((await history()).attempts).toEqual(originalHistory.attempts);expect((await history()).progress).toEqual(originalHistory.progress);
  }finally{await db.close();}
});
