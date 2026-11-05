// Run manually: node --env-file=.env.local scripts/seed-supabase.mjs [--demo-users]
import { createClient } from "@supabase/supabase-js";
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Configure o projeto e a chave de servidor localmente.");
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const check=result => { if(result.error) throw new Error("Seed não aplicado. Confira os vínculos e o projeto de desenvolvimento."); return result.data; };
check(await client.from("services").upsert({id:"00000000-0000-4000-8000-000000000001",type:"standalone-course",title:"Curso Avulso"},{onConflict:"type",ignoreDuplicates:true}));
if(process.argv.includes("--demo-users")) {
  const password=process.env.SUPABASE_DEMO_PASSWORD;
  if(!password || password.length<12) throw new Error("Defina SUPABASE_DEMO_PASSWORD com pelo menos 12 caracteres; a senha não será impressa.");
  const users=[];
  for(let page=1;;page++) { const data=check(await client.auth.admin.listUsers({page,perPage:1000})); users.push(...data.users); if(data.users.length<1000)break; }
  const accounts={};
  for(const [name,email,role] of [["Administrador BI.Society","admin@example.com","admin"],["Professor Neural","professor@example.com","teacher"],["César","cesar@example.com","student"]]) {
    let user=users.find(item=>item.email===email);
    if(!user)user=check(await client.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{name}})).user;
    accounts[role]=user.id;
    check(await client.from("user_roles").upsert({user_id:user.id,role},{onConflict:"user_id,role"}));
  }
  check(await client.from("enrollments").upsert({user_id:accounts.student,registration_code:"202700184",status:"active"},{onConflict:"user_id",ignoreDuplicates:true}));
  const service=check(await client.from("services").select("id").eq("type","standalone-course").single());
  check(await client.from("user_services").upsert({user_id:accounts.student,service_id:service.id,status:"active"},{onConflict:"user_id,service_id",ignoreDuplicates:true}));
  const link=check(await client.from("user_services").select("id").eq("user_id",accounts.student).eq("service_id",service.id).single());
  check(await client.from("course_access").upsert(["neural-demo","chapter-navigation-demo"].map(course_id=>({user_service_id:link.id,course_id})),{onConflict:"user_service_id,course_id",ignoreDuplicates:true}));
  check(await client.from("course_teachers").upsert({user_id:accounts.teacher,course_id:"neural-demo"},{onConflict:"user_id,course_id",ignoreDuplicates:true}));
}
console.log("Seed de desenvolvimento concluído. Nenhuma senha foi gravada em tabela própria.");
