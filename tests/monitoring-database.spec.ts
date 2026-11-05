import { test,expect } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import type { MonitoringCourseData } from "../types/monitoring";

test("Monitoramento PostgreSQL: RPC, escopo docente, privacidade, status e revogação reais",async()=>{
  const db=new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
      create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',created_at timestamptz default now());
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to authenticated,anon,service_role;`);
    for(const file of ["202610230001_admin_auth_progress.sql","202610230002_teacher_monitoring.sql"]) await db.exec(await readFile(`supabase/migrations/${file}`,"utf8"));
    await db.exec(await readFile("supabase/seed.sql","utf8"));
    const ids=Array.from({length:5},(_,index)=>`50000000-0000-4000-8000-00000000000${index+1}`);
    const [teacher,otherTeacher,student,otherStudent,admin]=ids;
    for(const [index,id] of ids.entries()) {await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)",[id,`private${index}@example.com`,JSON.stringify({name:`Pessoa ${index}`})]);await db.query("insert into public.user_roles(user_id,role) values($1,$2)",[id,index<2?"teacher":index===4?"admin":"student"]);}
    await db.query("insert into public.course_teachers(user_id,course_id) values($1,'neural-demo'),($2,'other-course')",[teacher,otherTeacher]);
    for(const [index,id] of [student,otherStudent].entries()) {
      await db.query("insert into public.enrollments(user_id,registration_code) values($1,$2)",[id,`20270000${index+1}`]);
      const link=(await db.query<{id:string}>("insert into public.user_services(user_id,service_id) values($1,'00000000-0000-4000-8000-000000000001') returning id",[id])).rows[0].id;
      await db.query("insert into public.course_access(user_service_id,course_id) values($1,$2)",[link,index===0?"neural-demo":"other-course"]);
    }
    const asUser=async(id:string)=>{await db.exec("reset role");await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec("set role authenticated");};
    const report=async(course:string|null=null,studentId:string|null=null)=>(await db.query<{data:MonitoringCourseData[]}>("select public.teacher_course_progress($1,$2::uuid) data",[course,studentId])).rows[0].data;
    await asUser(student);await db.exec("select public.save_student_progress('neural-demo','fundamentos','intro-video','completed')");
    await expect(report()).rejects.toThrow();
    await asUser(teacher);const data=await report();expect(data).toHaveLength(1);expect(data[0].courseId).toBe("neural-demo");expect(data[0].students.map(item=>item.userId)).toEqual([student]);
    expect(data[0].students[0].rows).toHaveLength(1);expect(data[0].students[0].rows[0].completed_at).toBeTruthy();
    const serialized=JSON.stringify(data);for(const field of ["email","roles","userServices","other-course","private2@example.com","snapshot"])expect(serialized).not.toContain(field);
    expect((await db.query("select * from public.student_progress")).rows).toHaveLength(0); // no broad teacher RLS
    expect((await db.query("select * from public.enrollments")).rows).toHaveLength(0);
    await expect(report("other-course")).rejects.toThrow();await expect(report("neural-demo",otherStudent)).rejects.toThrow();
    expect((await report("neural-demo",student))[0].students).toHaveLength(1);
    await asUser(admin);await expect(report()).rejects.toThrow();
    await db.exec("reset role");await db.query("insert into public.user_roles(user_id,role) values($1,'teacher')",[admin]);
    await asUser(admin);expect(await report()).toEqual([]);await expect(report("neural-demo")).rejects.toThrow();
    await db.exec("reset role");await db.query("update public.user_services set status='inactive' where user_id=$1",[student]);
    await asUser(teacher);expect((await report("neural-demo"))[0].students).toEqual([]);
    await db.exec("reset role");await db.query("update public.user_services set status='active' where user_id=$1",[student]);await db.query("delete from public.course_access where course_id='neural-demo'");
    await asUser(teacher);expect((await report("neural-demo"))[0].students).toEqual([]);
    await db.exec("reset role");await db.query("update public.profiles set status='inactive' where id=$1",[teacher]);
    await asUser(teacher);await expect(report()).rejects.toThrow();
    await db.exec("reset role;set role anon");await expect(report()).rejects.toThrow();
  } finally {await db.close();}
});
