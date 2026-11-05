import { test, expect, chromium } from "@playwright/test";
import { createServer } from "node:http";
import { spawn, type ChildProcess } from "node:child_process";
import { cp, mkdir, mkdtemp, rm, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { createAdminFixtures } from "../data/admin/demo";
import { applyAdminCommand, releasedCourseIds } from "../lib/admin/session";
import { requireCourseAccess } from "../lib/auth/access";
import type { AdminState } from "../types/admin";
import { InMemoryMonitoringRepository } from "../lib/repositories/InMemoryMonitoringRepository";
import type { ProgressRow } from "../lib/repositories/LearnRepository";
import { createInitialWorkbook } from "../data/neural-network-demo";
import {canonicalWorkspace} from "./fixtures/course-workspace";
import {applyCourseOperation,visibleWorkspace} from "../lib/courses/authoring";
import type {CourseOperation} from "../lib/repositories/CourseRepository";

test("Supabase UI controlado: servidor, cookies, Admin, matrícula, refresh e progresso persistente", async ({ page, request }) => {
  test.setTimeout(180000); // Isolated production build + local controlled Auth/PostgREST, no internet.
  const workspace=process.cwd(); const toolsRoot=path.resolve(workspace,".tools"); await mkdir(toolsRoot,{recursive:true});
  const project=await mkdtemp(path.join(toolsRoot,"supabase-ui-"));
  let application:ChildProcess|undefined; let build:ChildProcess|undefined;
  let state=createAdminFixtures();
  let authoring=canonicalWorkspace();
  const admin="20000000-0000-4000-8000-000000000001", teacher="20000000-0000-4000-8000-000000000002", student="20000000-0000-4000-8000-000000000003";
  const ids:Record<string,string>={"admin-demo":admin,"teacher-neural":teacher,"student-cesar":student,"enrollment-cesar":"30000000-0000-4000-8000-000000000001","standalone-course":"30000000-0000-4000-8000-000000000002","service-cesar":"30000000-0000-4000-8000-000000000003"};
  state=JSON.parse(JSON.stringify(state,(key,value)=>["id","userId","userServiceId","serviceId"].includes(key)&&typeof value==="string"&&ids[value]?ids[value]:value));
  const tokens=new Map<string,string>(); const progress=new Map<string,Record<string,string>>();
  const provisionedPasswords=new Map<string,string>();
  const pendingAccounts=new Map<string,{id:string;email:string;name:string;createdAt:string}>();
  const savedAttempts=new Map<string,unknown>();
  const recoveryTokens=new Map<string,string>();
  const receivedKeys:string[]=[];
  const authUser=(id:string)=>{const user=state.users.find(item=>item.id===id)??pendingAccounts.get(id)!;return {id,email:user.email,created_at:user.createdAt,last_sign_in_at:user.createdAt,aud:"authenticated",role:"authenticated",app_metadata:{},user_metadata:{name:user.name}};};
  const snapshot=(id:string):AdminState=>{
    const user=state.users.find(item=>item.id===id)!; if(user.roles.includes("admin"))return structuredClone(state);
    const links=state.userServices.filter(item=>item.userId===id);
    return {users:[structuredClone(user)],enrollments:state.enrollments.filter(item=>item.userId===id),services:state.services.filter(service=>links.some(link=>link.serviceId===service.id)),userServices:links,courseAccess:state.courseAccess.filter(item=>links.some(link=>link.id===item.userServiceId)),courseTeachers:state.courseTeachers.filter(item=>item.userId===id)};
  };
  const backend=createServer(async(req,res)=>{
    try {
      const url=new URL(req.url!,"http://localhost"); let raw=""; for await(const chunk of req) raw+=chunk.toString(); const body=raw?JSON.parse(raw):{};
      const bearer=String(req.headers.authorization??"").replace(/^Bearer /,""); const actor=tokens.get(bearer);
      receivedKeys.push(bearer);
      const send=(value:unknown,status=200)=>{res.writeHead(status,{"Content-Type":"application/json"});res.end(JSON.stringify(value));};
      const issueToken=(id:string)=>{
        const token=Buffer.from(JSON.stringify({alg:"HS256",typ:"JWT"})).toString("base64url")+"."+Buffer.from(JSON.stringify({sub:id,exp:Math.floor(Date.now()/1000)+3600,role:"authenticated",aud:"authenticated"})).toString("base64url")+".signature";
        tokens.set(token,id);return {access_token:token,refresh_token:"refresh-test",token_type:"bearer",expires_in:3600,user:authUser(id)};
      };
      if(url.pathname==="/auth/v1/recover") { recoveryTokens.set(body.email,crypto.randomUUID().replaceAll("-",""));return send({}); }
      if(url.pathname==="/auth/v1/verify") {
        const email=[...recoveryTokens].find(([,token])=>token===body.token_hash)?.[0];
        const account=state.users.find(user=>user.email===email);
        if(!email || !account || body.type!=="recovery")return send({msg:"Invalid token"},400);
        recoveryTokens.delete(email);return send(issueToken(account.id));
      }
      if(url.pathname==="/auth/v1/token") {
        const user=state.users.find(item=>item.email===body.email);
        if(!user || body.password!==(provisionedPasswords.get(user.id)??([admin,teacher,student].includes(user.id)?"controlled-password":undefined)))return send({msg:"Invalid login credentials",code:"invalid_credentials"},400);
        const token=Buffer.from(JSON.stringify({alg:"HS256",typ:"JWT"})).toString("base64url")+"."+Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600,role:"authenticated",aud:"authenticated"})).toString("base64url")+".signature";
        tokens.set(token,user.id);return send({access_token:token,refresh_token:"refresh-test",token_type:"bearer",expires_in:3600,user:authUser(user.id)});
      }
      if(url.pathname==="/auth/v1/admin/users" && req.method==="POST") {
        if(bearer!=="server-role-controlled-marker")return send({},403);
        // Auth creates the account; the following real repository RPC configures roles.
        if("password" in body) return send({message:"Unexpected automatic password"},400);
        const id=crypto.randomUUID();pendingAccounts.set(id,{id,email:body.email,name:body.user_metadata.name,createdAt:new Date().toISOString()});
        return send(authUser(id));
      }
      if(url.pathname==="/auth/v1/admin/users" && req.method==="GET") { if(bearer!=="server-role-controlled-marker")return send({},403);return send({users:state.users.slice(0,1).map(user=>authUser(user.id)),aud:"authenticated"}); }
      if(url.pathname==="/rest/v1/published_lab_activities") { if(bearer!=="server-role-controlled-marker")return send({},403);return send([{course_id:"neural-demo"}]); }
      if(url.pathname==="/rest/v1/courses") {if(bearer!=="server-role-controlled-marker")return send({},403);return send(authoring.courses.filter(c=>c.status==="published").slice(0,1).map(c=>({id:c.id})));}
      if(url.pathname.startsWith("/auth/v1/admin/users/")) { if(bearer!=="server-role-controlled-marker")return send({},403); return send(authUser(url.pathname.split("/").at(-1)!)); }
      if(url.pathname==="/rest/v1/enrollments") {
        if(bearer!=="server-role-controlled-marker")return send({},403);
        const code=url.searchParams.get("registration_code")?.replace(/^eq\./,""); const entry=state.enrollments.find(item=>item.registrationCode===code&&item.status==="active");
        return send(entry?{user_id:entry.userId}:null);
      }
      if(url.pathname==="/auth/v1/logout") {res.writeHead(204);res.end();return;}
      if(url.pathname.endsWith("/create_course_revision")){
        if(bearer!=="server-role-controlled-marker")return send({code:"42501"},403);
        const user=state.users.find(u=>u.id===body.actor);if(!user)return send({code:"42501"},403);
        try{
          const next=applyCourseOperation(authoring,{operation:"create-course-revision",sourceCourseId:body.payload.sourceCourseId,expectedUpdatedAt:body.payload.expectedUpdatedAt},user,state);
          const revision=next.courses.find(c=>c.status==="draft"&&c.basedOnCourseId===body.payload.sourceCourseId)!;revision.id=body.payload.newCourseId;authoring=next;state.courseTeachers.push({userId:user.id,courseId:revision.id});return send(revision.id);
        }catch{return send({code:"23505"},409);}
      }
      if(url.pathname.endsWith("/replace_activity_exercise")) {
        if(bearer!=="server-role-controlled-marker")return send({code:"42501"},403);
        const user=state.users.find(u=>u.id===body.actor);if(!user)return send({code:"42501"},403);
        try {authoring=applyCourseOperation(authoring,body.payload as CourseOperation,user,state);return send(null);}
        catch {return send({code:"40001"},409);}
      }
      if(url.pathname.endsWith("/save_course_authoring")) {
        if(bearer!=="server-role-controlled-marker")return send({code:"42501"},403);
        const user=state.users.find(u=>u.id===body.actor);if(!user)return send({code:"42501"},403);
        authoring=applyCourseOperation(authoring,body.payload as CourseOperation,user,state,[...progress.values()].map(row=>row.course_id));
        if(body.payload.course && !state.courseTeachers.some(t=>t.userId===user.id&&t.courseId===body.payload.id))state.courseTeachers.push({userId:user.id,courseId:body.payload.id});
        return send(null);
      }
      if(!actor)return send({code:"42501",message:"Unauthenticated"},401);
      if(url.pathname.endsWith("/course_workspace"))return send(visibleWorkspace(authoring,state.users.find(u=>u.id===actor)!,state));
      if(url.pathname==="/auth/v1/user") { if(req.method==="PUT")provisionedPasswords.set(actor,body.password);return send(authUser(actor)); }
      if(url.pathname.endsWith("/exercise_attempt_operation")) {
        if(!releasedCourseIds(state,actor).includes(body.identity.courseId))return send({code:"42501",message:"denied"},403);
        const key=JSON.stringify([actor,...["courseId","chapterId","activityId","exerciseId","exerciseVersion"].map(key=>body.identity[key])]);
        const now=new Date().toISOString();
        if(body.operation==="save")savedAttempts.set(key,{...body.saved_state,lastSavedAt:now});
        if(body.operation==="clear")savedAttempts.delete(key);
        return send({state:savedAttempts.get(key)??null,lastSavedAt:now});
      }
      if(url.pathname.endsWith("/app_snapshot"))return send(snapshot(actor));
      if(url.pathname.endsWith("/teacher_course_progress")) {
        const repo=new InMemoryMonitoringRepository(()=>state,actor,id=>[...progress.values()].filter(row=>row.user_id===id) as unknown as ProgressRow[]);
        try { return send(body.requested_course ? [body.requested_student ? await repo.getStudentDetail(body.requested_course,body.requested_student) : await repo.getCourseStudents(body.requested_course)] : await repo.listTeacherCourses()); }
        catch { return send({code:"42501",message:"denied"},403); }
      }
      if(url.pathname.endsWith("/admin_command")) {
        const command=["enroll","assign-service"].includes(body.command.type)?{...body.command,id:crypto.randomUUID()}:body.command;
        state=applyAdminCommand(state,actor,command,authoring.courses.map(c=>c.id));return send(null);
      }
      if(url.pathname.endsWith("/course_teacher_names"))return send(state.courseTeachers.filter(item=>requireCourseAccess(state,state.users.find(user=>user.id===actor)!,item.courseId)).map(item=>({courseId:item.courseId,name:state.users.find(user=>user.id===item.userId)!.name})));
      if(url.pathname.endsWith("/save_student_progress")) {
        if(!releasedCourseIds(state,actor).includes(body.course))return send({code:"42501",message:"denied"},403);
        const key=JSON.stringify([actor,body.course,body.chapter,body.activity]); const previous=progress.get(key);
        progress.set(key,{user_id:actor,course_id:body.course,chapter_id:body.chapter,activity_id:body.activity,status:previous?.status==="completed"?"completed":body.progress_status,updated_at:new Date().toISOString()});return send(null);
      }
      if(url.pathname==="/rest/v1/student_progress")return send([...progress.values()].filter(row=>row.user_id===actor));
      return send({message:"Unknown controlled endpoint"},404);
    } catch {res.writeHead(400,{"Content-Type":"application/json"});res.end(JSON.stringify({code:"22023",message:"Controlled error"}));}
  });
  try {
    await new Promise<void>(resolve=>backend.listen(0,"127.0.0.1",resolve));
    const backendPort=(backend.address() as import("node:net").AddressInfo).port;
    await Promise.all(["app","components","data","lib","types","public"].map(name=>cp(path.join(workspace,name),path.join(project,name),{recursive:true})));
    await Promise.all(["tsconfig.json","postcss.config.mjs","next-env.d.ts","next.config.ts"].map(name=>cp(path.join(workspace,name),path.join(project,name))));
    await writeFile(path.join(project,"package.json"),JSON.stringify({name:"controlled-supabase-ui",private:true}));
    const env={...process.env,BI_SOCIETY_APP_ENV:"test",APP_ORIGIN:"http://localhost",NEXT_PUBLIC_DATA_MODE:"supabase",NEXT_PUBLIC_SUPABASE_URL:`http://127.0.0.1:${backendPort}`,NEXT_PUBLIC_SUPABASE_ANON_KEY:"anon-controlled-marker",SUPABASE_SERVICE_ROLE_KEY:"server-role-controlled-marker",NEXT_TELEMETRY_DISABLED:"1"};
    const next=path.join(workspace,"node_modules/next/dist/bin/next"); let logs="";
    build=spawn(process.execPath,[next,"build",project],{cwd:workspace,env,windowsHide:true,stdio:["ignore","pipe","pipe"]});
    build.stdout?.on("data",chunk=>{logs+=chunk;}); build.stderr?.on("data",chunk=>{logs+=chunk;});
    const code=await new Promise<number|null>(resolve=>build!.once("exit",resolve));
    expect(code,logs.slice(-3000)).toBe(0);
    const reservation=createServer(); await new Promise<void>(resolve=>reservation.listen(0,"127.0.0.1",resolve)); const appPort=(reservation.address() as import("node:net").AddressInfo).port; await new Promise<void>(resolve=>reservation.close(()=>resolve()));
    application=spawn(process.execPath,[next,"start",project,"--port",String(appPort),"--hostname","localhost"],{cwd:workspace,env:{...env,APP_ORIGIN:`http://localhost:${appPort}`},windowsHide:true,stdio:["ignore","pipe","pipe"]});
    application.stdout?.on("data",chunk=>{logs+=chunk;}); application.stderr?.on("data",chunk=>{logs+=chunk;});
    const origin=`http://localhost:${appPort}`;
    await expect.poll(async()=>{try{return(await fetch(origin+"/login")).status;}catch{return 0;}},{timeout:30000}).toBe(200);
    const login=async(identifier:string)=>{await page.getByLabel("Matrícula ou email",{exact:true}).fill(identifier);await page.getByLabel("Senha",{exact:true}).fill("controlled-password");await page.getByRole("button",{name:"Entrar",exact:true}).click();await expect(page).not.toHaveURL(/\/login/);};
    const logout=async()=>{await page.getByText("Minha conta",{exact:true}).click();await page.getByRole("button",{name:"Sair",exact:true}).click();await expect(page).toHaveURL(/\/login/);};
    await page.context().addInitScript(() => {
      const accesses: string[] = [];
      (window as unknown as { demoAdminStorageAccesses: string[] }).demoAdminStorageAccesses = accesses;
      for (const method of ["getItem", "setItem", "removeItem"] as const) {
        const original = Storage.prototype[method];
        Object.defineProperty(Storage.prototype, method, { configurable: true, writable: true, value: function(this: Storage, key: string, ...args: string[]) {
          if (key === "bi-society:demo-admin-state:v1") { accesses.push(method); throw new Error("Supabase must not access demo admin storage"); }
          return (original as (this: Storage, key: string, ...args: string[]) => string | null | void).call(this, key, ...args);
        } });
      }
    });
    await page.goto(origin+"/login"); await login("admin@example.com"); await expect(page).toHaveURL(origin+"/admin");
    await expect(page.getByRole("button", { name: "Restaurar dados de demonstração", exact: true })).toHaveCount(0);
    const ready=await request.get(origin+"/api/ready");expect(ready.status()).toBe(200);expect(await ready.json()).toEqual({status:"ready"});
    await page.getByRole("link",{name:"Usuários",exact:true}).click(); await page.getByRole("link",{name:"Ver detalhes de César",exact:true}).click();
    await page.getByLabel("Nome",{exact:true}).fill("César Persistido"); await page.getByRole("button",{name:"Salvar dados e perfis",exact:true}).click(); await expect(page.getByRole("status")).toContainText("atualizados");
    await page.reload(); await expect(page.getByLabel("Nome",{exact:true})).toHaveValue("César Persistido");
    await logout(); await login("202700184"); await expect(page.getByText("Olá, César Persistido",{exact:true})).toBeVisible();
    expect(await page.evaluate(()=>document.cookie)).not.toContain("sb-");
    expect(await page.evaluate(()=>sessionStorage.getItem("bi-society:demo-auth-session:v1"))).toBeNull();
    await page.getByRole("link",{name:/Redes Neurais Aplicadas à Engenharia/}).click(); await page.getByRole("link",{name:"Começar curso",exact:true}).click();
    await page.locator(".chapter-activity-section.is-current").getByRole("button",{name:"Concluir atividade",exact:true}).click();
    await expect(page.getByText("Progresso salvo.",{exact:true})).toBeVisible();
    await page.reload(); await expect(page.getByRole("progressbar",{name:"Progresso do curso"})).toHaveAttribute("value","17");
    await page.route("**/api/attempts",route=>route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:"Indisponível"})}));
    await page.getByRole("button",{name:"Abrir bloco C.1",exact:true}).click();
    await expect(page.getByRole("button",{name:"Tentar carregar novamente",exact:true})).toBeVisible();
    await expect(page.locator(".chapter-activity-section.is-current").getByRole("grid")).toHaveCount(0);
    await page.unroute("**/api/attempts");await page.getByRole("button",{name:"Tentar carregar novamente",exact:true}).click();
    await expect(page.locator(".chapter-activity-section.is-current").getByRole("grid")).toBeVisible();
    await logout(); await login("professor@example.com"); await expect(page).toHaveURL(origin+"/studio/courses");
    // Deletion has no safe atomic RPC yet: both UI and API must refuse it,
    // without touching any demo workspace in this browser.
    const deletionDraft={...structuredClone(authoring.exercises[0].draft),id:"deletion-unlinked",title:"Exercício sem vínculo"};
    expect((await page.request.post(origin+"/api/courses",{headers:{"X-Expected-User":teacher},data:{operation:"save-exercise",exercise:{id:deletionDraft.id,draft:deletionDraft}}})).status()).toBe(200);
    await page.reload();
    await page.evaluate(()=>localStorage.setItem("bi-society:course-authoring:v1","demo-sentinel"));
    const deletionBefore=JSON.stringify(authoring);
    const deletionResponse=await page.request.post(origin+"/api/courses",{headers:{"X-Expected-User":teacher},data:{operation:"delete-exercise",id:deletionDraft.id,version:deletionDraft.version}});
    expect(deletionResponse.status()).toBe(501);expect(JSON.stringify(authoring)).toBe(deletionBefore);
    await page.locator(".exercise-library-list > li").filter({hasText:deletionDraft.title}).getByRole("button",{name:"Excluir",exact:true}).click();
    await expect(page.getByRole("dialog")).toContainText("A exclusão de exercícios no Supabase ainda não está disponível");
    await expect(page.getByRole("dialog").getByRole("button")).toHaveCount(1);
    await page.getByRole("button",{name:"Cancelar",exact:true}).click();
    expect(await page.evaluate(()=>localStorage.getItem("bi-society:course-authoring:v1"))).toBe("demo-sentinel");
    const linkedExercise=authoring.exercises[0];
    expect((await page.request.post(origin+"/api/courses",{headers:{"X-Expected-User":teacher},data:{operation:"delete-exercise",id:linkedExercise.id,version:linkedExercise.definition.version}})).status()).toBe(409);
    const forbidden=await page.request.get(origin+"/api/admin/session");expect(forbidden.status()).toBe(403);
    const anonymous=await request.get(origin+"/api/learn/session");expect(anonymous.status()).toBe(401);
    expect((await request.get(origin+"/api/monitoring")).status()).toBe(401);
    await page.route("**/api/monitoring**",route=>route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:"Indisponível"})}));
    await page.getByRole("link",{name:"Acompanhamento",exact:true}).click();
    await expect(page.getByRole("heading",{name:"Acompanhamento indisponível"})).toBeVisible();
    await page.unroute("**/api/monitoring**");
    let release!:()=>void;const pending=new Promise<void>(resolve=>{release=resolve;});
    await page.route("**/api/monitoring**",async route=>{await pending;await route.continue();});
    await page.getByRole("button",{name:"Tentar novamente",exact:true}).click();
    await expect(page.getByText("Carregando acompanhamento...",{exact:true})).toBeVisible();release();
    await expect(page.locator(".monitoring-course-grid article")).toHaveCount(1);
    await page.unroute("**/api/monitoring**");
    await page.getByRole("link",{name:"Redes Neurais Aplicadas à Engenharia",exact:true}).click();
    await expect(page.locator("tbody tr")).toHaveCount(1);await expect(page.locator("tbody")).toContainText("César Persistido");await expect(page.locator("tbody")).toContainText("17%");
    await page.getByRole("link",{name:"César Persistido",exact:true}).click();await expect(page.getByText("Progresso geral:")).toContainText("17%");
    expect((await page.request.get(origin+"/api/monitoring?courseId=chapter-navigation-demo")).status()).toBe(403);
    expect((await page.request.get(origin+`/api/monitoring?courseId=neural-demo&userId=${admin}`)).status()).toBe(403);
    await page.reload();await expect(page.getByText("Progresso geral:")).toContainText("17%");
    await logout(); await login("cesar@example.com"); await page.getByRole("link",{name:/Redes Neurais Aplicadas à Engenharia/}).click();
    await expect(page.getByRole("progressbar",{name:"Progresso do curso"})).toHaveAttribute("value","17");
    expect((await page.request.get(origin+"/api/monitoring")).status()).toBe(403);
    expect(receivedKeys).toContain("server-role-controlled-marker");
    await page.screenshot({path:"test-results/supabase-controlled-learn.png"});

    // Etapa 21 acceptance: create a new student through Admin, provision only in
    // this controlled Auth service (production intentionally has no password UI).
    const acceptanceErrors:string[]=[];
    page.on("pageerror",error=>acceptanceErrors.push(error.message));
    page.on("console",message=>{if(message.type()==="error" || /hydration|maximum update depth/i.test(message.text()))acceptanceErrors.push(message.text());});
    await logout();await login("admin@example.com");
    await page.getByRole("link",{name:"Criar usuário",exact:true}).click();
    await page.getByLabel("Nome",{exact:true}).fill("Aluno Integração 21");
    await page.getByLabel("Email",{exact:true}).fill("etapa21@example.com");
    await page.getByLabel("Aluno",{exact:true}).check();
    await page.getByRole("button",{name:"Criar usuário",exact:true}).click();
    await expect(page.getByRole("heading",{name:"Aluno Integração 21",exact:true})).toBeVisible();
    const newStudent=new URL(page.url()).pathname.split("/").at(-1)!;
    expect(newStudent).toMatch(/^[0-9a-f-]{36}$/);
    await expect(page.getByText("Sem matrícula. Requer perfil Aluno ativo.",{exact:true})).toBeVisible();
    await expect(page.getByText("Sem serviços associados.",{exact:true})).toBeVisible();
    await page.getByRole("button",{name:"Gerar matrícula",exact:true}).click();
    await expect(page.locator(".admin-registration")).toHaveText(/^\d{9}$/);
    const registration=(await page.locator(".admin-registration").innerText()).trim();
    await page.getByRole("combobox",{name:"Serviço",exact:true}).selectOption({label:"Curso Avulso"});
    await page.getByRole("button",{name:"Atribuir serviço",exact:true}).click();
    await expect(page.getByRole("status")).toContainText("atribuído");
    await page.getByRole("button",{name:"Enviar link para definir senha",exact:true}).click();
    await expect(page.getByRole("status")).toContainText("Solicitação enviada");
    const passwordSetup=await request.post(origin+"/api/auth/password",{data:{operation:"update",tokenHash:recoveryTokens.get("etapa21@example.com"),password:"controlled-password"}});
    expect(passwordSetup.status()).toBe(200);
    await logout();await login(registration);
    await expect(page.getByText("Nenhum curso foi liberado para você ainda.",{exact:true})).toBeVisible();
    await page.goto(origin+"/learn/neural-demo");
    await expect(page.getByRole("heading",{name:"Acesso não autorizado",exact:true})).toBeVisible();
    await expect(page.locator(".learn-header,.learn-lab")).toHaveCount(0);
    expect((await page.request.post(origin+"/api/learn/session",{data:{courseId:"neural-demo",chapterId:"fundamentos",activityId:"intro-video",status:"completed"}})).status()).toBe(403);
    await page.getByRole("link",{name:"Meus ambientes",exact:true}).click();
    await logout();await login("admin@example.com");
    await page.goto(origin+`/admin/users/${newStudent}`);
    await expect(page.getByRole("heading",{name:"Aluno Integração 21",exact:true})).toBeVisible();
    await page.getByRole("combobox",{name:"Vínculo de serviço",exact:true}).selectOption({label:"Curso Avulso"});
    await page.getByRole("combobox",{name:"Curso para liberar",exact:true}).selectOption("neural-demo");
    await page.getByRole("button",{name:"Liberar curso",exact:true}).click();
    await expect(page.getByRole("status")).toContainText("liberado");
    await page.reload();await expect(page.locator(".admin-registration")).toHaveText(registration);
    await logout();await login(registration);
    await expect(page.getByText("Olá, Aluno Integração 21",{exact:true})).toBeVisible();
    await page.getByRole("link",{name:/Redes Neurais Aplicadas à Engenharia/}).click();
    await expect(page.getByRole("progressbar",{name:"Progresso do curso",exact:true})).toHaveAttribute("value","0");
    await page.getByRole("link",{name:"Começar curso",exact:true}).click();
    const active=page.locator(".chapter-activity-section.is-current");
    await active.getByRole("button",{name:"Concluir atividade",exact:true}).click();
    await page.getByRole("button",{name:"Abrir bloco B",exact:true}).click();await expect(active).toContainText("Video Aplicação");
    await page.getByRole("button",{name:"Abrir bloco D",exact:true}).click();await active.getByRole("button",{name:"Concluir atividade",exact:true}).click();
    await page.getByRole("link",{name:"Continuar para o próximo capítulo",exact:true}).click();await expect(page).toHaveURL(/\/chapter\/correcao$/);
    await page.getByRole("button",{name:"Abrir bloco D",exact:true}).click();await active.getByRole("button",{name:"Concluir atividade",exact:true}).click();
    await page.getByRole("button",{name:"Abrir bloco C.1",exact:true}).click();await active.getByRole("tab",{name:"Treinamento",exact:true}).click();
    const solution=createInitialWorkbook().worksheets.find(sheet=>sheet.id==="treinamento")!.cells;
    for(let row=2;row<=6;row++)for(const column of ["F","H","I","J"]) {
      const address=`${column}${row}`;await active.getByRole("gridcell",{name:address,exact:true}).click();
      const bar=active.getByRole("textbox",{name:"Conteúdo da célula",exact:true});await bar.fill(solution[address]);await bar.press("Enter");
    }
    await active.getByRole("button",{name:"Verificar respostas",exact:true}).click();await expect(active.getByText("Atividade concluída ✓",{exact:true})).toBeVisible();
    await expect(page.getByText("Progresso salvo.",{exact:true})).toBeVisible();await expect(active.getByText("Salvo ✓",{exact:true})).toBeVisible();
    await page.reload();await expect(page.getByRole("progressbar",{name:"Progresso do curso",exact:true})).toHaveAttribute("value","67");
    // Stage 22: complete confirmed inputs now persist independently of course progress.
    await page.getByRole("button",{name:"Abrir bloco C.1",exact:true}).click();await active.getByRole("tab",{name:"Treinamento",exact:true}).click();
    await active.getByRole("gridcell",{name:"F2",exact:true}).click();
    await expect(active.getByRole("textbox",{name:"Conteúdo da célula",exact:true})).toHaveValue(solution.F2);
    await logout();await login("professor@example.com");
    await page.getByRole("link",{name:"Acompanhamento",exact:true}).click();await page.getByRole("link",{name:"Redes Neurais Aplicadas à Engenharia",exact:true}).click();
    await page.getByLabel("Buscar por nome ou matrícula",{exact:true}).fill(registration);
    await expect(page.locator("tbody tr")).toHaveCount(1);await expect(page.locator("tbody tr")).toContainText("67%");
    await expect(page.locator("tbody tr")).toContainText("4 de 6 obrigatórias");
    await page.getByRole("link",{name:"Aluno Integração 21",exact:true}).click();await expect(page).toHaveURL(origin+`/studio/monitoring/neural-demo/student/${newStudent}`);await page.reload();await expect(page.getByText("Progresso geral:")).toContainText("67%");
    await page.screenshot({path:"test-results/etapa21-supabase-monitoring.png"});
    await logout();await login("cesar@example.com");await page.getByRole("link",{name:/Redes Neurais Aplicadas à Engenharia/}).click();
    await expect(page.getByRole("progressbar",{name:"Progresso do curso",exact:true})).toHaveAttribute("value","17");
    await expect(page.getByText("Olá, César Persistido",{exact:true})).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { demoAdminStorageAccesses: string[] }).demoAdminStorageAccesses)).toEqual([]);
    expect(acceptanceErrors).toEqual([]);
    // Persistent Studio authorship: UI creation, real browser shutdown, another process and login.
    const authorBrowser=await openFresh();let authoredId="", authoredChapterId="", authoredLabId="";
    const loginAt=async(p:import("@playwright/test").Page,email:string)=>{await p.goto(origin+"/login");await p.getByLabel("Matrícula ou email",{exact:true}).fill(email);await p.getByLabel("Senha",{exact:true}).fill("controlled-password");await p.getByRole("button",{name:"Entrar",exact:true}).click();await expect(p).not.toHaveURL(/\/login/);};
    try {
      const author=await authorBrowser.newPage();author.setDefaultTimeout(10000);console.log("Autoria: criar curso e preview");await loginAt(author,"professor@example.com");await author.getByRole("link",{name:"Novo curso",exact:true}).click();await author.getByLabel("Título do curso",{exact:true}).fill("Curso de Teste");await author.getByRole("button",{name:"Criar curso",exact:true}).click();await expect(author).toHaveURL(/\/studio\/courses\/course-/);authoredId=new URL(author.url()).pathname.split("/").at(-1)!;
      await author.getByLabel("Título do novo capítulo",{exact:true}).fill("Capítulo 1");await author.getByRole("button",{name:"Criar capítulo",exact:true}).click();
      for(const title of ["Video Aula","Video Aplicação","Lab"]) {await author.getByRole("button",{name:"Nova atividade",exact:true}).click();await author.getByLabel("Título da atividade",{exact:true}).fill(title);await author.getByLabel("Tipo de atividade",{exact:true}).selectOption(title==="Lab"?"spreadsheet-exercise":"video");if(title==="Lab")await author.getByLabel("Selecionar exercício",{exact:true}).selectOption("neural-error-correction");else await author.getByLabel("URL do vídeo",{exact:true}).fill("https://example.com/video");await author.getByRole("button",{name:"Salvar atividade",exact:true}).click();await expect(author.getByRole("heading",{name:new RegExp(title+"$")})).toBeVisible();}
      await author.getByRole("button",{name:"Salvar",exact:true}).click();await expect(author.getByRole("status").filter({hasText:"Salvo · Rascunho"})).toBeVisible();
      const saved=authoring.courses.find(c=>c.id===authoredId)!;authoredChapterId=saved.chapters[0].id;authoredLabId=saved.chapters[0].activities[2].id;
      const historyBeforeReplacement=JSON.stringify({progress:[...progress],attempts:[...savedAttempts]});
      const initialReference=structuredClone(saved.chapters[0].activities[2]);
      await author.getByRole("button",{name:"Substituir exercício",exact:true}).click();
      await author.getByLabel("Buscar exercício",{exact:true}).fill(deletionDraft.title);
      await author.getByRole("dialog").getByRole("radio").check();
      await author.getByRole("button",{name:"Substituir",exact:true}).click();
      await expect(author.getByText("Exercício substituído com sucesso.",{exact:true})).toBeVisible();
      const newActivity=authoring.courses.find(c=>c.id===authoredId)!.chapters[0].activities[2];
      expect(newActivity.content).toMatchObject({exerciseId:deletionDraft.id,exerciseVersion:deletionDraft.version});
      await author.reload();await expect(author.locator(".activity-exercise-control")).toContainText(deletionDraft.title);
      const staleResponse=await author.request.post(origin+"/api/courses",{headers:{"X-Expected-User":teacher},data:{operation:"replace-activity-exercise",id:authoredId,chapterId:authoredChapterId,activityId:authoredLabId,previousExerciseId:"neural-error-correction",previousExerciseVersion:initialReference.type==="spreadsheet-exercise"?initialReference.content.exerciseVersion:null,nextExerciseId:deletionDraft.id,nextExerciseVersion:deletionDraft.version,expectedUpdatedAt:saved.updatedAt}});
      expect(staleResponse.status()).toBe(409);
      await author.getByRole("button",{name:"Substituir exercício",exact:true}).click();
      await author.getByRole("dialog").getByRole("radio").filter({visible:true}).first().check();
      await author.getByRole("button",{name:"Substituir",exact:true}).click();
      await expect(author.getByText("Exercício substituído com sucesso.",{exact:true})).toBeVisible();
      expect(authoring.courses.find(c=>c.id===authoredId)!.chapters[0].activities[2].content).toEqual(initialReference.content);
      expect(JSON.stringify({progress:[...progress],attempts:[...savedAttempts]})).toBe(historyBeforeReplacement);
      await author.reload();await expect(author.getByRole("heading",{name:"Capítulo 1",exact:true})).toBeVisible();
      await author.getByRole("link",{name:"Visualizar como aluno",exact:true}).click();await author.getByRole("button",{name:"Capítulo 1 · Lab",exact:true}).click();await expect(author.getByRole("gridcell",{name:"A1",exact:true})).toBeVisible();
      expect([...progress.values()].some(row=>row.course_id===authoredId)).toBe(false);
    } finally {await authorBrowser.close();}
    const studentCatalog=await page.request.get(origin+"/api/courses",{headers:{"X-Expected-User":student}});expect(studentCatalog.status()).toBe(200);expect((await studentCatalog.json()).courses.some((c:{id:string})=>c.id===authoredId)).toBe(false);
    expect((await page.request.post(origin+"/api/courses",{headers:{"X-Expected-User":student},data:{operation:"save-course",course:authoring.courses.find(c=>c.id===authoredId)}})).status()).toBe(403);
    expect((await page.request.get(origin+"/api/courses",{headers:{"X-Expected-User":teacher}})).status()).toBe(409);
    const secondAuthorBrowser=await openFresh();
    try {
      const author=await secondAuthorBrowser.newPage();author.setDefaultTimeout(10000);console.log("Autoria: reabrir em outro browser");await loginAt(author,"professor@example.com");await expect(author.getByRole("link",{name:"Curso de Teste",exact:true})).toBeVisible();await author.reload();await author.getByRole("link",{name:"Curso de Teste",exact:true}).click();
      await expect(author.locator(".course-activity")).toHaveCount(3);await author.getByRole("button",{name:"Editar exercício",exact:true}).click();await expect(author).toHaveURL(/\/studio\/editor(?:\?.*)?$/);await author.reload();await expect(author.getByRole("grid")).toBeVisible();
      await author.goto(origin+`/studio/courses/${authoredId}`);await author.getByRole("button",{name:"Publicar",exact:true}).click();await expect(author.getByRole("status").filter({hasText:"Salvo · Publicado"})).toBeVisible();
      const saved=authoring.courses.find(c=>c.id===authoredId)!;expect(saved.chapters[0].id).toBe(authoredChapterId);expect(saved.chapters[0].activities[2].id).toBe(authoredLabId);
    } finally {await secondAuthorBrowser.close();}
    const releaseBrowser=await openFresh();
    try {
      const operator=await releaseBrowser.newPage();operator.setDefaultTimeout(10000);console.log("Autoria: liberar no Admin e navegar como aluno");await loginAt(operator,"admin@example.com");await operator.getByRole("link",{name:"Usuários",exact:true}).click();await operator.getByRole("link",{name:"Ver detalhes de César Persistido",exact:true}).click();await operator.getByRole("combobox",{name:"Vínculo de serviço",exact:true}).selectOption(ids["service-cesar"]);await operator.getByRole("combobox",{name:"Curso para liberar",exact:true}).selectOption(authoredId);await operator.getByRole("button",{name:"Liberar curso",exact:true}).click();await expect(operator.getByRole("status")).toContainText("liberado");
      await operator.getByText("Minha conta",{exact:true}).click();await operator.getByRole("button",{name:"Sair",exact:true}).click();await loginAt(operator,"cesar@example.com");await operator.getByRole("link",{name:/Curso de Teste/}).click();await operator.getByRole("link",{name:"Começar curso",exact:true}).click();
      for(let index=0;index<2;index++) {await operator.locator(".chapter-activity-section.is-current").getByRole("button",{name:"Concluir atividade",exact:true}).click();await expect(operator.getByText("Progresso salvo.",{exact:true})).toBeVisible();await operator.getByRole("button",{name:"Próxima atividade →",exact:true}).click();}
      const lab=operator.locator(".chapter-activity-section.is-current");await lab.getByRole("tab",{name:"Treinamento",exact:true}).click();await lab.getByRole("gridcell",{name:"F2",exact:true}).click();await lab.getByRole("textbox",{name:"Conteúdo da célula",exact:true}).fill("=321");await lab.getByRole("textbox",{name:"Conteúdo da célula",exact:true}).press("Enter");await expect(lab.getByText("Salvo ✓",{exact:true})).toBeVisible();await operator.reload();await expect(operator.getByRole("progressbar",{name:"Progresso do curso",exact:true})).toHaveAttribute("value","67");
    } finally {await releaseBrowser.close();}
    const monitorBrowser=await openFresh();
    try {
      const monitor=await monitorBrowser.newPage();monitor.setDefaultTimeout(10000);console.log("Autoria: versionar publicado e conferir Monitoring");await loginAt(monitor,"professor@example.com");await monitor.getByRole("link",{name:"Curso de Teste",exact:true}).click();await expect(monitor.getByLabel("Título do curso",{exact:true})).toHaveCount(0);
      const sourceSnapshot=JSON.stringify(authoring.courses.find(c=>c.id===authoredId));const historySnapshot=JSON.stringify({progress:[...progress],attempts:[...savedAttempts]});
      await monitor.getByRole("button",{name:"Criar nova versão",exact:true}).click();await monitor.getByRole("button",{name:"Confirmar nova versão",exact:true}).click();await expect(monitor).not.toHaveURL(origin+`/studio/courses/${authoredId}`);
      await monitor.getByLabel("Título do curso",{exact:true}).fill("Curso de Teste – Versão 2");await monitor.getByRole("button",{name:"Salvar dados do curso",exact:true}).click();await expect(monitor.getByRole("status").filter({hasText:"Salvo · Rascunho"})).toBeVisible();await monitor.getByRole("button",{name:"Substituir exercício",exact:true}).click();await monitor.getByLabel("Buscar exercício",{exact:true}).fill(deletionDraft.title);await monitor.getByRole("dialog").getByRole("radio").check();await monitor.getByRole("button",{name:"Substituir",exact:true}).click();await expect(monitor.getByText("Exercício substituído com sucesso.",{exact:true})).toBeVisible();await monitor.getByRole("button",{name:"Publicar",exact:true}).click();await expect(monitor.getByRole("status").filter({hasText:"Salvo · Publicado"})).toBeVisible();
      expect(JSON.stringify(authoring.courses.find(c=>c.id===authoredId))).toBe(sourceSnapshot);expect(JSON.stringify({progress:[...progress],attempts:[...savedAttempts]})).toBe(historySnapshot);
      await monitor.goto(origin+`/studio/monitoring/${authoredId}`);await expect(monitor.locator("tbody tr")).toContainText("67%");await expect(monitor.getByText("Versão v1 · Progresso desta versão",{exact:true})).toBeVisible();
    } finally {await monitorBrowser.close();}
    const restoredBrowser=await openFresh();
    try {
      const restored=await restoredBrowser.newPage();restored.setDefaultTimeout(10000);await loginAt(restored,"cesar@example.com");await restored.getByRole("link",{name:/Curso de Teste/}).click();await expect(restored.getByRole("progressbar",{name:"Progresso do curso",exact:true})).toHaveAttribute("value","67");await restored.goto(origin+`/learn/${authoredId}/chapter/${authoredChapterId}`);const lab=restored.locator(".chapter-activity-section.is-current");await lab.getByRole("tab",{name:"Treinamento",exact:true}).click();await lab.getByRole("gridcell",{name:"F2",exact:true}).click();await expect(lab.getByRole("textbox",{name:"Conteúdo da célula",exact:true})).toHaveValue("=321");
    } finally {await restoredBrowser.close();}
    const latestAuthored=authoring.courses.find(c=>c.basedOnCourseId===authoredId&&c.status==="published")!;
    const newVersionBrowser=await openFresh();
    try{
      const newcomer=await newVersionBrowser.newPage();newcomer.setDefaultTimeout(10000);await loginAt(newcomer,"admin@example.com");await newcomer.goto(origin+`/admin/users/${newStudent}`);await newcomer.getByRole("combobox",{name:"Vínculo de serviço",exact:true}).selectOption({label:"Curso Avulso"});await newcomer.getByRole("combobox",{name:"Curso para liberar",exact:true}).selectOption(latestAuthored.id);await newcomer.getByRole("button",{name:"Liberar curso",exact:true}).click();await expect(newcomer.getByRole("status")).toContainText("liberado");
      await newcomer.getByText("Minha conta",{exact:true}).click();await newcomer.getByRole("button",{name:"Sair",exact:true}).click();await loginAt(newcomer,"etapa21@example.com");await newcomer.getByRole("link",{name:/Curso de Teste – Versão 2/}).click();await expect(newcomer.getByRole("progressbar",{name:"Progresso do curso",exact:true})).toHaveAttribute("value","0");await newcomer.getByRole("link",{name:"Começar curso",exact:true}).click();await newcomer.getByRole("button",{name:"Próxima atividade →",exact:true}).click();await newcomer.getByRole("button",{name:"Próxima atividade →",exact:true}).click();await expect(newcomer.getByText(deletionDraft.title,{exact:true})).toBeVisible();
      expect(releasedCourseIds(state,student)).toContain(authoredId);expect(releasedCourseIds(state,student)).not.toContain(latestAuthored.id);expect(releasedCourseIds(state,newStudent)).toContain(latestAuthored.id);
    }finally{await newVersionBrowser.close();}
    for(const src of await page.locator('script[src*="/_next/static/"]').evaluateAll(nodes=>nodes.map(node=>(node as HTMLScriptElement).src))) {
      const asset=await page.request.get(src);expect(asset.ok()).toBe(true);
      expect(await asset.text()).not.toContain("server-role-controlled-marker");
      expect(await asset.text()).not.toContain("demo123");
    }
    // A brand-new browser process has neither cookies nor any React/session storage.
    async function openFresh() {
      const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL,args:process.env.PLAYWRIGHT_DISABLE_GPU==="1"?["--disable-gpu"]:[]});
      // Browser emits no "page" event; attach observers to each created page.
      return {
        newPage: async () => {
          const p = await browser.newPage();
          p.on("pageerror",error=>acceptanceErrors.push(error.message));
          p.on("console",message=>{
            // SupabaseAuthAdapter.restore explicitly handles an absent session
            // as anonymous; its 401 console event can arrive after navigation.
            const anonymousSession = message.location().url === origin + "/api/auth/session"
              && /^Failed to load resource: the server responded with a status of 401\b/.test(message.text());
            if (!anonymousSession && (message.type()==="error" || (message.type()==="warning" && /hydrati|maximum update|unique.*key/i.test(message.text())))) acceptanceErrors.push(`${message.text()} ${message.location().url}`);
          });
          return p;
        },
        close: () => browser.close(),
      };
    }
    const fresh=await openFresh();
    try {
      const resumed=await fresh.newPage();await resumed.goto(origin+"/login");
      await resumed.getByLabel("Matrícula ou email",{exact:true}).fill(registration);await resumed.getByLabel("Senha",{exact:true}).fill("controlled-password");await resumed.getByRole("button",{name:"Entrar",exact:true}).click();
      await resumed.getByRole("link",{name:/Redes Neurais Aplicadas à Engenharia/}).click();await resumed.getByRole("link",{name:/Continuar estudos/}).click();
      // Completed chapters remain available independently of the continue destination.
      await resumed.goto(origin+"/learn/neural-demo/chapter/correcao");await resumed.getByRole("button",{name:"Abrir bloco C.1",exact:true}).click();
      const resumedLab=resumed.locator(".chapter-activity-section.is-current");await resumedLab.getByRole("tab",{name:"Treinamento",exact:true}).click();await resumedLab.getByRole("gridcell",{name:"F2",exact:true}).click();
      await expect(resumedLab.getByRole("textbox",{name:"Conteúdo da célula",exact:true})).toHaveValue(solution.F2);
      await resumedLab.getByRole("button",{name:"Reiniciar planilha",exact:true}).click();await resumed.getByRole("dialog").getByRole("button",{name:"Reiniciar",exact:true}).click();
      await resumedLab.getByRole("tab",{name:"Treinamento",exact:true}).click();await expect(resumedLab.getByRole("gridcell",{name:"F2",exact:true})).toBeEmpty();
      await resumed.reload();await expect(resumed.getByRole("progressbar",{name:"Progresso do curso",exact:true})).toHaveAttribute("value","67");
      await resumed.getByRole("button",{name:"Abrir bloco C.1",exact:true}).click();await resumedLab.getByRole("tab",{name:"Treinamento",exact:true}).click();await expect(resumedLab.getByRole("gridcell",{name:"F2",exact:true})).toBeEmpty();
      await resumed.goto(origin+"/learn/neural-demo/chapter/fundamentos");await resumed.getByRole("button",{name:"Abrir bloco C.1",exact:true}).click();
      await resumedLab.getByRole("tab",{name:"Treinamento",exact:true}).click();await resumedLab.getByRole("gridcell",{name:"F2",exact:true}).click();
      await resumedLab.getByRole("textbox",{name:"Conteúdo da célula",exact:true}).fill("=123");await resumedLab.getByRole("textbox",{name:"Conteúdo da célula",exact:true}).press("Enter");await expect(resumedLab.getByText("Salvo ✓",{exact:true})).toBeVisible();
      await resumed.getByRole("button",{name:"Abrir bloco C.2",exact:true}).click();await resumedLab.getByRole("tab",{name:"Treinamento",exact:true}).click();await expect(resumedLab.getByRole("gridcell",{name:"F2",exact:true})).toBeEmpty();
    } finally {await fresh.close();}
    const reopened=await openFresh();
    try {
      const recovered=await reopened.newPage();await recovered.goto(origin+"/login");await recovered.getByRole("link",{name:"Esqueci minha senha",exact:true}).click();
      await recovered.getByLabel("Email cadastrado",{exact:true}).fill("etapa21@example.com");await recovered.getByRole("button",{name:"Enviar instruções",exact:true}).click();await expect(recovered.getByRole("status")).toContainText("Se o email estiver cadastrado");
      const token=recoveryTokens.get("etapa21@example.com")!;
      await recovered.goto(origin+`/auth/new-password#type=recovery&token_hash=${token}`);
      await recovered.getByLabel("Nova senha",{exact:true}).fill("new-controlled-password");await recovered.getByLabel("Confirmar senha",{exact:true}).fill("new-controlled-password");await recovered.getByRole("button",{name:"Definir senha",exact:true}).click();await expect(recovered.getByRole("status")).toContainText("Senha definida");
      await recovered.getByRole("link",{name:"Voltar ao login",exact:true}).click();await recovered.getByLabel("Matrícula ou email",{exact:true}).fill(registration);await recovered.getByLabel("Senha",{exact:true}).fill("new-controlled-password");await recovered.getByRole("button",{name:"Entrar",exact:true}).click();await expect(recovered).toHaveURL(origin+"/learn");
      await recovered.goto(origin+"/learn/neural-demo/chapter/fundamentos");await recovered.getByRole("button",{name:"Abrir bloco C.1",exact:true}).click();const lab=recovered.locator(".chapter-activity-section.is-current");await lab.getByRole("tab",{name:"Treinamento",exact:true}).click();await lab.getByRole("gridcell",{name:"F2",exact:true}).click();await expect(lab.getByRole("textbox",{name:"Conteúdo da célula",exact:true})).toHaveValue("=123");
      expect((await request.post(origin+"/api/auth/password",{data:{operation:"update",tokenHash:token,password:"replayed-password-123"}})).status()).toBe(400);
    } finally {await reopened.close();}
    await page.goto(origin+"/learn/neural-demo/chapter/fundamentos");await page.getByRole("button",{name:"Abrir bloco C.1",exact:true}).click();
    await active.getByRole("tab",{name:"Treinamento",exact:true}).click();await expect(active.getByRole("gridcell",{name:"F2",exact:true})).toBeEmpty();
    expect(await page.evaluate(() => (window as unknown as { demoAdminStorageAccesses: string[] }).demoAdminStorageAccesses)).toEqual([]);
    expect(acceptanceErrors).toEqual([]);
  } finally {
    application?.kill(); build?.kill(); backend.closeAllConnections(); await new Promise<void>(resolve=>backend.close(()=>resolve()));
    const checked=await realpath(project);
    if(checked.startsWith(toolsRoot+path.sep)&&path.basename(checked).startsWith("supabase-ui-")) await rm(checked,{recursive:true,force:true,maxRetries:3,retryDelay:200});
  }
});
