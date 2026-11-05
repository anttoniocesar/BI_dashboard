import { test, expect } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

test("PostgreSQL: migration real, RLS, RPCs, matrícula, revogação, progresso e isolamento", async () => {
  const db=new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',created_at timestamptz default now());
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to authenticated,anon,service_role;`);
    await db.exec(await readFile("supabase/migrations/202610230001_admin_auth_progress.sql","utf8"));
    await db.exec(await readFile("supabase/seed.sql","utf8"));
    const admin="10000000-0000-4000-8000-000000000001", student="10000000-0000-4000-8000-000000000002", teacher="10000000-0000-4000-8000-000000000003", other="10000000-0000-4000-8000-000000000004";
    for(const [id,name,role] of [[admin,"Admin","admin"],[student,"César","student"],[teacher,"Professor","teacher"],[other,"Outro","student"]]) {
      await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)",[id,`${name}@example.com`,JSON.stringify({name,roles:["admin"]})]);
      expect((await db.query("select * from public.user_roles where user_id=$1",[id])).rows).toHaveLength(0);
      await db.query("insert into public.user_roles(user_id,role) values($1,$2)",[id,role]);
    }
    const asUser=async(id:string) => { await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]); await db.exec("set role authenticated"); };
    const rpc=async(command:unknown) => db.query("select public.admin_command($1::jsonb)",[JSON.stringify(command)]);
    await asUser(admin);
    expect((await db.query("select * from public.profiles")).rows).toHaveLength(4);
    await rpc({type:"enroll",userId:student}); await rpc({type:"enroll",userId:other});
    const registrations=(await db.query<{registration_code:string}>("select registration_code from public.enrollments")).rows;
    expect(registrations).toHaveLength(2); expect(new Set(registrations.map(item=>item.registration_code)).size).toBe(2);
    await rpc({type:"assign-service",userId:student,serviceId:"00000000-0000-4000-8000-000000000001"});
    const link=(await db.query<{id:string}>("select id from public.user_services where user_id=$1",[student])).rows[0].id;
    await rpc({type:"grant-course",userServiceId:link,courseId:"neural-demo"});
    await rpc({type:"assign-teacher",userId:teacher,courseId:"neural-demo"});
    await asUser(student);
    expect((await db.query("select * from public.profiles")).rows).toHaveLength(1);
    expect((await db.query("select * from public.enrollments")).rows).toHaveLength(1);
    const snapshot=(await db.query<{state:{users:{id:string}[]}}>("select public.app_snapshot() state")).rows[0].state;
    expect(snapshot.users.map(item=>item.id)).toEqual([student]);
    await expect(rpc({type:"enroll",userId:student})).rejects.toThrow();
    await expect(db.exec("insert into public.user_roles(user_id,role) values(auth.uid(),'admin')")).rejects.toThrow();
    await db.exec("select public.save_student_progress('neural-demo','fundamentos','intro-video','completed')");
    await db.exec("select public.save_student_progress('neural-demo','fundamentos','intro-video','in-progress')");
    expect((await db.query<{status:string}>("select status from public.student_progress")).rows[0].status).toBe("completed");
    await expect(db.exec("select public.save_student_progress('not-granted','fundamentos','intro','completed')")).rejects.toThrow();
    await asUser(other); expect((await db.query("select * from public.student_progress")).rows).toHaveLength(0);
    expect((await db.query("select * from public.course_access")).rows).toHaveLength(0);
    await asUser(teacher); expect((await db.query("select * from public.course_teachers")).rows).toHaveLength(1);
    expect((await db.query("select * from public.enrollments")).rows).toHaveLength(0);
    await expect(rpc({type:"grant-course",userServiceId:link,courseId:"other"})).rejects.toThrow();
    await asUser(admin); await rpc({type:"revoke-course",userServiceId:link,courseId:"neural-demo"});
    await asUser(student); await expect(db.exec("select public.save_student_progress('neural-demo','fundamentos','next','completed')")).rejects.toThrow();
    await asUser(admin); await rpc({type:"update-user",userId:student,name:"César",status:"inactive",roles:["student"]});
    await asUser(student); expect((await db.query("select * from public.profiles")).rows).toHaveLength(0);
    await expect(db.exec("select public.app_snapshot()")).rejects.toThrow();
    await db.exec("reset role; set role anon"); await expect(db.exec("select public.app_snapshot()")).rejects.toThrow();
    await expect(db.exec("select * from public.profiles")).rejects.toThrow();
  } finally { await db.close(); }
});
