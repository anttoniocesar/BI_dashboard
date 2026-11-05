import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFile, readdir } from "node:fs/promises";
import { resolveDataConfiguration } from "../lib/data/config";
import { createAdminFixtures } from "../data/admin/demo";
import { InMemoryAdminRepository } from "../lib/repositories/InMemoryAdminRepository";
import { InMemoryLearnRepository } from "../lib/repositories/InMemoryLearnRepository";
import { SupabaseAdminRepository } from "../lib/repositories/SupabaseAdminRepository";
import { SupabaseLearnRepository } from "../lib/repositories/SupabaseLearnRepository";
import { ProgressQueue } from "../lib/repositories/ProgressQueue";
import { DemoAuthAdapter } from "../lib/auth/DemoAuthAdapter";
import { SupabaseAuthAdapter } from "../lib/auth/SupabaseAuthAdapter";
import { authStorageKey } from "../lib/auth/demo-auth";
import { apiResponse,adminRequest,learnRequest,type AuthorizedContext } from "../lib/server/api";
import { DataError } from "../lib/data/http";
import { parseAdminCommand,parseLogin,parseProgress } from "../lib/data/validation";

test("Persistência: modo explícito, fallback sem configuração e erro para configuração parcial", () => {
  expect(resolveDataConfiguration({}).mode).toBe("demo");
  expect(resolveDataConfiguration({mode:"demo",url:"https://example.supabase.co",anonKey:"public"})).toMatchObject({mode:"demo",url:"",anonKey:"",error:null});
  expect(resolveDataConfiguration({url:"https://example.supabase.co",anonKey:"public"})).toMatchObject({mode:"supabase",error:null});
  for(const config of [{mode:"supabase"},{url:"https://example.supabase.co"},{url:"javascript:alert(1)",anonKey:"key"},{mode:"unknown"}]) expect(resolveDataConfiguration(config).error).not.toBeNull();
});
test("Persistência: InMemoryAdminRepository conserva contratos, roles, matrícula e cópias", async () => {
  const repo=new InMemoryAdminRepository();
  expect(await repo.listUsers()).toHaveLength(3);
  await repo.assignRole("student-cesar","teacher","admin-demo");
  expect((await repo.getUser("student-cesar"))?.roles).toEqual(["student","teacher"]);
  await repo.removeRole("student-cesar","teacher","admin-demo");
  await repo.revokeCourseAccess("service-cesar","neural-demo","admin-demo");
  await repo.grantCourseAccess("service-cesar","neural-demo","admin-demo",["neural-demo"]);
  expect(await repo.listEnrollments()).toHaveLength(1);
  const snapshot=await repo.load(); snapshot.users[0].name="Mutação externa";
  expect((await repo.getUser("admin-demo"))?.name).not.toBe("Mutação externa");
  await expect(repo.updateUserService("service-cesar","inactive","student-cesar")).rejects.toThrow("sem permissão");
});
test("Persistência: LearnRepository isola usuários, conserva conclusão e registra posição", async () => {
  const state=createAdminFixtures(); const repo=new InMemoryLearnRepository(()=>state,"student-cesar");
  await repo.saveProgress({courseId:"neural-demo",chapterId:"fundamentos",activityId:"intro-video",status:"completed"});
  await repo.saveProgress({courseId:"neural-demo",chapterId:"fundamentos",activityId:"intro-video",status:"in-progress"});
  expect((await repo.getProgress())["neural-demo"].completedActivities).toEqual(["intro-video"]);
  expect((await repo.getStudentIdentity())?.enrollment).toBe("202700184");
  expect(await repo.getReleasedCourses()).toContain("neural-demo");
  expect(await new InMemoryLearnRepository(()=>state,"teacher-neural").getProgress()).toEqual({});
  state.userServices[0].status="inactive";
  await expect(repo.saveProgress({courseId:"neural-demo",chapterId:"fundamentos",activityId:"intro-text",status:"completed"})).rejects.toThrow("Curso não liberado");
});
test("Persistência: adapters de Auth mantêm DTO separado e resolvem falhas remotas sem demo implícito", async () => {
  const values=new Map<string,string>();
  const adapter=new DemoAuthAdapter(createAdminFixtures,()=>({getItem:key=>values.get(key)??null,setItem:(key,value)=>{values.set(key,value);},removeItem:key=>{values.delete(key);}}));
  const authenticated=await adapter.login("202700184","demo123");
  expect((await adapter.restore()).session).toEqual(authenticated.session);
  expect(Object.keys(JSON.parse(values.get(authStorageKey)!)).sort()).toEqual(["authenticatedAt","userId"]);
  await adapter.logout(); expect((await adapter.restore()).session).toBeNull();
  const original=globalThis.fetch; const calls:{path:string;body:unknown}[]=[];
  try {
    globalThis.fetch=async(input,init)=>{calls.push({path:String(input),body:init?.body?JSON.parse(String(init.body)):null}); return Response.json(authenticated);};
    const remote=new SupabaseAuthAdapter(); expect((await remote.login("cesar@example.com"," secret ")).session?.userId).toBe("student-cesar");
    expect(calls[0]).toEqual({path:"/api/auth/login",body:{identifier:"cesar@example.com",password:" secret "}});
    globalThis.fetch=async()=>Response.json({error:"Entre novamente."},{status:401}); expect((await remote.restore()).session).toBeNull();
    globalThis.fetch=async()=>Response.json({error:"Indisponível."},{status:503}); await expect(remote.restore()).rejects.toThrow("Indisponível");
  } finally { globalThis.fetch=original; }
});
test("Persistência: SDK Supabase real usa RPCs e não envia ator arbitrário ou usuário no progresso", async () => {
  const state=createAdminFixtures(); const requests:{path:string;body:Record<string,unknown>}[]=[];
  const client=createClient("http://localhost:59999","anon-test",{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(input,init)=>{
    const path=new URL(String(input)).pathname; const body=init?.body?JSON.parse(String(init.body)):{}; requests.push({path,body});
    if(path.endsWith("app_snapshot"))return Response.json(state);
    if(path.endsWith("student_progress"))return Response.json([{course_id:"neural-demo",chapter_id:"fundamentos",activity_id:"intro-video",status:"completed",updated_at:"2026-10-23T12:00:00Z"}]);
    if(path.endsWith("course_teacher_names"))return Response.json([{courseId:"neural-demo",name:"Professor Neural"}]);
    return Response.json(null);
  }}});
  const admin=new SupabaseAdminRepository(client);
  expect(await admin.listUsers()).toHaveLength(3);
  await admin.execute({type:"revoke-course",userServiceId:"service-cesar",courseId:"neural-demo"});
  const learn=new SupabaseLearnRepository(client,state,"student-cesar");
  expect((await learn.getProgress())["neural-demo"].completedActivities).toEqual(["intro-video"]);
  await learn.saveProgress({courseId:"neural-demo",chapterId:"fundamentos",activityId:"intro-text",status:"completed"});
  const write=requests.find(item=>item.path.endsWith("save_student_progress"))!;
  expect(write.body).toEqual({course:"neural-demo",chapter:"fundamentos",activity:"intro-text",progress_status:"completed"});
  expect(requests.find(item=>item.path.endsWith("admin_command"))?.body).not.toHaveProperty("actorId");
  const another=new SupabaseLearnRepository(client,state,"student-cesar"); expect(await another.getProgress()).toEqual(await learn.getProgress());
});
test("Persistência: erro PostgreSQL é convertido, e criação Auth falha com compensação", async () => {
  const deleted:string[]=[];
  const client=createClient("http://localhost:59999","anon-test",{auth:{persistSession:false},global:{fetch:async()=>Response.json({code:"23505",message:"PRIVATE_DATABASE_DETAILS"},{status:409})}});
  const privileged={auth:{admin:{createUser:async()=>({data:{user:{id:"created-id"}},error:null}),deleteUser:async(id:string)=>{deleted.push(id); return {error:null};}}}} as unknown as SupabaseClient;
  const repo=new SupabaseAdminRepository(client,privileged);
  await expect(repo.execute({type:"create-user",id:"ignored",name:"Nova",email:"nova@example.com",roles:["student"],status:"active",createdAt:new Date().toISOString()})).rejects.toThrow("já existe");
  expect(deleted).toEqual(["created-id"]);
  const response=await apiResponse(()=>repo.load()); expect(JSON.stringify(await response.json())).not.toContain("PRIVATE_DATABASE_DETAILS");
});
test("Persistência: schemas rejeitam campos extras, enum, email, IDs e tipos inválidos", () => {
  for(const input of [null,[],{type:"owner"},{type:"revoke-course",userServiceId:"not-uuid",courseId:"neural-demo"},{type:"revoke-course",userServiceId:"10000000-0000-4000-8000-000000000001",courseId:"neural-demo",actorId:"admin-demo"}]) expect(()=>parseAdminCommand(input)).toThrow();
  expect(()=>parseProgress({userId:"other",courseId:"neural-demo",chapterId:"fundamentos",activityId:"intro",status:"completed"})).toThrow();
  expect(parseLogin({identifier:" cesar@example.com ",password:" secret "})).toEqual({identifier:"cesar@example.com",password:" secret "});
});
test("Persistência: APIs recusam sessão ausente, perfil sem permissão e payload antes de escrever", async () => {
  const state=createAdminFixtures(); const repo=new InMemoryAdminRepository();
  let writes=0;
  const makeContext=(id:string):AuthorizedContext=>({state,user:state.users.find(user=>user.id===id)!,admin:repo,learn:{...new InMemoryLearnRepository(()=>state,id),load:async()=>({identity:null,courseIds:[],progress:{},teachers:[]}),getStudentIdentity:async()=>null,getReleasedCourses:async()=>[],getProgress:async()=>({}),saveProgress:async()=>{writes++;}}});
  const post=(body:unknown)=>new Request("http://localhost/api/admin/session",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const noSession=await apiResponse(()=>adminRequest(post({}),async()=>{throw new DataError("Entre.",401);})); expect(noSession.status).toBe(401);
  const noPermission=await apiResponse(()=>adminRequest(post({}),async()=>makeContext("student-cesar"))); expect(noPermission.status).toBe(403);
  const invalid=await apiResponse(()=>adminRequest(post({type:"unknown"}),async()=>makeContext("admin-demo"))); expect(invalid.status).toBe(400);
  const spoofed=await apiResponse(()=>learnRequest(post({userId:"other",courseId:"neural-demo",chapterId:"fundamentos",activityId:"intro",status:"completed"}),async()=>makeContext("student-cesar"))); expect(spoofed.status).toBe(400);
  const denied=await apiResponse(()=>learnRequest(post({courseId:"not-granted",chapterId:"fundamentos",activityId:"intro",status:"completed"}),async()=>makeContext("student-cesar"))); expect(denied.status).toBe(403);
  const allowed=await apiResponse(()=>learnRequest(post({courseId:"neural-demo",chapterId:"fundamentos",activityId:"intro-video",status:"completed"}),async()=>makeContext("student-cesar"))); expect(allowed.status).toBe(200); expect(writes).toBe(1);
  const changed=post({courseId:"neural-demo",chapterId:"fundamentos",activityId:"intro-video",status:"completed"}); changed.headers.set("X-Expected-User","previous-user");
  expect((await apiResponse(()=>learnRequest(changed,async()=>makeContext("student-cesar")))).status).toBe(409); expect(writes).toBe(1);
  const external=post({}); external.headers.set("origin","https://evil.example"); expect((await apiResponse(()=>adminRequest(external,async()=>makeContext("admin-demo")))).status).toBe(403);
});
test("Persistência: fila mantém retry e não envia pendências com cookies de outro usuário", async () => {
  const repo=new InMemoryLearnRepository(createAdminFixtures,"student-cesar"); let active=true; let fail=true; let count=0; const statuses:string[]=[];
  repo.saveProgress=async()=>{count++; if(fail)throw new Error("offline");};
  const queue=new ProgressQueue(repo,()=>active,status=>statuses.push(status));
  queue.enqueue({courseId:"neural-demo",chapterId:"fundamentos",activityId:"intro-video",status:"completed"}); await queue.flush(); expect(count).toBe(1);
  active=false; fail=false; await queue.flush(); expect(count).toBe(1);
  active=true; await queue.flush(); expect(count).toBe(2); expect(statuses.at(-1)).toBe("Progresso salvo.");
});
test("Persistência: fronteira server-only e bundles públicos não contêm service role", async () => {
  const browser=await readFile("lib/supabase/client.ts","utf8"); const server=await readFile("lib/supabase/server.ts","utf8");
  expect(browser).not.toContain("SUPABASE_SERVICE_ROLE_KEY"); expect(server).toContain('import "server-only"');
  let files:string[]=[];
  try { files=(await readdir(".next/static/chunks",{recursive:true})).filter(file=>file.endsWith(".js")); } catch { /* Development layout uses a different folder; source boundary still applies. */ }
  for(const file of files) expect(await readFile(`.next/static/chunks/${file}`,"utf8")).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
});
test("Persistência: rotas HTTP reais recusam AuthSession local como credencial de servidor", async ({ request }) => {
  for(const path of ["/api/admin/session","/api/learn/session"]) {
    const response=await request.get(path,{headers:{"x-user-id":"admin-demo",cookie:`bi-society:demo-auth-session:v1=forged`}});
    expect(response.status()).toBe(401); expect(response.headers()["cache-control"]).toContain("no-store");
  }
});
