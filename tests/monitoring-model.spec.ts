import { test,expect } from "@playwright/test";
import { demoCourse } from "../data/courses/neural-demo";
import { createAdminFixtures } from "../data/admin/demo";
import { demoMonitoringRows,demoMonitoringState } from "../data/monitoring/demo";
import { learningProjection,monitoringSummary,monitoredStudents,filterMonitoringStudents,formatLearningDate } from "../lib/learn/monitoring";
import { InMemoryMonitoringRepository } from "../lib/repositories/InMemoryMonitoringRepository";
import { SupabaseMonitoringRepository } from "../lib/repositories/SupabaseMonitoringRepository";
import { HttpMonitoringRepository } from "../lib/repositories/HttpMonitoringRepository";
import { monitoringRequest } from "../lib/server/monitoring";
import { apiResponse } from "../lib/server/api";
import { DataError } from "../lib/data/http";
import type { SupabaseClient } from "@supabase/supabase-js";

const now=Date.parse("2026-10-23T15:00:00Z");
const rows=(id:string)=>demoMonitoringRows(id,now)??[];
test("Monitoramento: estados, obrigatórias, opcionais, capítulos e datas reutilizam as regras Learn",()=>{
  const empty=learningProjection(demoCourse,[]); expect(empty.status).toBe("not-started");expect(empty.percent).toBe(0);
  const partial=learningProjection(demoCourse,rows("monitoring-demo-1"),undefined,now);expect(partial.status).toBe("in-progress");expect(partial.percent).toBe(33);expect(partial.completedChapters).toHaveLength(1);expect(partial.noRecentActivity).toBe(true);
  const done=learningProjection(demoCourse,rows("monitoring-demo-2"),undefined,now);expect(done.status).toBe("completed");expect(done.percent).toBe(100);expect(done.completedCount).toBe(6);expect(done.noRecentActivity).toBe(false);
  expect(done.chaptersDetail.flatMap(chapter=>chapter.activities).find(item=>!item.activity.required)?.status).toBe("not-started");
  expect(formatLearningDate("2026-10-23T15:00:00Z")).toBe("23/10/2026, 12:00");
  expect(formatLearningDate(null)).toBe("Sem registro");
  const withEmpty={...demoCourse,chapters:[...demoCourse.chapters,{...demoCourse.chapters[0],id:"empty",activities:[]}]};
  expect(learningProjection(withEmpty,rows("monitoring-demo-2")).completed).toBe(false);
});
test("Monitoramento: última atividade, capítulo, datas de conclusão e IDs obsoletos",()=>{
  const source=rows("monitoring-demo-1");
  const visit={...source[0],activity_id:demoCourse.chapters[0].activities.find(item=>!item.required)!.id,status:"in-progress",updated_at:"2026-10-23T14:00:00Z",completed_at:null};
  const result=learningProjection(demoCourse,[...source,visit,{...visit,activity_id:"unknown",updated_at:"2026-10-24T14:00:00Z"}]);
  expect(result.lastActivity?.id).toBe(visit.activity_id);expect(result.currentChapter?.id).toBe(visit.chapter_id);expect(result.updatedAt).toBe(visit.updated_at);
  expect(result.chaptersDetail[0].activities[0].completedAt).toBe(source[0].completed_at);
  expect(learningProjection(demoCourse,[{...visit,updated_at:new Date(now-7*86400000).toISOString()}],undefined,now).noRecentActivity).toBe(false);
  const marker={...visit,activity_id:"",updated_at:"2026-10-24T14:00:00Z"};
  const sorted=filterMonitoringStudents(monitoredStudents(demoCourse,[{userId:"old",name:"Antigo",registrationCode:"1",rows:[...source,marker]},{userId:"recent",name:"Recente",registrationCode:"2",rows:[visit]}]),"all","","recent");
  expect(sorted[0].userId).toBe("recent"); // chapter markers do not reorder the last actual activity
});
test("Monitoramento: repository demo restringe professor e associações, sem herança admin",async()=>{
  const state=createAdminFixtures(); const repo=new InMemoryMonitoringRepository(()=>state,"teacher-neural",rows);
  expect((await repo.listTeacherCourses()).map(item=>item.courseId)).toEqual(["neural-demo"]);
  expect((await repo.getCourseStudents("neural-demo")).students.map(item=>item.userId)).toEqual(["student-cesar"]);
  await expect(repo.getCourseStudents("chapter-navigation-demo")).rejects.toMatchObject({status:403});
  await expect(repo.getStudentDetail("neural-demo","admin-demo")).rejects.toMatchObject({status:404});
  state.users[0].roles.push("teacher");
  expect(await new InMemoryMonitoringRepository(()=>state,"admin-demo",rows).listTeacherCourses()).toEqual([]);
  state.users[1].status="inactive";await expect(repo.listTeacherCourses()).rejects.toMatchObject({status:403});
});
test("Monitoramento: matrícula, serviço, perfil e acesso ativos determinam a turma sem duplicatas",async()=>{
  const state=createAdminFixtures();const repo=new InMemoryMonitoringRepository(()=>state,"teacher-neural",rows);
  state.courseAccess.push({...state.courseAccess[0]});expect((await repo.getCourseStudents("neural-demo")).students).toHaveLength(1);
  state.userServices[0].status="inactive";expect((await repo.getCourseStudents("neural-demo")).students).toEqual([]);
  state.userServices[0].status="active";state.enrollments[0].status="inactive";expect((await repo.getCourseStudents("neural-demo")).students).toEqual([]);
  state.enrollments[0].status="active";state.users[2].roles=[];expect((await repo.getCourseStudents("neural-demo")).students).toEqual([]);
});
test("Monitoramento: resumo, filtros, busca e ordenação derivados das fixtures sem alterar César",async()=>{
  const original=createAdminFixtures();const state=demoMonitoringState(original);const repo=new InMemoryMonitoringRepository(()=>state,"teacher-neural",rows);
  const data=await repo.getCourseStudents("neural-demo");
  expect(original.users).toHaveLength(3);expect(data.students).toHaveLength(4);
  expect(monitoringSummary(demoCourse,data.students,now)).toEqual({total:4,started:2,completed:1,inProgress:1,average:33,inactive:3});
  const students=monitoredStudents(demoCourse,data.students,now);
  expect(filterMonitoringStudents(students,"completed","","name").map(item=>item.name)).toEqual(["Carla Exemplo"]);
  expect(filterMonitoringStudents(students,"all"," bruno ","name")).toHaveLength(1);
  expect(filterMonitoringStudents(students,"all","202700184","name")[0].name).toBe("César");
  expect(filterMonitoringStudents(students,"all","","progress")[0].name).toBe("Carla Exemplo");
  expect(filterMonitoringStudents(students,"all","","recent")[0].name).toBe("Carla Exemplo");
});
test("Monitoramento: API verifica sessão e teacher antes da consulta e valida alvos",async()=>{
  const state=createAdminFixtures();let reads=0;const monitoring={listTeacherCourses:async()=>{reads++;return[];},getCourseStudents:async()=>{throw new DataError("Acesso não autorizado.",403);},getStudentDetail:async()=>{throw new DataError("Aluno não disponível.",404);}};
  const run=(path:string,user=state.users[1])=>apiResponse(()=>monitoringRequest(new Request(`http://localhost/api/monitoring${path}`),async()=>({user,monitoring})));
  expect((await apiResponse(()=>monitoringRequest(new Request("http://localhost/api/monitoring"),async()=>{throw new DataError("Entre.",401);}))).status).toBe(401);
  expect((await run("",state.users[0])).status).toBe(403);expect(reads).toBe(0);
  expect((await run("?actorId=teacher-neural")).status).toBe(400);
  expect((await run("?courseId=neural-demo&courseId=other")).status).toBe(400);
  expect((await run("?userId=invalid")).status).toBe(400);
  expect((await run("?courseId=other")).status).toBe(403);
  expect((await run("")).status).toBe(200);expect(reads).toBe(1);
});
test("Monitoramento: Supabase repository usa RPC restrita, sem service role e mascara falhas",async()=>{
  const calls:unknown[]=[];let error: {code:string;message:string}|null=null;
  const client={rpc:async(name:string,args:unknown)=>{calls.push([name,args]);return{data:[{courseId:"neural-demo",students:[]}],error};}} as unknown as SupabaseClient;
  const repo=new SupabaseMonitoringRepository(client);
  await repo.listTeacherCourses();await repo.getCourseStudents("neural-demo");await repo.getStudentDetail("neural-demo","student-id");
  expect(calls).toEqual([["teacher_course_progress",{requested_course:null,requested_student:null}],["teacher_course_progress",{requested_course:"neural-demo",requested_student:null}],["teacher_course_progress",{requested_course:"neural-demo",requested_student:"student-id"}]]);
  error={code:"42501",message:"private sql"};await expect(repo.listTeacherCourses()).rejects.toMatchObject({status:403});
  error={code:"P0002",message:"private sql"};await expect(repo.getStudentDetail("neural-demo","student-id")).rejects.toMatchObject({status:404});
  error={code:"XX000",message:"private sql"};await expect(repo.listTeacherCourses()).rejects.toThrow("Não foi possível concluir");
});
test("Monitoramento: HTTP não envia ator e propaga erro remoto sem fixtures",async()=>{
  const before=globalThis.fetch;const calls:string[]=[];
  try {globalThis.fetch=async input=>{calls.push(String(input));return Response.json({error:"Indisponível"},{status:503});};
    await expect(new HttpMonitoringRepository().getCourseStudents("course a")).rejects.toMatchObject({status:503});
    expect(calls).toEqual(["/api/monitoring?courseId=course+a"]);
  } finally {globalThis.fetch=before;}
});
