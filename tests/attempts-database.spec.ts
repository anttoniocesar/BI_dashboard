import { test, expect } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
test("Tentativas PostgreSQL: identidade, RLS, versão, reset e inputs privados", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',created_at timestamptz default now());
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to authenticated,anon,service_role;`);
    for (const file of ["202610230001_admin_auth_progress.sql", "202610240001_exercise_attempts.sql"]) await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
    await db.exec(await readFile("supabase/seed.sql", "utf8"));
    const admin = "10000000-0000-4000-8000-000000000001", student = "10000000-0000-4000-8000-000000000002", other = "10000000-0000-4000-8000-000000000003", teacher = "10000000-0000-4000-8000-000000000004";
    for (const [id, role] of [[admin, "admin"], [student, "student"], [other, "student"], [teacher, "teacher"]]) {
      await db.query("insert into auth.users(id,email) values($1,$2)", [id, `${role}${id}@example.com`]); await db.query("insert into public.user_roles(user_id,role) values($1,$2)", [id, role]);
    }
    const as = async (id: string) => { await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]); await db.exec("set role authenticated"); };
    const command = async (body: unknown) => db.query("select public.admin_command($1::jsonb)", [JSON.stringify(body)]);
    await as(admin); for (const id of [student, other]) {
      await command({ type: "enroll", userId: id }); await command({ type: "assign-service", userId: id, serviceId: "00000000-0000-4000-8000-000000000001" });
      const link = (await db.query<{ id: string }>("select id from public.user_services where user_id=$1", [id])).rows[0].id;
      await command({ type: "grant-course", userServiceId: link, courseId: "neural-demo" });
    }
    const identity = { courseId: "neural-demo", chapterId: "fundamentos", activityId: "fundamentos-lab-1", exerciseId: "neural-error-correction", exerciseVersion: "1.0" };
    const state = { version: 1, exerciseId: identity.exerciseId, exerciseVersion: "1.0", cells: [{ worksheetId: "treinamento", address: "F2", raw: "=Dados!$B$10*B2" }], activeSheet: "treinamento", selections: {}, validation: "never", lastSavedAt: new Date().toISOString() };
    const operation = (op: string, target = identity, saved: unknown = null) => db.query<{ result: { state: typeof state | null } }>("select public.exercise_attempt_operation($1,$2::jsonb,$3::jsonb) result", [op, JSON.stringify(target), saved === null ? null : JSON.stringify(saved)]);
    await as(student); await operation("save", identity, state);
    expect((await operation("load")).rows[0].result.state?.cells[0].raw).toBe("=Dados!$B$10*B2");
    const second = { ...identity, activityId: "fundamentos-lab-2" };
    expect((await operation("load", second)).rows[0].result.state).toBeNull(); await operation("save", second, state);
    await expect(operation("save", { ...identity, exerciseVersion: "2.0" }, state)).rejects.toThrow();
    await db.exec("reset role; insert into public.published_lab_activities select course_id,chapter_id,activity_id,exercise_id,'2.0',allowed_cells,sheets from public.published_lab_activities where course_id='neural-demo' and activity_id='fundamentos-lab-1'");
    await as(student);
    await operation("save", { ...identity, exerciseVersion: "2.0" }, { ...state, exerciseVersion: "2.0", cells: [{ worksheetId: "treinamento", address: "F2", raw: "=456" }] });
    expect((await operation("load")).rows[0].result.state?.cells[0].raw).toBe("=Dados!$B$10*B2");
    for (const invalid of [{ ...state, expected: "secret" }, { ...state, cells: [{ worksheetId: "dados", address: "B2", raw: "secret" }] }, { ...state, cells: [{ worksheetId: null, address: "B2", raw: "secret" }] }]) await expect(operation("save", identity, invalid)).rejects.toThrow();
    await operation("clear"); expect((await operation("load")).rows[0].result.state).toBeNull(); expect((await operation("load", second)).rows[0].result.state).not.toBeNull();
    await expect(db.exec("delete from public.exercise_attempts")).rejects.toThrow();
    await as(other); expect((await db.query("select * from public.exercise_attempts")).rows).toHaveLength(0); expect((await operation("load", second)).rows[0].result.state).toBeNull();
    for (const id of [admin, teacher]) { await as(id); expect((await db.query("select * from public.exercise_attempts")).rows).toHaveLength(0); await expect(operation("load")).rejects.toThrow(); }
    await db.exec("reset role;set role anon"); await expect(operation("load")).rejects.toThrow();
  } finally { await db.close(); }
});
